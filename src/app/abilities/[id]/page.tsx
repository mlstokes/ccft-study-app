import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

async function getAbility(id: string) {
  const { data, error } = await supabase
    .from("abilities")
    .select("*, tasks(name, domain_id)")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data;
}

async function getSections(abilityId: string) {
  // Get sections linked to this ability, with their material info
  const { data, error } = await supabase
    .from("content_section_abilities")
    .select(
      "section_id, content_sections(id, section_order, body, split_logic, material_id, study_materials(title, type, source_url, video_url, ingest_status))"
    )
    .eq("ability_id", abilityId);

  if (error) throw error;
  return data;
}

export const revalidate = 3600;

export default async function AbilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ability = await getAbility(id);
  if (!ability) notFound();

  const sectionRows = await getSections(id);

  // Flatten and group by material
  type Section = {
    id: string;
    section_order: number;
    body: string;
    material_title: string;
    material_type: string;
    material_url: string | null;
    material_video_url: string | null;
    material_ingest_status: string;
  };

  const sections: Section[] = [];
  for (const row of sectionRows ?? []) {
    const sec = row.content_sections as unknown as Record<string, unknown> | null;
    if (!sec) continue;
    const mat = sec.study_materials as unknown as Record<string, unknown> | null;
    sections.push({
      id: sec.id as string,
      section_order: sec.section_order as number,
      body: sec.body as string,
      material_title: (mat?.title as string) ?? "Unknown",
      material_type: (mat?.type as string) ?? "",
      material_url: (mat?.source_url as string) ?? null,
      material_video_url: (mat?.video_url as string) ?? null,
      material_ingest_status: (mat?.ingest_status as string) ?? "",
    });
  }

  // Group by material
  const byMaterial = new Map<string, Section[]>();
  for (const sec of sections) {
    const existing = byMaterial.get(sec.material_title) ?? [];
    existing.push(sec);
    byMaterial.set(sec.material_title, existing);
  }
  // Sort sections within each material
  for (const secs of byMaterial.values()) {
    secs.sort((a, b) => a.section_order - b.section_order);
  }

  const task = ability.tasks as { name: string; domain_id: string };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/domains/${task.domain_id}`}
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          &larr; {task.domain_id} &middot; {task.name}
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <Badge variant="outline" className="font-mono">
            {ability.code}
          </Badge>
          <h1 className="text-xl font-bold tracking-tight">{ability.name}</h1>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          {sections.length} section{sections.length !== 1 ? "s" : ""} across{" "}
          {byMaterial.size} material{byMaterial.size !== 1 ? "s" : ""}
        </p>
      </div>

      {byMaterial.size === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-zinc-500">
            <p className="text-lg font-medium">No content sections yet</p>
            <p className="mt-1 text-sm">
              This ability is covered by external video materials — check the
              materials list for links.
            </p>
          </CardContent>
        </Card>
      ) : (
        [...byMaterial.entries()].map(([title, secs]) => {
          const first = secs[0];
          return (
            <Card key={title}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      first.material_type === "PDF"
                        ? "border-blue-300 text-blue-700"
                        : first.material_type === "VIDEO"
                          ? "border-red-300 text-red-700"
                          : "border-green-300 text-green-700"
                    }
                  >
                    {first.material_type}
                  </Badge>
                  <CardTitle className="text-base">{title}</CardTitle>
                </div>
                {first.material_url && (
                  <a
                    href={first.material_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    View source &rarr;
                  </a>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {secs.map((sec) => (
                    <div
                      key={sec.id}
                      className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <p className="mb-2 text-xs font-medium text-zinc-400">
                        Section {sec.section_order}
                      </p>
                      <div className="prose prose-sm prose-zinc max-w-none dark:prose-invert whitespace-pre-wrap">
                        {sec.body}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
