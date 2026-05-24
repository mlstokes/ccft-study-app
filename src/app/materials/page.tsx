import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

async function getMaterials() {
  const { data, error } = await supabase
    .from("study_materials")
    .select(
      "*, study_material_domains(domain_id), study_material_courses(course)"
    )
    .order("title");

  if (error) throw error;
  return data;
}

export const revalidate = 3600;

type Material = {
  id: string;
  title: string;
  author: string | null;
  type: string;
  source_url: string | null;
  video_url: string | null;
  ingest_status: string;
  section_count: number;
  is_supplemental: boolean;
  study_material_domains: { domain_id: string }[];
  study_material_courses: { course: string }[];
};

export default async function MaterialsPage() {
  const materials = (await getMaterials()) as Material[];

  const ingested = materials.filter((m) => m.ingest_status === "ingested");
  const external = materials.filter((m) => m.ingest_status === "external");
  const failed = materials.filter((m) => m.ingest_status === "failed");
  const totalSections = materials.reduce(
    (sum, m) => sum + (m.section_count || 0),
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Study Materials</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {materials.length} materials &middot; {totalSections} sections
          &middot; {ingested.length} ingested &middot; {external.length}{" "}
          external &middot; {failed.length} failed
        </p>
      </div>

      <div className="space-y-3">
        {materials.map((material) => (
          <Link key={material.id} href={`/materials/${material.id}`}>
            <Card className="transition-colors hover:border-zinc-400 dark:hover:border-zinc-600 mb-3">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 flex-wrap">
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
                  {material.study_material_domains.map((d) => (
                    <Badge
                      key={d.domain_id}
                      variant="secondary"
                      className="text-xs"
                    >
                      {d.domain_id}
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
                  {material.ingest_status === "external" && (
                    <Badge
                      variant="secondary"
                      className="text-xs bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200"
                    >
                      External
                    </Badge>
                  )}
                  {material.ingest_status === "failed" && (
                    <Badge
                      variant="secondary"
                      className="text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                    >
                      Failed
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-base">{material.title}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>{material.author ?? ""}</span>
                  <span>
                    {material.section_count > 0
                      ? `${material.section_count} sections`
                      : material.ingest_status === "external"
                        ? "External content"
                        : ""}
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
