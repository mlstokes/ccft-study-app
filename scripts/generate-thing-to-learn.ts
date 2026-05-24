#!/usr/bin/env npx tsx
/**
 * Generate "thing to learn" proposals for review queue items.
 * Reads each pending paragraph and uses Claude API to propose
 * what the reader should learn from it.
 *
 * Usage:
 *   npx tsx scripts/generate-thing-to-learn.ts
 *   npx tsx scripts/generate-thing-to-learn.ts --dry-run
 *   npx tsx scripts/generate-thing-to-learn.ts --batch-size 50
 */

import { readFileSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const DRY_RUN = process.argv.includes("--dry-run");
const batchArg = process.argv.findIndex((a) => a === "--batch-size");
const BATCH_SIZE = batchArg >= 0 ? parseInt(process.argv[batchArg + 1]) : 20;

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

const anthropic = new Anthropic();

// ---------------------------------------------------------------
// Fetch items needing proposals
// ---------------------------------------------------------------

async function fetchPending(limit: number) {
  const { data, error } = await supabase
    .from("review_queue")
    .select("*")
    .eq("status", "pending")
    .is("proposed_thing_to_learn", null)
    .order("paragraph_order")
    .order("article")
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------
// Generate proposals via Claude (batched)
// ---------------------------------------------------------------

interface ReviewItem {
  id: string;
  article: string;
  section_heading: string | null;
  body: string;
  category: string;
  proposed_domains: string[];
}

interface Proposal {
  thingToLearn: string;
  domains: string[];
}

async function generateProposals(
  items: ReviewItem[]
): Promise<Map<string, Proposal>> {
  const itemList = items
    .map((item, i) => {
      const heading = item.section_heading ?? "(none)";
      const bodyPreview = item.body.substring(0, 1500);
      return `[${i + 1}] Article: "${item.article}" | Section: "${heading}" | Category: ${item.category}\nBody: ${bodyPreview}`;
    })
    .join("\n\n---\n\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are helping tag study material from the CrossFit Level 1 Training Guide for a CCFT exam study app.

For each paragraph below, provide:
1. **Domain(s)**: Which CCFT exam domain(s) this content primarily teaches. Use these codes:
   - D1: Screening and Ongoing Assessment
   - D2: Programming
   - D3: Educating (teaching CrossFit concepts, definitions, philosophy)
   - D4: Training (movement execution, coaching cues, fault identification)
   - D5: Leadership and Management (class management, coaching approach)
   - D6: Lifestyle Education (nutrition, sleep, lifestyle)
   - D7: Professional Responsibilities (safety, legal, scope of practice)

2. **Thing to learn**: A concise statement (1-2 sentences) of what a CCFT exam candidate should take away from this paragraph. Focus on the testable knowledge — what concept, definition, or principle does this teach?

If the paragraph is noise (table of contents, index entry, copyright text, page header/footer, figure caption with no educational content), respond with SKIP.

Respond in this exact format for each item:
[N] DOMAINS: D3 | THING: CrossFit's aim is broad, general, and inclusive fitness.
or
[N] SKIP

Here are the paragraphs:

${itemList}`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";
  const results = new Map<string, { thingToLearn: string; domains: string[] }>();

  for (let i = 0; i < items.length; i++) {
    const pattern = new RegExp(
      `\\[${i + 1}\\]\\s*(SKIP|DOMAINS:\\s*([\\w,\\s]+)\\s*\\|\\s*THING:\\s*(.+))`,
      "i"
    );
    const match = text.match(pattern);
    if (match) {
      if (match[1] === "SKIP") {
        results.set(items[i].id, { thingToLearn: "__SKIP__", domains: [] });
      } else {
        const domains = match[2]
          .split(",")
          .map((d) => d.trim())
          .filter((d) => /^D\d$/.test(d));
        results.set(items[i].id, {
          thingToLearn: match[3].trim(),
          domains: domains.length > 0 ? domains : items[i].proposed_domains,
        });
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------
// Main
// ---------------------------------------------------------------

async function main() {
  console.log("Generating 'thing to learn' proposals...");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`Batch size: ${BATCH_SIZE}`);

  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  while (true) {
    const items = await fetchPending(BATCH_SIZE);
    if (items.length === 0) {
      console.log("\nNo more items to process.");
      break;
    }

    console.log(
      `\nBatch: ${items.length} items (${items[0].article} → ${items[items.length - 1].article})`
    );

    const proposals = await generateProposals(items);

    for (const item of items) {
      const proposal = proposals.get(item.id);
      totalProcessed++;

      if (!proposal) {
        console.log(`  [${totalProcessed}] NO MATCH: ${item.body.substring(0, 50)}...`);
        continue;
      }

      if (proposal.thingToLearn === "__SKIP__") {
        totalSkipped++;
        if (!DRY_RUN) {
          await supabase
            .from("review_queue")
            .update({
              status: "skipped",
              proposed_thing_to_learn: "(noise — auto-skipped)",
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);
        }
        console.log(`  [${totalProcessed}] SKIP: ${item.body.substring(0, 50)}...`);
        continue;
      }

      if (!DRY_RUN) {
        await supabase
          .from("review_queue")
          .update({
            proposed_domains: proposal.domains,
            proposed_thing_to_learn: proposal.thingToLearn,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);
      }
      totalUpdated++;
      console.log(
        `  [${totalProcessed}] ${proposal.domains.join(",")}: ${proposal.thingToLearn.substring(0, 80)}...`
      );
    }

    console.log(
      `  Batch done. Updated: ${totalUpdated}, Skipped: ${totalSkipped}`
    );
  }

  console.log(`\nDone. Processed: ${totalProcessed}, Updated: ${totalUpdated}, Skipped: ${totalSkipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
