import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

async function getMaterials() {
  const { data, error } = await supabase
    .from("study_materials")
    .select("*, study_material_domains(domain_id)")
    .order("title");

  if (error) throw error;
  return data;
}

export const revalidate = 3600;

export default async function MaterialsPage() {
  const materials = await getMaterials();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Study Materials</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {materials.length} resources cataloged &middot; Phase 2 will populate
          this from the CCFT Study Material Reference List
        </p>
      </div>

      {materials.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-zinc-500">
            <p className="text-lg font-medium">No materials ingested yet</p>
            <p className="mt-1 text-sm">
              The study material catalog will be populated during Phase 2:
              Content Discovery &amp; Ingestion.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {materials.map(
            (material: {
              id: string;
              title: string;
              author: string | null;
              type: string;
              source_url: string | null;
              study_material_domains: { domain_id: string }[];
            }) => (
              <Card key={material.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
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
                    {material.study_material_domains.map(
                      (d: { domain_id: string }) => (
                        <Badge key={d.domain_id} variant="secondary" className="text-xs">
                          {d.domain_id}
                        </Badge>
                      )
                    )}
                  </div>
                  <CardTitle className="text-base">{material.title}</CardTitle>
                </CardHeader>
                {material.author && (
                  <CardContent className="pt-0">
                    <p className="text-sm text-zinc-500">{material.author}</p>
                  </CardContent>
                )}
              </Card>
            )
          )}
        </div>
      )}
    </div>
  );
}
