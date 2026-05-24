#!/usr/bin/env npx tsx
/**
 * Populate Review Queue — reads pre-extracted L1 Training Guide text,
 * splits into clean paragraphs by page, maps to articles via TOC,
 * and inserts into review_queue.
 *
 * Usage:
 *   npx tsx scripts/populate-review-queue.ts
 *   npx tsx scripts/populate-review-queue.ts --dry-run
 *   npx tsx scripts/populate-review-queue.ts --clear   # delete all existing rows first
 */

import { readFileSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";

const TEXT_PATH = join(__dirname, "l1-full-text.txt");
const DRY_RUN = process.argv.includes("--dry-run");
const CLEAR = process.argv.includes("--clear");

// Load env
const envPath = join(__dirname, "..", ".env.local");
for (const line of readFileSync(envPath, "utf-8").split("\n")) {
  const match = line.match(/^([A-Z_]+)=(.+)$/);
  if (match) process.env[match[1]] = match[2];
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

// ---------------------------------------------------------------
// TOC
// ---------------------------------------------------------------

interface ArticleDef {
  article: string;
  category: string;
  startPage: number;
  endPage: number;
  defaultDomains: string[];
}

const TOC: ArticleDef[] = [
  { article: "Understanding CrossFit", category: "Methodology", startPage: 2, endPage: 4, defaultDomains: ["D3"] },
  { article: "Foundations", category: "Methodology", startPage: 5, endPage: 16, defaultDomains: ["D3"] },
  { article: "What Is Fitness? (Part 1)", category: "Methodology", startPage: 17, endPage: 31, defaultDomains: ["D3"] },
  { article: "What Is Fitness? (Part 2)", category: "Methodology", startPage: 32, endPage: 39, defaultDomains: ["D3"] },
  { article: "Technique", category: "Methodology", startPage: 40, endPage: 44, defaultDomains: ["D3"] },
  { article: "Nutrition: Avoiding Disease and Optimizing Performance", category: "Methodology", startPage: 45, endPage: 49, defaultDomains: ["D3", "D6"] },
  { article: "Fitness, Luck and Health", category: "Methodology", startPage: 50, endPage: 52, defaultDomains: ["D3"] },
  { article: "Zone Meal Plans", category: "Methodology", startPage: 53, endPage: 64, defaultDomains: ["D6"] },
  { article: "Typical CrossFit Block Prescriptions and Adjustments", category: "Methodology", startPage: 65, endPage: 67, defaultDomains: ["D6"] },
  { article: "Supplementation", category: "Methodology", startPage: 68, endPage: 70, defaultDomains: ["D6"] },
  { article: "A Theoretical Template for CrossFit's Programming", category: "Methodology", startPage: 71, endPage: 76, defaultDomains: ["D2"] },
  { article: "Programming", category: "Methodology", startPage: 77, endPage: 82, defaultDomains: ["D2"] },
  { article: "Scaling CrossFit", category: "Methodology", startPage: 83, endPage: 86, defaultDomains: ["D2", "D3"] },
  { article: "Running a CrossFit Class", category: "Methodology", startPage: 87, endPage: 99, defaultDomains: ["D5"] },
  { article: "Anatomy and Physiology for Jocks", category: "Movements", startPage: 100, endPage: 103, defaultDomains: ["D4"] },
  { article: "Squat Clinic", category: "Movements", startPage: 104, endPage: 110, defaultDomains: ["D4"] },
  { article: "The Overhead Squat", category: "Movements", startPage: 111, endPage: 117, defaultDomains: ["D4"] },
  { article: "Shoulder Press, Push Press, Push Jerk", category: "Movements", startPage: 118, endPage: 122, defaultDomains: ["D4"] },
  { article: "The Deadlift", category: "Movements", startPage: 123, endPage: 126, defaultDomains: ["D4"] },
  { article: "Medicine-Ball Cleans", category: "Movements", startPage: 127, endPage: 130, defaultDomains: ["D4"] },
  { article: "The Glute-Ham Developer (GHD)", category: "Movements", startPage: 131, endPage: 139, defaultDomains: ["D4"] },
  { article: "Where Do I Go From Here?", category: "Trainer Guidance", startPage: 142, endPage: 150, defaultDomains: ["D5"] },
  { article: "Responsible Training", category: "Trainer Guidance", startPage: 151, endPage: 157, defaultDomains: ["D5", "D7"] },
  { article: "Fundamentals, Virtuosity, and Mastery", category: "Trainer Guidance", startPage: 158, endPage: 159, defaultDomains: ["D3", "D5"] },
  { article: "Professional Training", category: "Trainer Guidance", startPage: 160, endPage: 161, defaultDomains: ["D5", "D7"] },
  { article: "Scaling Professional Training", category: "Trainer Guidance", startPage: 162, endPage: 165, defaultDomains: ["D2", "D5"] },
  { article: "CF L1 License Agreement in Plain English", category: "Trainer Guidance", startPage: 166, endPage: 166, defaultDomains: ["D7"] },
  { article: "Frequently Asked Questions", category: "Trainer Guidance", startPage: 167, endPage: 168, defaultDomains: ["D7"] },
  { article: "CrossFit Credentials", category: "Trainer Guidance", startPage: 169, endPage: 169, defaultDomains: ["D7"] },
  { article: "Nine Foundational Movements", category: "Movement Guide", startPage: 170, endPage: 217, defaultDomains: ["D4"] },
  { article: "Four Additional Movements", category: "Movement Guide", startPage: 218, endPage: 247, defaultDomains: ["D4"] },
];

function findArticle(page: number): ArticleDef | null {
  return TOC.find((a) => page >= a.startPage && page <= a.endPage) ?? null;
}

// ---------------------------------------------------------------
// Noise detection
// ---------------------------------------------------------------

function isNoise(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  // Page footers
  if (/^Copyright © \d{4}/.test(t)) return true;
  if (/^V\d+[A-Z]/.test(t)) return true;
  // Category headers (standalone on their own line)
  if (/^(METHODOLOGY|MOVEMENTS|TRAINER GUIDANCE|MOVEMENT GUIDE)$/.test(t)) return true;
  // Page header
  if (/^Level 1 Training Guide$/.test(t)) return true;
  // "continued" lines
  if (/,\s*continued\s*$/.test(t)) return true;
  // "Originally published" lines
  if (/^Originally published/.test(t)) return true;
  // Standalone "CrossFit" logo text
  if (/^CrossFit[®]?$/.test(t)) return true;
  return false;
}

function isSidebar(block: string): boolean {
  // Sidebars are typically short, broken across many short lines,
  // often quotes ending with —COACH GLASSMAN
  if (/—COACH GLASSMAN/.test(block)) return true;
  // Short multi-line blocks where most lines are very short (sidebar column)
  const lines = block.split("\n");
  if (lines.length >= 4) {
    const shortLines = lines.filter((l) => l.trim().length < 40);
    if (shortLines.length / lines.length > 0.7 && !isAllCaps(lines[0].trim())) {
      return true;
    }
  }
  return false;
}

function isAllCaps(s: string): boolean {
  const letters = s.replace(/[^A-Za-z]/g, "");
  return letters.length > 3 && letters === letters.toUpperCase();
}

// ---------------------------------------------------------------
// Parse full text into pages → paragraphs
// ---------------------------------------------------------------

interface Paragraph {
  heading: string | null;
  body: string;
  page: number;
}

function parseText(): Paragraph[] {
  const fullText = readFileSync(TEXT_PATH, "utf-8");

  // Find all page markers: "| N of 255"
  // The marker is a PAGE FOOTER — content for page N appears BEFORE the marker.
  // So text between marker N and marker N+1 is the content of page N+1.
  const pagePattern = /\|\s*(\d+)\s*of\s*255/g;
  const markers: { page: number; endIndex: number; startIndex: number }[] = [];
  let m;
  while ((m = pagePattern.exec(fullText)) !== null) {
    markers.push({
      page: parseInt(m[1]),
      startIndex: m.index,
      endIndex: m.index + m[0].length,
    });
  }

  // Build page text map: page N content = text from after marker(N-1) to start of marker(N)
  const pages = new Map<number, string>();
  for (let i = 0; i < markers.length; i++) {
    const pageNum = markers[i].page;
    const contentStart = i > 0 ? markers[i - 1].endIndex : 0;
    const contentEnd = markers[i].startIndex;
    pages.set(pageNum, fullText.substring(contentStart, contentEnd));
  }
  // Last page: content after the last marker
  if (markers.length > 0) {
    const last = markers[markers.length - 1];
    pages.set(last.page + 1, fullText.substring(last.endIndex));
  }

  const allParagraphs: Paragraph[] = [];

  for (const [pageNum, pageText] of [...pages.entries()].sort((a, b) => a[0] - b[0])) {

    // Skip pages outside article range
    if (!findArticle(pageNum)) continue;

    // Clean lines
    const lines = pageText.split("\n");
    const cleanedLines: string[] = [];
    for (const line of lines) {
      if (isNoise(line)) continue;
      cleanedLines.push(line);
    }

    // Join back, then split into blocks.
    // Split on blank lines AND before ALL-CAPS heading lines.
    const cleaned = cleanedLines.join("\n");
    // Insert a double-newline before any ALL-CAPS line that looks like a heading
    const withHeadingBreaks = cleaned.replace(
      /\n([A-Z][A-Z\s,.:;'"\-—()\/&?!]{3,})\n/g,
      "\n\n$1\n"
    );
    const blocks = withHeadingBreaks.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);

    for (const block of blocks) {
      // Skip sidebars
      if (isSidebar(block)) continue;

      // Skip very short fragments (< 40 chars and not a heading)
      if (block.length < 40 && !isAllCaps(block)) continue;

      const lines = block.split("\n");
      const firstLine = lines[0].trim();

      // Check if first line is ALL-CAPS heading
      if (isAllCaps(firstLine) && firstLine.length < 120) {
        const bodyLines = lines.slice(1);
        const body = bodyLines
          .map((l) => l.trim())
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        if (body.length >= 30) {
          allParagraphs.push({ heading: firstLine, body, page: pageNum });
        } else if (body.length > 0) {
          // Heading with very short body — might be a figure caption or label
          allParagraphs.push({ heading: firstLine, body, page: pageNum });
        }
        // Standalone heading with no body — skip (will be context for next paragraph)
      } else {
        // Regular paragraph — join wrapped lines
        const body = lines
          .map((l) => l.trim())
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        if (body.length >= 30) {
          allParagraphs.push({ heading: null, body, page: pageNum });
        }
      }
    }
  }

  return allParagraphs;
}

// ---------------------------------------------------------------
// Merge paragraphs that were split across page boundaries
// ---------------------------------------------------------------

function mergeAcrossPages(paragraphs: Paragraph[]): Paragraph[] {
  const merged: Paragraph[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const current = paragraphs[i];

    // Check if next paragraph is a continuation (starts with lowercase,
    // no heading, and current doesn't end with sentence-ending punctuation)
    if (i + 1 < paragraphs.length) {
      const next = paragraphs[i + 1];
      const endsClean = /[.!?)"]\s*$/.test(current.body);
      const nextStartsLower = /^[a-z]/.test(next.body);
      const nextHasNoHeading = !next.heading;
      const differentPage = next.page !== current.page;

      if (!endsClean && nextStartsLower && nextHasNoHeading && differentPage) {
        // Merge
        merged.push({
          heading: current.heading,
          body: current.body + " " + next.body,
          page: current.page,
        });
        i++; // skip next
        continue;
      }
    }

    merged.push(current);
  }

  return merged;
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------

async function main() {
  console.log("Populating review queue from L1 Training Guide...");
  console.log("Mode: " + (DRY_RUN ? "DRY RUN" : "LIVE"));

  if (CLEAR && !DRY_RUN) {
    console.log("Clearing existing review_queue rows...");
    const { error } = await supabase
      .from("review_queue")
      .delete()
      .eq("material", "CrossFit Level 1 Training Guide");
    if (error) console.error("Clear error:", error.message);
    else console.log("Cleared.");
  }

  let paragraphs = parseText();
  console.log("Parsed " + paragraphs.length + " raw paragraphs");

  paragraphs = mergeAcrossPages(paragraphs);
  console.log("After cross-page merge: " + paragraphs.length + " paragraphs");

  let inserted = 0;
  let currentArticle = "";
  let articleOrder = 0;
  let lastHeading: string | null = null;

  for (const para of paragraphs) {
    const article = findArticle(para.page);
    if (!article) continue;

    if (article.article !== currentArticle) {
      currentArticle = article.article;
      articleOrder = 0;
      lastHeading = null;
      console.log("\n  " + article.category + " → " + article.article + " (pp. " + article.startPage + "-" + article.endPage + ")");
    }

    articleOrder++;

    // Track last seen heading for context
    const heading = para.heading || lastHeading;
    if (para.heading) lastHeading = para.heading;

    const row = {
      material: "CrossFit Level 1 Training Guide",
      category: article.category,
      article: article.article,
      section_heading: heading,
      paragraph_order: articleOrder,
      body: para.body,
      page_number: para.page,
      proposed_domains: article.defaultDomains,
      proposed_thing_to_learn: null as string | null,
      status: "pending",
    };

    if (DRY_RUN) {
      const preview = para.body.substring(0, 90);
      console.log("    [" + articleOrder + "] p." + para.page + " " + (heading ?? "(intro)") + ": " + preview + "...");
    } else {
      const { error } = await supabase.from("review_queue").insert(row);
      if (error) {
        console.error("  ERROR p." + para.page + ": " + error.message);
      } else {
        inserted++;
      }
    }
  }

  console.log("\n\nTotal paragraphs: " + paragraphs.length);
  if (!DRY_RUN) console.log("Inserted: " + inserted);
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
