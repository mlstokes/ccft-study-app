import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

async function getDomains() {
  const { data, error } = await supabase
    .from("domains")
    .select("*, abilities(count)")
    .order("sort_order");

  if (error) throw error;
  return data;
}

export const revalidate = 3600; // revalidate every hour

export default async function Home() {
  const domains = await getDomains();

  const totalItems = domains.reduce(
    (sum: number, d: { exam_items: number }) => sum + d.exam_items,
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">CCFT Exam Domains</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          7 domains, {totalItems} scored items, 3 hours 55 minutes
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {domains.map(
          (domain: {
            id: string;
            code: string;
            name: string;
            exam_items: number;
            exam_weight: number;
            abilities: { count: number }[];
          }) => (
            <Link key={domain.id} href={`/domains/${domain.id}`}>
              <Card className="h-full transition-colors hover:border-zinc-400 dark:hover:border-zinc-600">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{domain.id}</Badge>
                    <span className="text-sm font-semibold text-zinc-500">
                      {domain.exam_weight}%
                    </span>
                  </div>
                  <CardTitle className="text-base leading-tight">
                    {domain.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Progress value={domain.exam_weight} className="mb-2" />
                  <div className="flex justify-between text-xs text-zinc-500">
                    <span>{domain.exam_items} exam items</span>
                    <span>{domain.abilities[0]?.count ?? 0} abilities</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        )}
      </div>
    </div>
  );
}
