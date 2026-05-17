#!/usr/bin/env npx tsx
/**
 * Adds `courses` YAML field to all CCFT Material and Section notes.
 *
 * Materials get courses from course-mapping.json (keyed by title).
 * Sections inherit courses from their parent material.
 *
 * Usage:
 *   npx tsx scripts/add-courses.ts
 *   npx tsx scripts/add-courses.ts --dry-run
 */

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";

const VAULT_PATH = join(
  process.env.HOME || "~",
  "Obsidian/Obsidian-Vault"
);
const MATERIALS_DIR = join(VAULT_PATH, "CCFT/Materials");
const SECTIONS_DIR = join(VAULT_PATH, "CCFT/Sections");
const MAPPING_PATH = join(__dirname, "course-mapping.json");

const dryRun = process.argv.includes("--dry-run");

// Load course mapping
const courseMapping: Record<string, string[]> = JSON.parse(
  readFileSync(MAPPING_PATH, "utf-8")
);

function addCoursesToYaml(
  content: string,
  courses: string[]
): string {
  // Find the end of YAML frontmatter
  const frontmatterEnd = content.indexOf("---", 3);
  if (frontmatterEnd === -1) return content;

  // Check if courses already exists
  const frontmatter = content.substring(0, frontmatterEnd);
  if (frontmatter.includes("courses:")) {
    return content; // Already has courses
  }

  // Insert courses before assembledBy (or at end of frontmatter)
  const coursesYaml = `courses:\n${courses
    .map((c) => `  - ${c}`)
    .join("\n")}\n`;

  const assembledByIdx = frontmatter.indexOf("assembledBy:");
  if (assembledByIdx !== -1) {
    return (
      content.substring(0, assembledByIdx) +
      coursesYaml +
      content.substring(assembledByIdx)
    );
  }

  // Insert before closing ---
  return (
    content.substring(0, frontmatterEnd) +
    coursesYaml +
    content.substring(frontmatterEnd)
  );
}

function extractTitle(content: string): string | null {
  const match = content.match(/^title:\s*"(.+)"/m);
  return match ? match[1].replace(/\\"/g, '"') : null;
}

function extractMaterialLink(content: string): string | null {
  const match = content.match(/^material:\s*"\[\[(.+)\]\]"/m);
  return match ? match[1] : null;
}

// --- Process Materials ---

const materialFiles = readdirSync(MATERIALS_DIR).filter(
  (f) => f.endsWith(".md") && f !== "_context.md"
);

// Build a map from filename (without .md) to courses for section lookup
const materialCourses: Record<string, string[]> = {};

let materialsUpdated = 0;
let materialsSkipped = 0;

for (const file of materialFiles) {
  const filepath = join(MATERIALS_DIR, file);
  const content = readFileSync(filepath, "utf-8");
  const title = extractTitle(content);

  if (!title) {
    console.log(`  ? No title found: ${file}`);
    continue;
  }

  const courses = courseMapping[title];
  if (!courses) {
    console.log(`  ? No course mapping for: ${title}`);
    materialsSkipped++;
    continue;
  }

  // Store for section lookup
  const materialName = file.replace(/\.md$/, "");
  materialCourses[materialName] = courses;

  if (content.includes("courses:")) {
    materialsSkipped++;
    continue;
  }

  const updated = addCoursesToYaml(content, courses);

  if (dryRun) {
    console.log(
      `  [DRY RUN] ${file}: ${courses.join(", ")}`
    );
  } else {
    writeFileSync(filepath, updated);
  }
  materialsUpdated++;
}

console.log(
  `\nMaterials: ${materialsUpdated} updated, ${materialsSkipped} skipped`
);

// --- Process Sections ---

const sectionFiles = readdirSync(SECTIONS_DIR).filter(
  (f) => f.endsWith(".md") && f !== "_context.md"
);

let sectionsUpdated = 0;
let sectionsSkipped = 0;
let sectionsNoMapping = 0;

for (const file of sectionFiles) {
  const filepath = join(SECTIONS_DIR, file);
  const content = readFileSync(filepath, "utf-8");

  if (content.includes("courses:")) {
    sectionsSkipped++;
    continue;
  }

  const materialLink = extractMaterialLink(content);
  if (!materialLink) {
    console.log(`  ? No material link: ${file}`);
    sectionsNoMapping++;
    continue;
  }

  const courses = materialCourses[materialLink];
  if (!courses) {
    console.log(`  ? No courses for material: ${materialLink}`);
    sectionsNoMapping++;
    continue;
  }

  const updated = addCoursesToYaml(content, courses);

  if (!dryRun) {
    writeFileSync(filepath, updated);
  }
  sectionsUpdated++;
}

console.log(
  `Sections: ${sectionsUpdated} updated, ${sectionsSkipped} skipped, ${sectionsNoMapping} unmapped`
);
