#!/usr/bin/env npx tsx
/**
 * CCFT Vault → Supabase Export Script
 *
 * Reads all material and section notes from the Obsidian vault,
 * parses YAML frontmatter + body text, and upserts into Supabase.
 *
 * Usage:
 *   npx tsx scripts/export-to-supabase.ts              # full export
 *   npx tsx scripts/export-to-supabase.ts --dry-run    # parse only, no DB writes
 *   npx tsx scripts/export-to-supabase.ts --materials  # materials only
 *   npx tsx scripts/export-to-supabase.ts --sections   # sections only
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (or env)
 * for insert permissions. Falls back to NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { parse as parseYaml } from "yaml";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const VAULT_PATH = join(
  process.env.HOME || "~",
  "Obsidian/Obsidian-Vault"
);
const MATERIALS_DIR = join(VAULT_PATH, "CCFT/Materials");
const SECTIONS_DIR = join(VAULT_PATH, "CCFT/Sections");

// Load .env.local
const envPath = join(__dirname, "..", ".env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([A-Z_]+)=(.+)$/);
  if (match) process.env[match[1]] = match[2];
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const DRY_RUN = process.argv.includes("--dry-run");
const MATERIALS_ONLY = process.argv.includes("--materials");
const SECTIONS_ONLY = process.argv.includes("--sections");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MaterialFrontmatter {
  title: string;
  author: string | null;
  type: "PDF" | "VIDEO" | "WEBLINK";
  sourceUrl: string | null;
  videoUrl?: string;
  domains: string[];
  primaryDomain: string | null;
  ingestStatus: string;
  ingestDate: string | null;
  sectionCount: number;
  courses: string[];
  tags: string[];
}

interface SectionFrontmatter {
  material: string; // wikilink like "[[Some Title]]"
  sectionOrder: number;
  domains: string[];
  abilities: string[];
  courses: string[];
  splitLogic: string | null;
}

interface ParsedNote<T> {
  filename: string;
  frontmatter: T;
  body: string;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** Normalize title for fuzzy matching — strips punctuation that
 *  Obsidian wikilinks drop (colons, question marks, etc.) */
function normalizeTitle(title: string): string {
  return title
    .replace(/[:\?!,;'"()\/]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function parseNote<T>(filepath: string): ParsedNote<T> {
  const raw = readFileSync(filepath, "utf-8");
  // Use a more lenient regex for splitLogic with escaped quotes
  const fmEnd = raw.indexOf("\n---\n", 4);
  if (fmEnd === -1) throw new Error(`No frontmatter in ${filepath}`);
  const fmRaw = raw.substring(4, fmEnd); // skip opening "---\n"
  const body = raw.substring(fmEnd + 5).trim();

  // Sanitize splitLogic — these values often have nested/escaped quotes
  // and multi-line strings that break the YAML parser. Extract the raw
  // value and re-encode it safely.
  const lines = fmRaw.split("\n");
  const sanitizedLines: string[] = [];
  let inSplitLogic = false;
  let splitLogicValue = "";

  for (const line of lines) {
    if (line.startsWith("splitLogic:")) {
      inSplitLogic = true;
      splitLogicValue = line.substring("splitLogic:".length).trim();
      continue;
    }
    if (inSplitLogic) {
      // Check if this is a continuation line (not a new YAML key)
      if (/^[a-zA-Z]/.test(line) && line.includes(":")) {
        // New key — flush splitLogic
        const clean = splitLogicValue
          .replace(/^"/, "").replace(/"$/, "")
          .replace(/\\"/g, "").replace(/"/g, "")
          .replace(/'/g, "''")
          .replace(/\n/g, " ");
        sanitizedLines.push(`splitLogic: '${clean}'`);
        inSplitLogic = false;
        sanitizedLines.push(line);
      } else {
        splitLogicValue += " " + line.trim();
      }
      continue;
    }
    sanitizedLines.push(line);
  }
  if (inSplitLogic) {
    const clean = splitLogicValue
      .replace(/^"/, "").replace(/"$/, "")
      .replace(/\\"/g, "").replace(/"/g, "")
      .replace(/'/g, "''")
      .replace(/\n/g, " ");
    sanitizedLines.push(`splitLogic: '${clean}'`);
  }
  const sanitized = sanitizedLines.join("\n");

  const frontmatter = parseYaml(sanitized) as T;
  const filename = filepath.split("/").pop()!;

  return { filename, frontmatter, body };
}

function extractWikilinkTitle(wikilink: string): string {
  // "[[Some Title]]" → "Some Title"
  const match = wikilink.match(/\[\[([^\]]+)\]\]/);
  return match ? match[1] : wikilink;
}

function readAllNotes<T>(dir: string): ParsedNote<T>[] {
  const files = readdirSync(dir).filter(
    (f) => f.endsWith(".md") && !f.startsWith("_")
  );
  const notes: ParsedNote<T>[] = [];
  for (const f of files) {
    try {
      notes.push(parseNote<T>(join(dir, f)));
    } catch (e) {
      console.warn(`  SKIP ${f}: ${(e as Error).message}`);
    }
  }
  return notes;
}

// ---------------------------------------------------------------------------
// Export: Materials
// ---------------------------------------------------------------------------

async function exportMaterials(
  supabase: SupabaseClient
): Promise<{
  titleToId: Map<string, string>;
  normalizedToId: Map<string, string>;
}> {
  console.log("\n=== Exporting Materials ===");
  const notes = readAllNotes<MaterialFrontmatter>(MATERIALS_DIR);

  // Filter to actual material notes (not hub notes)
  const materials = notes.filter((n) =>
    n.frontmatter.tags?.includes("ccft/material")
  );
  console.log(`Found ${materials.length} material notes`);

  // Two maps: exact title → ID, and normalized title → ID
  // Sections use wikilinks that strip punctuation, so we need fuzzy matching
  const titleToId = new Map<string, string>();
  const normalizedToId = new Map<string, string>();

  for (const mat of materials) {
    const fm = mat.frontmatter;
    const isSupplemental = fm.tags?.includes("ccft/supplemental") ?? false;

    const row = {
      title: fm.title,
      author: fm.author || null,
      type: fm.type,
      source_url: fm.sourceUrl || null,
      video_url: fm.videoUrl || null,
      primary_domain_id: fm.primaryDomain || null,
      ingest_status: fm.ingestStatus || "pending",
      ingest_date: fm.ingestDate || null,
      section_count: fm.sectionCount || 0,
      is_supplemental: isSupplemental,
    };

    if (DRY_RUN) {
      console.log(`  [DRY] ${fm.title} (${fm.type}, ${fm.ingestStatus})`);
      titleToId.set(fm.title, "dry-run-id");
      normalizedToId.set(normalizeTitle(fm.title), "dry-run-id");
      continue;
    }

    // Upsert material (use title as natural key for idempotency)
    const { data, error } = await supabase
      .from("study_materials")
      .upsert(row, { onConflict: "title" })
      .select("id")
      .single();

    if (error) {
      console.error(`  ERROR ${fm.title}: ${error.message}`);
      continue;
    }

    const id = data.id;
    titleToId.set(fm.title, id);
    normalizedToId.set(normalizeTitle(fm.title), id);

    // Insert domain junction rows
    if (fm.domains?.length) {
      const domainRows = fm.domains.map((d) => ({
        study_material_id: id,
        domain_id: d,
      }));
      await supabase
        .from("study_material_domains")
        .upsert(domainRows, {
          onConflict: "study_material_id,domain_id",
        });
    }

    // Insert course junction rows
    if (fm.courses?.length) {
      const courseRows = fm.courses.map((c) => ({
        study_material_id: id,
        course: c,
      }));
      await supabase
        .from("study_material_courses")
        .upsert(courseRows, {
          onConflict: "study_material_id,course",
        });
    }

    console.log(`  OK ${fm.title}`);
  }

  console.log(`Exported ${titleToId.size} materials`);
  return { titleToId, normalizedToId };
}

// ---------------------------------------------------------------------------
// Export: Sections
// ---------------------------------------------------------------------------

async function exportSections(
  supabase: SupabaseClient,
  titleToId: Map<string, string>,
  normalizedToId: Map<string, string>
): Promise<void> {
  console.log("\n=== Exporting Sections ===");
  const notes = readAllNotes<SectionFrontmatter>(SECTIONS_DIR);
  console.log(`Found ${notes.length} section notes`);

  let ok = 0;
  let skipped = 0;
  let errored = 0;

  // Batch for performance — process in chunks of 50
  const BATCH_SIZE = 50;

  for (let i = 0; i < notes.length; i += BATCH_SIZE) {
    const batch = notes.slice(i, i + BATCH_SIZE);

    for (const sec of batch) {
      const fm = sec.frontmatter;
      const materialTitle = extractWikilinkTitle(fm.material || "");
      // Try exact match first, then normalized (handles punctuation differences)
      const materialId =
        titleToId.get(materialTitle) ||
        normalizedToId.get(normalizeTitle(materialTitle));

      if (!materialId) {
        if (!DRY_RUN) {
          console.warn(
            `  SKIP ${sec.filename}: no material ID for "${materialTitle}"`
          );
        }
        skipped++;
        continue;
      }

      if (DRY_RUN) {
        const abilityCount = fm.abilities?.length || 0;
        if (i === 0 && batch.indexOf(sec) < 3) {
          console.log(
            `  [DRY] ${sec.filename}: order=${fm.sectionOrder}, abilities=${abilityCount}, body=${sec.body.length}chars`
          );
        }
        ok++;
        continue;
      }

      const row = {
        material_id: materialId,
        section_order: fm.sectionOrder,
        body: sec.body,
        split_logic: fm.splitLogic || null,
      };

      const { data, error } = await supabase
        .from("content_sections")
        .upsert(row, { onConflict: "material_id,section_order" })
        .select("id")
        .single();

      if (error) {
        console.error(`  ERROR ${sec.filename}: ${error.message}`);
        errored++;
        continue;
      }

      const sectionId = data.id;

      // Domain junction
      if (fm.domains?.length) {
        const domainRows = fm.domains.map((d) => ({
          section_id: sectionId,
          domain_id: d,
        }));
        await supabase
          .from("content_section_domains")
          .upsert(domainRows, {
            onConflict: "section_id,domain_id",
          });
      }

      // Ability junction
      if (fm.abilities?.length) {
        const abilities = Array.isArray(fm.abilities)
          ? fm.abilities
          : [fm.abilities];
        const abilityRows = abilities.map((a) => ({
          section_id: sectionId,
          ability_id: String(a),
        }));
        await supabase
          .from("content_section_abilities")
          .upsert(abilityRows, {
            onConflict: "section_id,ability_id",
          });
      }

      // Course junction
      if (fm.courses?.length) {
        const courseRows = fm.courses.map((c) => ({
          section_id: sectionId,
          course: c,
        }));
        await supabase
          .from("content_section_courses")
          .upsert(courseRows, {
            onConflict: "section_id,course",
          });
      }

      ok++;
    }

    if (!DRY_RUN) {
      process.stdout.write(
        `\r  Progress: ${Math.min(i + BATCH_SIZE, notes.length)}/${notes.length}`
      );
    }
  }

  console.log(
    `\nExported ${ok} sections, skipped ${skipped}, errors ${errored}`
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("CCFT Vault → Supabase Export");
  console.log(`Vault: ${VAULT_PATH}`);
  console.log(`Supabase: ${SUPABASE_URL}`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(
      "Missing SUPABASE_URL or key. Set in .env.local or environment."
    );
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });

  let titleToId: Map<string, string>;
  let normalizedToId: Map<string, string>;

  if (!SECTIONS_ONLY) {
    const result = await exportMaterials(supabase);
    titleToId = result.titleToId;
    normalizedToId = result.normalizedToId;
  } else {
    // Need to fetch existing material IDs from DB
    console.log("\n=== Fetching existing material IDs ===");
    const { data, error } = await supabase
      .from("study_materials")
      .select("id, title");
    if (error) {
      console.error(`Failed to fetch materials: ${error.message}`);
      process.exit(1);
    }
    titleToId = new Map(data.map((m) => [m.title, m.id]));
    normalizedToId = new Map(
      data.map((m) => [normalizeTitle(m.title), m.id])
    );
    console.log(`Found ${titleToId.size} materials in DB`);
  }

  if (!MATERIALS_ONLY) {
    await exportSections(supabase, titleToId, normalizedToId);
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
