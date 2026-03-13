"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";

type PastItem = {
  id: string;
  prompt: string;
  starts_at: string | null;
  ends_at: string | null;
};

export default function PastChallengesPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PastItem[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    async function load() {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("weekly_challenges")
        .select("id, prompt, starts_at, ends_at")
        .lt("ends_at", now)
        .order("starts_at", { ascending: false });

      setItems((data ?? []) as PastItem[]);
      setLoading(false);
    }

    load();
  }, []);

  const displayItems = showAll ? items : items.slice(0, 4);
  const hasMore = items.length > 4;

  return (
    <main className="min-h-[calc(100dvh-120px)] bg-background px-3 py-6 text-foreground sm:px-4 sm:py-8 md:py-10">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <Button variant="ghost" asChild className="px-0">
          <Link href="/challenge">
            <ArrowLeft className="h-4 w-4" />
            Back to challenge
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Past challenges</CardTitle>
            <CardDescription>All recorded challenge prompts.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-muted-foreground">No past challenges yet.</div>
            ) : (
              <>
                <ul className="space-y-2">
                  {displayItems.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/challenge/past/${item.id}`}
                        className="block rounded-xl border border-border bg-accent/30 px-3 py-3 hover:bg-accent/40 transition-colors"
                      >
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                          <div className="text-sm font-semibold break-words sm:max-w-[70%]">
                            {item.prompt}
                          </div>
                          <div className="text-xs text-muted-foreground sm:text-right">
                            {item.starts_at && item.ends_at
                              ? `${new Date(item.starts_at).toLocaleDateString()} – ${new Date(
                                  item.ends_at,
                                ).toLocaleDateString()}`
                              : "-"}
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
                {hasMore ? (
                  <div className="mt-4 flex justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAll((prev) => !prev)}
                      className="gap-2"
                    >
                      {showAll ? (
                        <>
                          <ChevronUp className="h-4 w-4" />
                          Show less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          Show more ({items.length} total)
                        </>
                      )}
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
