#!/usr/bin/env npx tsx
/**
 * Populate Review Queue — extracts full text from the L1 Training Guide PDF,
 * splits by page markers, then by paragraph, maps to articles via TOC
 * page ranges, and inserts into review_queue.
 *
 * Usage:
 *   npx tsx scripts/populate-review-queue.ts
 *   npx tsx scripts/populate-review-queue.ts --dry-run
 */

import { readFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { createClient } from "@supabase/supabase-js";

const PDF_PATH = join(
  process.env.HOME || "~",
  "Documents/CCFT - CrossFit Level 1 Training Guide.pdf"
);
const DRY_RUN = process.argv.includes("--dry-run");

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
// Extract and split full PDF text by page
// ---------------------------------------------------------------

function extractPages(): Map<number, string> {
  const fullText = execSync(`pdftotext "${PDF_PATH}" -`, {
    encoding: "utf-8",
    maxBuffer: 50 * 1024 * 1024,
  });

  const pages = new Map<number, string>();
  // Split by page markers: "| N of 255"
  const pageRegex = /\|\s*(\d+)\s*of\s*255/g;
  let lastIdx = 0;
  let lastPage = 0;
  let match;

  while ((match = pageRegex.exec(fullText)) !== null) {
    const pageNum = parseInt(match[1]);
    if (lastPage > 0) {
      pages.set(lastPage, fullText.substring(lastIdx, match.index).trim());
    }
    lastIdx = match.index + match[0].length;
    lastPage = pageNum;
  }
  // Capture last page
  if (lastPage > 0) {
    pages.set(lastPage, fullText.substring(lastIdx).trim());
  }

  return pages;
}

// ---------------------------------------------------------------
// Split page text into paragraphs
// ---------------------------------------------------------------

function splitParagraphs(
  text: string
): { heading: string | null; body: string }[] {
  // Clean noise
  const lines = text.split("\n");
  const cleaned: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      cleaned.push("");
      continue;
    }
    // Skip headers/footers
    if (/^Level 1 Training Guide/.test(trimmed)) continue;
    if (/^Copyright ©/.test(trimmed)) continue;
    if (/^V\d+[A-Z]/.test(trimmed)) continue;
    if (/^METHODOLOGY$/.test(trimmed)) continue;
    if (/^MOVEMENTS$/.test(trimmed)) continue;
    if (/^TRAINER GUIDANCE$/.test(trimmed)) continue;
    if (/^MOVEMENT GUIDE$/.test(trimmed)) continue;
    if (/continued$/.test(trimmed) && trimmed.length < 60) continue;
    if (/^Originally published/.test(trimmed)) continue;
    if (/^CrossFit$/.test(trimmed)) continue;
    cleaned.push(trimmed);
  }

  // Join into text, then split on blank lines
  const rejoined = cleaned.join("\n");
  const blocks = rejoined
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter((b) => b.length > 20);

  const result: { heading: string | null; body: string }[] = [];

  for (const block of blocks) {
    const lines = block.split("\n");
    const firstLine = lines[0].trim();

    // Check if first line is ALL-CAPS heading
    const isUpperCase =
      firstLine.length > 3 &&
      firstLine.length < 100 &&
      firstLine.replace(/[^A-Za-z]/g, "").length > 0 &&
      firstLine === firstLine.toUpperCase();

    if (isUpperCase && lines.length > 1) {
      result.push({
        heading: firstLine,
        body: lines
          .slice(1)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
      });
    } else if (isUpperCase && lines.length === 1) {
      // Standalone heading — will be picked up by the next paragraph
      // Store as heading-only for now
      result.push({ heading: firstLine, body: "" });
    } else {
      // Regular paragraph — join wrapped lines
      result.push({
        heading: null,
        body: lines.join(" ").replace(/\s+/g, " ").trim(),
      });
    }
  }

  // Merge standalone headings with the following paragraph
  const merged: { heading: string | null; body: string }[] = [];
  for (let i = 0; i < result.length; i++) {
    if (result[i].body === "" && result[i].heading && i + 1 < result.length) {
      merged.push({
        heading: result[i].heading,
        body: result[i + 1].body,
      });
      i++; // skip next
    } else if (result[i].body) {
      merged.push(result[i]);
    }
  }

  return merged;
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------

async function main() {
  console.log("Extracting L1 Training Guide for review queue...");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);

  const pages = extractPages();
  console.log(`Extracted ${pages.size} pages from PDF`);

  let totalParagraphs = 0;
  let inserted = 0;
  let currentArticleName = "";
  let articleOrder = 0;

  for (const [pageNum, pageText] of [...pages.entries()].sort(
    (a, b) => a[0] - b[0]
  )) {
    const article = findArticle(pageNum);
    if (!article) continue;

    if (article.article !== currentArticleName) {
      currentArticleName = article.article;
      articleOrder = 0;
      console.log(
        `\n  ${article.category} → ${article.article} (pp. ${article.startPage}-${article.endPage})`
      );
    }

    const paragraphs = splitParagraphs(pageText);

    for (const para of paragraphs) {
      if (!para.body || para.body.length < 30) continue;

      articleOrder++;
      totalParagraphs++;

      const row = {
        material: "CrossFit Level 1 Training Guide",
        category: article.category,
        article: article.article,
        section_heading: para.heading,
        paragraph_order: articleOrder,
        body: para.body,
        page_number: pageNum,
        proposed_domains: article.defaultDomains,
        proposed_thing_to_learn: null as string | null,
        status: "pending",
      };

      if (DRY_RUN) {
        const preview = para.body.substring(0, 80);
        console.log(
          `    [${articleOrder}] p.${pageNum} ${para.heading ?? "(cont)"}: ${preview}...`
        );
      } else {
        const { error } = await supabase.from("review_queue").insert(row);
        if (error) {
          console.error(`  ERROR p.${pageNum}: ${error.message}`);
        } else {
          inserted++;
        }
      }
    }
  }

  console.log(`\n\nTotal paragraphs: ${totalParagraphs}`);
  if (!DRY_RUN) console.log(`Inserted: ${inserted}`);
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
