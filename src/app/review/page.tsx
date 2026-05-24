"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const DOMAIN_LABELS: Record<string, string> = {
  D1: "D1 — Screening & Assessment",
  D2: "D2 — Programming",
  D3: "D3 — Educating",
  D4: "D4 — Training",
  D5: "D5 — Leadership & Management",
  D6: "D6 — Lifestyle Education",
  D7: "D7 — Professional Responsibilities",
};

type ReviewItem = {
  id: string;
  material: string;
  category: string;
  article: string;
  section_heading: string | null;
  paragraph_order: number;
  body: string;
  page_number: number | null;
  proposed_domains: string[];
  proposed_thing_to_learn: string | null;
  status: string;
  final_domains: string[] | null;
  final_thing_to_learn: string | null;
  reviewer_notes: string | null;
};

type Counts = {
  total: number;
  pending: number;
  accepted: number;
  edited: number;
  rejected: number;
};

export default function ReviewPage() {
  const [item, setItem] = useState<ReviewItem | null>(null);
  const [counts, setCounts] = useState<Counts>({
    total: 0,
    pending: 0,
    accepted: 0,
    edited: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editDomains, setEditDomains] = useState("");
  const [editThing, setEditThing] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const fetchCounts = useCallback(async () => {
    const { count: total } = await supabase
      .from("review_queue")
      .select("id", { count: "exact", head: true });
    const { count: pending } = await supabase
      .from("review_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    const { count: accepted } = await supabase
      .from("review_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "accepted");
    const { count: edited } = await supabase
      .from("review_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "edited");
    const { count: rejected } = await supabase
      .from("review_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "rejected");

    setCounts({
      total: total ?? 0,
      pending: pending ?? 0,
      accepted: accepted ?? 0,
      edited: edited ?? 0,
      rejected: rejected ?? 0,
    });
  }, []);

  const fetchNext = useCallback(async () => {
    setLoading(true);
    setEditing(false);
    const { data, error } = await supabase
      .from("review_queue")
      .select("*")
      .eq("status", "pending")
      .order("page_number")
      .order("paragraph_order")
      .limit(1)
      .single();

    if (error || !data) {
      setItem(null);
    } else {
      setItem(data as ReviewItem);
      setEditDomains(data.proposed_domains?.join(", ") ?? "");
      setEditThing(data.proposed_thing_to_learn ?? "");
      setEditNotes("");
    }
    setLoading(false);
    fetchCounts();
  }, [fetchCounts]);

  useEffect(() => {
    fetchNext();
  }, [fetchNext]);

  async function handleAccept() {
    if (!item) return;
    await supabase
      .from("review_queue")
      .update({
        status: "accepted",
        final_domains: item.proposed_domains,
        final_thing_to_learn: item.proposed_thing_to_learn,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    fetchNext();
  }

  async function handleEdit() {
    if (!item) return;
    const domains = editDomains
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);
    await supabase
      .from("review_queue")
      .update({
        status: "edited",
        final_domains: domains,
        final_thing_to_learn: editThing,
        reviewer_notes: editNotes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    fetchNext();
  }

  async function handleReject() {
    if (!item) return;
    const notes = prompt("Why is this rejection? (optional)");
    await supabase
      .from("review_queue")
      .update({
        status: "rejected",
        reviewer_notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    fetchNext();
  }

  async function handleSkip() {
    if (!item) return;
    await supabase
      .from("review_queue")
      .update({
        status: "skipped",
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    fetchNext();
  }

  const reviewed = counts.accepted + counts.edited + counts.rejected;
  const progressPct =
    counts.total > 0 ? (reviewed / counts.total) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Content Review
        </h1>
        <p className="text-sm text-zinc-500">
          {reviewed} of {counts.total} reviewed &middot;{" "}
          <span className="text-green-600">{counts.accepted} accepted</span>
          {" · "}
          <span className="text-blue-600">{counts.edited} edited</span>
          {" · "}
          <span className="text-red-600">{counts.rejected} rejected</span>
          {" · "}
          {counts.pending} remaining
        </p>
        <Progress value={progressPct} className="mt-2" />
      </div>

      {!item ? (
        <Card>
          <CardContent className="py-12 text-center text-zinc-500">
            <p className="text-lg font-medium">All caught up!</p>
            <p className="mt-1 text-sm">
              No pending items to review.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Context bar */}
          <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
            <Badge variant="outline">{item.category}</Badge>
            <span>&rarr;</span>
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {item.article}
            </span>
            {item.section_heading && (
              <>
                <span>&rarr;</span>
                <span>{item.section_heading}</span>
              </>
            )}
            {item.page_number && (
              <span className="ml-auto">p. {item.page_number}</span>
            )}
          </div>

          {/* Source text */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">
                Source Text
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm prose-zinc max-w-none dark:prose-invert whitespace-pre-wrap leading-relaxed">
                {item.body}
              </div>
            </CardContent>
          </Card>

          {/* Proposal */}
          {!editing ? (
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  Proposed Tagging
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-zinc-500">
                    Domains:
                  </span>
                  {item.proposed_domains.map((d) => (
                    <Badge key={d} variant="secondary" className="text-xs">
                      {DOMAIN_LABELS[d] ?? d}
                    </Badge>
                  ))}
                </div>
                <div>
                  <span className="text-xs font-medium text-zinc-500">
                    Thing to learn:
                  </span>
                  <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                    {item.proposed_thing_to_learn}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">
                  Edit Tagging
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-zinc-500">
                    Domains (comma-separated):
                  </label>
                  <input
                    type="text"
                    value={editDomains}
                    onChange={(e) => setEditDomains(e.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-500">
                    Thing to learn:
                  </label>
                  <textarea
                    value={editThing}
                    onChange={(e) => setEditThing(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-500">
                    Notes (optional):
                  </label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {!editing ? (
              <>
                <Button
                  onClick={handleAccept}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Accept
                </Button>
                <Button
                  onClick={() => setEditing(true)}
                  variant="outline"
                  className="border-blue-300 text-blue-700 hover:bg-blue-50"
                >
                  Edit
                </Button>
                <Button
                  onClick={handleReject}
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  Reject
                </Button>
                <Button
                  onClick={handleSkip}
                  variant="outline"
                  className="ml-auto text-zinc-500"
                >
                  Skip
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={handleEdit}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Save Edit
                </Button>
                <Button
                  onClick={() => setEditing(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
