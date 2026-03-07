"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

type PastItem = {
  id: string;
  prompt: string;
  starts_at: string | null;
};

export default function PastChallengesPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PastItem[]>([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("weekly_challenges")
        .select("id, prompt, starts_at")
        .order("starts_at", { ascending: false });

      setItems((data ?? []) as PastItem[]);
      setLoading(false);
    }

    load();
  }, []);

  return (
    <main className="min-h-[calc(100vh-56px)] bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-4xl space-y-4">
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
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.id} className="rounded-xl border border-border bg-accent/30 px-3 py-3">
                    <div className="font-medium">{item.prompt}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.starts_at ? new Date(item.starts_at).toLocaleDateString() : "-"}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
