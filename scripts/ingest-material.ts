#!/usr/bin/env npx tsx
/**
 * CCFT Material Ingestion Script
 *
 * Fetches a study material by URL, extracts full text, splits into sections,
 * and writes vault notes to CCFT/Materials/ and CCFT/Sections/.
 *
 * Usage:
 *   npx tsx scripts/ingest-material.ts <index>
 *   npx tsx scripts/ingest-material.ts --url <url>
 *   npx tsx scripts/ingest-material.ts --all
 *   npx tsx scripts/ingest-material.ts --dry-run <index>
 *
 * Reads from scripts/content-inventory.json
 * Writes to ~/Obsidian/Obsidian-Vault/CCFT/Materials/ and CCFT/Sections/
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const VAULT_PATH = join(
  process.env.HOME || "~",
  "Obsidian/Obsidian-Vault"
);
const MATERIALS_DIR = join(VAULT_PATH, "CCFT/Materials");
const SECTIONS_DIR = join(VAULT_PATH, "CCFT/Sections");
const INVENTORY_PATH = join(__dirname, "content-inventory.json");

interface Material {
  title: string;
  author: string | null;
  type: "PDF" | "VIDEO" | "WEBLINK";
  url: string;
  domains: string[];
  primaryDomain: string | null;
  category: string;
}

// Ensure directories exist
mkdirSync(MATERIALS_DIR, { recursive: true });
mkdirSync(SECTIONS_DIR, { recursive: true });

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function extractSlugFromJournalUrl(url: string): string | null {
  const match = url.match(
    /journal\.crossfit\.com\/article\/([a-z0-9-]+)/
  );
  return match ? match[1] : null;
}

interface JournalApiResponse {
  postRaw: string | null;
  postHtml: string | null;
  media?: {
    items?: Array<{
      type: string;
      sources?: Array<{ url: string }>;
      desktop?: string;
      duration?: string;
    }>;
  };
}

async function fetchJournalApi(slug: string): Promise<JournalApiResponse> {
  const apiUrl = `https://journal.crossfit.com/media-api/api/v1/media/slug/${slug}`;
  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error(`Journal API ${res.status} for slug: ${slug}`);
  return res.json();
}

async function fetchJournalContent(slug: string): Promise<string> {
  const data = await fetchJournalApi(slug);
  if (!data.postRaw && !data.postHtml) {
    throw new Error(`No content in Journal API response for slug: ${slug}`);
  }
  // postRaw is HTML content from their CMS — prefer it over postHtml
  return data.postRaw || data.postHtml || "";
}

async function fetchWebContent(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function extractTextFromHtml(html: string): string {
  // Remove script/style tags
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, "");
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, "");
  text = text.replace(/<header[\s\S]*?<\/header>/gi, "");

  // Try to find article/main content
  const articleMatch = text.match(
    /<article[\s\S]*?>([\s\S]*?)<\/article>/i
  );
  const mainMatch = text.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i);
  const contentMatch = text.match(
    /<div[^>]*class="[^"]*(?:content|article|entry|post)[^"]*"[^>]*>([\s\S]*?)<\/div>/i
  );

  const contentHtml =
    articleMatch?.[1] || mainMatch?.[1] || contentMatch?.[1] || text;

  // Convert headings to markdown
  let md = contentHtml;
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n");
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n");
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n");
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n#### $1\n");

  // Convert common elements
  md = md.replace(/<br\s*\/?>/gi, "\n");
  md = md.replace(/<\/p>/gi, "\n\n");
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n");
  md = md.replace(/<strong>([\s\S]*?)<\/strong>/gi, "**$1**");
  md = md.replace(/<b>([\s\S]*?)<\/b>/gi, "**$1**");
  md = md.replace(/<em>([\s\S]*?)<\/em>/gi, "*$1*");
  md = md.replace(/<i>([\s\S]*?)<\/i>/gi, "*$1*");
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, "> $1");

  // Strip remaining tags
  md = md.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  md = md.replace(/&amp;/g, "&");
  md = md.replace(/&lt;/g, "<");
  md = md.replace(/&gt;/g, ">");
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#39;/g, "'");
  md = md.replace(/&nbsp;/g, " ");
  md = md.replace(/&#8217;/g, "'");
  md = md.replace(/&#8220;/g, '"');
  md = md.replace(/&#8221;/g, '"');
  md = md.replace(/&#8211;/g, "–");
  md = md.replace(/&#8212;/g, "—");

  // Normalize line endings and clean up whitespace
  md = md.replace(/\r\n/g, "\n");
  md = md.replace(/\n{3,}/g, "\n\n");
  md = md.trim();

  return md;
}

function splitIntoSections(
  text: string,
  _title: string
): { text: string; splitLogic: string }[] {
  const sections: { text: string; splitLogic: string }[] = [];

  // Split on markdown headings (## or ###)
  const headingPattern = /^(#{1,4}\s+.+)$/gm;
  const parts = text.split(headingPattern);

  let currentSection = "";
  let currentLogic = "Opening content before first heading";

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;

    if (/^#{1,4}\s+/.test(part)) {
      // This is a heading — save previous section if it has content
      if (currentSection.trim()) {
        sections.push({
          text: currentSection.trim(),
          splitLogic: currentLogic,
        });
      }
      currentSection = part + "\n\n";
      currentLogic = `Heading boundary: "${part.replace(/^#+\s*/, "")}"`;
    } else {
      currentSection += part + "\n\n";
    }
  }

  // Save last section
  if (currentSection.trim()) {
    sections.push({
      text: currentSection.trim(),
      splitLogic: currentLogic,
    });
  }

  // If no headings found, split by paragraph groups (3-4 paragraphs per section)
  if (sections.length <= 1 && text.length > 1000) {
    const paragraphs = text
      .split(/\n\n+/)
      .filter((p) => p.trim().length > 50);
    const grouped: { text: string; splitLogic: string }[] = [];
    const PARAS_PER_SECTION = 3;

    for (let i = 0; i < paragraphs.length; i += PARAS_PER_SECTION) {
      const group = paragraphs
        .slice(i, i + PARAS_PER_SECTION)
        .join("\n\n");
      grouped.push({
        text: group,
        splitLogic: `Paragraph group (${i + 1}-${Math.min(i + PARAS_PER_SECTION, paragraphs.length)} of ${paragraphs.length}) — no headings in source`,
      });
    }
    return grouped;
  }

  return sections;
}

function writeMaterialNote(
  material: Material,
  fullText: string,
  sectionCount: number
): string {
  const filename = sanitizeFilename(material.title) + ".md";
  const filepath = join(MATERIALS_DIR, filename);

  const domainYaml = material.domains.map((d) => `  - ${d}`).join("\n");
  const sectionLinks = Array.from({ length: sectionCount }, (_, i) => {
    const num = String(i + 1).padStart(2, "0");
    return `- [[${sanitizeFilename(material.title)} — S${num}]]`;
  }).join("\n");

  const content = `---
tags:
  - ccft
  - ccft/material
title: "${material.title.replace(/"/g, '\\"')}"
author: "${material.author || ""}"
type: ${material.type}
sourceUrl: "${material.url}"
domains:
${domainYaml}
primaryDomain: ${material.primaryDomain || ""}
ingestDate: ${today()}
ingestStatus: ingested
sectionCount: ${sectionCount}
assembledBy: claude
---

# ${material.title}

## Source Info
- **Author**: ${material.author || "N/A"}
- **Type**: ${material.type}
- **URL**: ${material.url}
- **Domains**: ${material.domains.join(", ")}

## Sections
${sectionLinks}

## Full Text
${fullText}
`;

  writeFileSync(filepath, content);
  return filename;
}

function writeSectionNote(
  material: Material,
  section: { text: string; splitLogic: string },
  index: number,
  totalSections: number
): string {
  const num = String(index + 1).padStart(2, "0");
  const materialName = sanitizeFilename(material.title);
  const filename = `${materialName} — S${num}.md`;
  const filepath = join(SECTIONS_DIR, filename);

  const domainYaml = material.domains.map((d) => `  - ${d}`).join("\n");

  const content = `---
tags:
  - ccft
  - ccft/section
material: "[[${materialName}]]"
sectionOrder: ${index + 1}
domains:
${domainYaml}
abilities: []
splitLogic: "${section.splitLogic.replace(/"/g, '\\"')}"
assembledBy: claude
---

# ${materialName} — S${num}

> From [[${materialName}]], section ${index + 1} of ${totalSections}

${section.text}
`;

  writeFileSync(filepath, content);
  return filename;
}

async function ingestMaterial(material: Material, dryRun = false) {
  console.log(`\n📥 Ingesting: ${material.title}`);
  console.log(`   Type: ${material.type} | URL: ${material.url}`);

  // Check if already ingested
  const materialFile = join(
    MATERIALS_DIR,
    sanitizeFilename(material.title) + ".md"
  );
  if (existsSync(materialFile) && !dryRun) {
    console.log(`   ⏭️  Already exists, skipping`);
    return;
  }

  if (material.type === "VIDEO") {
    const journalSlug = extractSlugFromJournalUrl(material.url);
    if (!journalSlug) {
      console.log(`   ⚠️  Video without Journal slug — skipping (needs manual handling)`);
      return;
    }

    try {
      console.log(`   Fetching video metadata from Journal API (slug: ${journalSlug})...`);
      const apiData = await fetchJournalApi(journalSlug);
      const description = extractTextFromHtml(apiData.postRaw || apiData.postHtml || "");

      // Extract video URL and duration from media items
      const videoItem = apiData.media?.items?.find((i) => i.type === "video");
      const videoUrl = videoItem?.sources?.[0]?.url || videoItem?.desktop || "";
      const duration = videoItem?.duration ? parseInt(videoItem.duration) : null;
      const durationStr = duration
        ? `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}`
        : "unknown";

      console.log(`   Duration: ${durationStr} | Description: ${description.length} chars`);
      console.log(`   Video URL: ${videoUrl ? videoUrl.substring(0, 80) + "..." : "not found"}`);

      if (dryRun) {
        console.log(`   [DRY RUN] Would write video material note`);
        return;
      }

      // Write video material note (no sections — description is the content)
      const materialName = sanitizeFilename(material.title);
      const filename = materialName + ".md";
      const filepath = join(MATERIALS_DIR, filename);
      const domainYaml = material.domains.map((d) => `  - ${d}`).join("\n");

      const content = `---
tags:
  - ccft
  - ccft/material
title: "${material.title.replace(/"/g, '\\"')}"
author: "${material.author || ""}"
type: VIDEO
sourceUrl: "${material.url}"
videoUrl: "${videoUrl}"
duration: ${duration || ""}
durationFormatted: "${durationStr}"
domains:
${domainYaml}
primaryDomain: ${material.primaryDomain || ""}
ingestDate: ${today()}
ingestStatus: ingested
sectionCount: 0
assembledBy: claude
---

# ${material.title}

## Source Info
- **Author**: ${material.author || "N/A"}
- **Type**: VIDEO
- **Duration**: ${durationStr}
- **Article URL**: ${material.url}
- **Video URL**: ${videoUrl}
- **Domains**: ${material.domains.join(", ")}

## Description
${description}
`;

      writeFileSync(filepath, content);
      console.log(`   ✅ Done: video material note`);
    } catch (err) {
      console.error(`   ❌ Error: ${(err as Error).message}`);
    }
    return;
  }

  try {
    console.log(`   Fetching...`);
    const journalSlug = extractSlugFromJournalUrl(material.url);
    let html: string;
    if (journalSlug) {
      console.log(`   Using Journal API (slug: ${journalSlug})...`);
      html = await fetchJournalContent(journalSlug);
    } else {
      html = await fetchWebContent(material.url);
    }
    console.log(`   Extracting text...`);
    const text = extractTextFromHtml(html);

    if (text.length < 100) {
      console.log(
        `   ⚠️  Extracted text too short (${text.length} chars) — may need manual review`
      );
    }

    console.log(`   Splitting into sections...`);
    const sections = splitIntoSections(text, material.title);
    console.log(`   ${sections.length} sections`);

    if (dryRun) {
      console.log(`   [DRY RUN] Would write:`);
      console.log(`     Material: ${sanitizeFilename(material.title)}.md`);
      console.log(
        `     Sections: ${sections.length} notes (${text.length} chars total)`
      );
      sections.forEach((s, i) => {
        console.log(
          `       S${String(i + 1).padStart(2, "0")}: ${s.splitLogic} (${s.text.length} chars)`
        );
      });
      return;
    }

    console.log(`   Writing material note...`);
    writeMaterialNote(material, text, sections.length);

    console.log(`   Writing ${sections.length} section notes...`);
    sections.forEach((section, i) => {
      writeSectionNote(material, section, i, sections.length);
    });

    console.log(`   ✅ Done: ${sections.length} sections`);
  } catch (err) {
    console.error(`   ❌ Error: ${(err as Error).message}`);
  }
}

// --- Main ---

async function main() {
  const inventory: Material[] = JSON.parse(
    readFileSync(INVENTORY_PATH, "utf-8")
  );
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage:");
    console.log("  npx tsx scripts/ingest-material.ts <index>");
    console.log("  npx tsx scripts/ingest-material.ts --dry-run <index>");
    console.log("  npx tsx scripts/ingest-material.ts --all");
    console.log(
      "  npx tsx scripts/ingest-material.ts --range <start> <end>"
    );
    console.log(`\n${inventory.length} materials in inventory`);
    process.exit(0);
  }

  const dryRun = args.includes("--dry-run");
  const filteredArgs = args.filter((a) => a !== "--dry-run");

  if (filteredArgs[0] === "--all") {
    for (const material of inventory) {
      await ingestMaterial(material, dryRun);
    }
  } else if (filteredArgs[0] === "--range") {
    const start = parseInt(filteredArgs[1]);
    const end = parseInt(filteredArgs[2]);
    for (let i = start; i <= end && i < inventory.length; i++) {
      await ingestMaterial(inventory[i], dryRun);
    }
  } else {
    const idx = parseInt(filteredArgs[0]);
    if (isNaN(idx) || idx < 0 || idx >= inventory.length) {
      console.error(
        `Invalid index: ${filteredArgs[0]} (range: 0-${inventory.length - 1})`
      );
      process.exit(1);
    }
    await ingestMaterial(inventory[idx], dryRun);
  }
}

main();
