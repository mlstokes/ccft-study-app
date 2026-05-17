#!/usr/bin/env npx tsx
/**
 * Re-ingests PDF materials from local files downloaded to ~/Documents.
 * Replaces broken material + section notes that had raw PDF binary.
 *
 * Usage:
 *   npx tsx scripts/reingest-pdfs.ts
 *   npx tsx scripts/reingest-pdfs.ts --dry-run
 */

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  unlinkSync,
  existsSync,
} from "fs";
import { join, basename } from "path";
import { execSync } from "child_process";

const VAULT_PATH = join(
  process.env.HOME || "~",
  "Obsidian/Obsidian-Vault"
);
const MATERIALS_DIR = join(VAULT_PATH, "CCFT/Materials");
const SECTIONS_DIR = join(VAULT_PATH, "CCFT/Sections");
const INVENTORY_PATH = join(__dirname, "content-inventory.json");
const COURSE_MAPPING_PATH = join(__dirname, "course-mapping.json");

const dryRun = process.argv.includes("--dry-run");

// PDF files mapped to their inventory titles
const pdfFiles: { localPath: string; inventoryTitle: string }[] = [
  {
    localPath: "/Users/citostokes/Documents/CCFT - A Deft Dose of Volume.pdf",
    inventoryTitle: "A Deft Dose of Volume",
  },
  {
    localPath: "/Users/citostokes/Documents/CCFT - Scaling CrossFit Workouts.pdf",
    inventoryTitle: "Scaling CrossFit Workouts",
  },
  {
    localPath:
      "/Users/citostokes/Documents/CCFT - Strategies for a Seven Minute 2K.pdf",
    inventoryTitle:
      "Strategies for a Seven Minute 2K on the Concept II Rower",
  },
  {
    localPath: "/Users/citostokes/Documents/CCFT - Sugar Bombs.pdf",
    inventoryTitle: "Sugar Bombs",
  },
  {
    localPath: "/Users/citostokes/Documents/CCFT - Scope of Practice.pdf",
    inventoryTitle: "Scope of Practice - CCFT Handbook",
  },
];

interface Material {
  title: string;
  author: string | null;
  type: string;
  url: string;
  domains: string[];
  primaryDomain: string | null;
  category: string;
}

const inventory: Material[] = JSON.parse(
  readFileSync(INVENTORY_PATH, "utf-8")
);
const courseMapping: Record<string, string[]> = JSON.parse(
  readFileSync(COURSE_MAPPING_PATH, "utf-8")
);

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function extractPdfText(pdfPath: string): string {
  const raw = execSync(`pdftotext "${pdfPath}" -`, {
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  });
  // Clean up: remove form feeds, normalize whitespace
  return raw
    .replace(/\f/g, "\n\n")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitIntoSections(
  text: string
): { text: string; splitLogic: string }[] {
  const sections: { text: string; splitLogic: string }[] = [];

  // Split on markdown-style headings or ALL-CAPS lines (common in PDFs)
  const headingPattern = /^(#{1,4}\s+.+|[A-Z][A-Z\s:&,]{10,})$/gm;
  const parts = text.split(headingPattern);

  let currentSection = "";
  let currentLogic = "Opening content before first heading";

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (/^#{1,4}\s+/.test(trimmed) || /^[A-Z][A-Z\s:&,]{10,}$/.test(trimmed)) {
      if (currentSection.trim()) {
        sections.push({
          text: currentSection.trim(),
          splitLogic: currentLogic,
        });
      }
      currentSection = trimmed + "\n\n";
      currentLogic = `Heading boundary: "${trimmed.replace(/^#+\s*/, "")}"`;
    } else {
      currentSection += trimmed + "\n\n";
    }
  }

  if (currentSection.trim()) {
    sections.push({
      text: currentSection.trim(),
      splitLogic: currentLogic,
    });
  }

  // Fallback: paragraph groups if no headings found
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

function deleteOldSections(materialName: string): number {
  const prefix = `${materialName} — S`;
  const existing = readdirSync(SECTIONS_DIR).filter(
    (f) => f.startsWith(prefix) && f.endsWith(".md")
  );
  for (const f of existing) {
    if (!dryRun) {
      unlinkSync(join(SECTIONS_DIR, f));
    }
  }
  return existing.length;
}

// --- Main ---

for (const { localPath, inventoryTitle } of pdfFiles) {
  console.log(`\n--- ${inventoryTitle} ---`);

  if (!existsSync(localPath)) {
    console.log(`  File not found: ${localPath}`);
    continue;
  }

  const material = inventory.find((m) => m.title === inventoryTitle);
  if (!material) {
    console.log(`  Not found in inventory: ${inventoryTitle}`);
    continue;
  }

  const courses = courseMapping[inventoryTitle] || ["CCFT"];
  const materialName = sanitizeFilename(material.title);

  // Extract text
  console.log(`  Extracting text from PDF...`);
  const text = extractPdfText(localPath);
  console.log(`  ${text.length} chars extracted`);

  // Split into sections
  const sections = splitIntoSections(text);
  console.log(`  ${sections.length} sections`);

  if (dryRun) {
    console.log(`  [DRY RUN] Would replace material + ${sections.length} sections`);
    sections.forEach((s, i) => {
      const num = String(i + 1).padStart(2, "0");
      console.log(`    S${num}: ${s.splitLogic} (${s.text.length} chars)`);
    });
    continue;
  }

  // Delete old section notes
  const deleted = deleteOldSections(materialName);
  console.log(`  Deleted ${deleted} old section notes`);

  // Write material note
  const domainYaml = material.domains.map((d) => `  - ${d}`).join("\n");
  const coursesYaml = courses.map((c) => `  - ${c}`).join("\n");
  const sectionLinks = Array.from({ length: sections.length }, (_, i) => {
    const num = String(i + 1).padStart(2, "0");
    return `- [[${materialName} — S${num}]]`;
  }).join("\n");

  const materialContent = `---
tags:
  - ccft
  - ccft/material
title: "${material.title.replace(/"/g, '\\"')}"
author: "${material.author || ""}"
type: ${material.type}
sourceUrl: "${material.url}"
localPath: "${localPath}"
domains:
${domainYaml}
primaryDomain: ${material.primaryDomain || ""}
ingestDate: ${today()}
ingestStatus: ingested
sectionCount: ${sections.length}
courses:
${coursesYaml}
assembledBy: claude
---

# ${material.title}

## Source Info
- **Author**: ${material.author || "N/A"}
- **Type**: ${material.type}
- **URL**: ${material.url}
- **Local PDF**: \`${localPath}\`
- **Domains**: ${material.domains.join(", ")}

## Sections
${sectionLinks}

## Full Text
${text}
`;

  writeFileSync(join(MATERIALS_DIR, `${materialName}.md`), materialContent);

  // Write section notes
  for (let i = 0; i < sections.length; i++) {
    const num = String(i + 1).padStart(2, "0");
    const filename = `${materialName} — S${num}.md`;

    const sectionContent = `---
tags:
  - ccft
  - ccft/section
material: "[[${materialName}]]"
sectionOrder: ${i + 1}
domains:
${domainYaml}
abilities: []
splitLogic: "${sections[i].splitLogic.replace(/"/g, '\\"')}"
courses:
${coursesYaml}
assembledBy: claude
---

# ${materialName} — S${num}

> From [[${materialName}]], section ${i + 1} of ${sections.length}

${sections[i].text}
`;

    writeFileSync(join(SECTIONS_DIR, filename), sectionContent);
  }

  console.log(`  Wrote material + ${sections.length} sections`);
}
