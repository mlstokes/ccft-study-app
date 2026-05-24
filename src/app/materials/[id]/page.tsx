import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

async function getMaterial(id: string) {
  const { data, error } = await supabase
    .from("study_materials")
    .select(
      "*, study_material_domains(domain_id), study_material_courses(course)"
    )
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data;
}

async function getSections(materialId: string) {
  // Paginate to get all sections (Supabase default limit is 1000)
  const allSections: Record<string, unknown>[] = [];
  let offset = 0;
  const PAGE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("content_sections")
      .select(
        "id, section_order, body, split_logic, content_section_abilities(ability_id)"
      )
      .eq("material_id", materialId)
      .order("section_order")
      .range(offset, offset + PAGE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    allSections.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  return allSections;
}

export const revalidate = 3600;

export default async function MaterialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const material = await getMaterial(id);
  if (!material) notFound();

  const sections = await getSections(id);

  const domains = (
    material.study_material_domains as { domain_id: string }[]
  ).map((d) => d.domain_id);
  const courses = (
    material.study_material_courses as { course: string }[]
  ).map((c) => c.course);

  const isExternal = material.ingest_status === "external";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/materials"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          &larr; All Materials
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          {material.title}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={
              material.type === "PDF"
                ? "border-blue-300 text-blue-700"
                : material.type === "VIDEO"
                  ? "border-red-300 text-red-700"
                  : "border-green-300 text-green-700"
            }
          >
            {material.type}
          </Badge>
          {domains.map((d: string) => (
            <Badge key={d} variant="secondary" className="text-xs">
              {d}
            </Badge>
          ))}
          {courses.map((c: string) => (
            <Badge
              key={c}
              variant="secondary"
              className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
            >
              {c}
            </Badge>
          ))}
          {material.is_supplemental && (
            <Badge
              variant="secondary"
              className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
            >
              Supplemental
            </Badge>
          )}
        </div>
        {material.author && (
          <p className="mt-1 text-sm text-zinc-500">{material.author}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-3 text-sm text-zinc-500">
          {material.source_url && (
            <a
              href={material.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              View source &rarr;
            </a>
          )}
          {material.video_url && (
            <a
              href={material.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-600 hover:underline"
            >
              Watch on YouTube &rarr;
            </a>
          )}
        </div>
      </div>

      {isExternal ? (
        <Card>
          <CardContent className="py-12 text-center text-zinc-500">
            <p className="text-lg font-medium">External Content</p>
            <p className="mt-1 text-sm">
              This material&apos;s content is hosted externally. Use the links
              above to study it directly.
            </p>
          </CardContent>
        </Card>
      ) : sections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-zinc-500">
            <p className="text-lg font-medium">No sections available</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-zinc-500">
            {sections.length} section{sections.length !== 1 ? "s" : ""}
          </p>
          {sections.map(
            (section: Record<string, unknown>) => {
              const abilities = (
                section.content_section_abilities as {
                  ability_id: string;
                }[]
              ).map((a) => a.ability_id);

              return (
                <Card key={section.id as string}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-zinc-400">
                        Section {section.section_order as number}
                      </CardTitle>
                      <div className="flex gap-1">
                        {abilities.map((a) => (
                          <Link key={a} href={`/abilities/${a}`}>
                            <Badge
                              variant="secondary"
                              className="text-xs font-mono cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700"
                            >
                              {a}
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm prose-zinc max-w-none dark:prose-invert whitespace-pre-wrap">
                      {section.body as string}
                    </div>
                  </CardContent>
                </Card>
              );
            }
          )}
        </div>
      )}
    </div>
  );
}
