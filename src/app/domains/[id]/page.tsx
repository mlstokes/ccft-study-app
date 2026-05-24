import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

async function getDomain(id: string) {
  const { data, error } = await supabase
    .from("domains")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data;
}

async function getTasks(domainId: string) {
  const { data, error } = await supabase
    .from("tasks")
    .select("*, abilities(*, content_section_abilities(count))")
    .eq("domain_id", domainId)
    .order("sort_order")
    .order("sort_order", { referencedTable: "abilities" });

  if (error) throw error;
  return data;
}

export const revalidate = 3600;

export default async function DomainPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const domain = await getDomain(id);
  if (!domain) notFound();

  const tasks = await getTasks(id);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          &larr; All Domains
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <Badge variant="outline" className="text-base">
            {domain.id}
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight">{domain.name}</h1>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          {domain.exam_items} exam items &middot; {domain.exam_weight}% of exam
        </p>
      </div>

      <div className="space-y-4">
        {tasks.map(
          (task: {
            id: string;
            code: string;
            name: string;
            abilities: {
              id: string;
              code: string;
              name: string;
              content_section_abilities: { count: number }[];
            }[];
          }) => (
            <Card key={task.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  <span className="font-mono text-zinc-400">{task.code}</span>{" "}
                  {task.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {task.abilities.map(
                    (ability: {
                      id: string;
                      code: string;
                      name: string;
                      content_section_abilities: { count: number }[];
                    }) => {
                      const sectionCount =
                        ability.content_section_abilities[0]?.count ?? 0;
                      return (
                        <li key={ability.id}>
                          <Link
                            href={`/abilities/${ability.id}`}
                            className="flex gap-3 text-sm leading-relaxed rounded-md px-2 py-1 -mx-2 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          >
                            <span className="shrink-0 font-mono text-xs text-zinc-400 pt-0.5">
                              {ability.code}
                            </span>
                            <span className="flex-1 text-zinc-700 dark:text-zinc-300">
                              {ability.name}
                            </span>
                            <span className="shrink-0 text-xs text-zinc-400 pt-0.5">
                              {sectionCount > 0
                                ? `${sectionCount} sec`
                                : "—"}
                            </span>
                          </Link>
                        </li>
                      );
                    }
                  )}
                </ul>
              </CardContent>
            </Card>
          )
        )}
      </div>
    </div>
  );
}
