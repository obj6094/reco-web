"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

type BestReco = {
  id: string;
  prompt: string;
  created_at: string;
  trackName: string;
  artistName: string;
};

export default function BestRecosPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<BestReco[]>([]);

  useEffect(() => {
    async function load() {
      const { data: reqs } = await supabase
        .from("qna_requests")
        .select("id, prompt, best_answer_id, created_at")
        .not("best_answer_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(50);

      const ids = (reqs ?? []).map((r: any) => r.best_answer_id).filter(Boolean);
      if (!ids.length) {
        setItems([]);
        setLoading(false);
        return;
      }

      const { data: answers } = await supabase
        .from("qna_answers")
        .select("id, spotify_track_name, spotify_artist_name")
        .in("id", ids);

      const byId: Record<string, any> = {};
      (answers ?? []).forEach((a: any) => {
        byId[a.id] = a;
      });

      const merged =
        reqs?.map((r: any) => {
          const ans = byId[r.best_answer_id];
          if (!ans) return null;
          return {
            id: r.id,
            prompt: r.prompt,
            created_at: r.created_at,
            trackName: ans.spotify_track_name,
            artistName: ans.spotify_artist_name,
          };
        }).filter((row): row is BestReco => row !== null) ?? [];

      setItems(merged);
      setLoading(false);
    }

    load();
  }, []);

  return (
    <main className="min-h-[calc(100vh-56px)] bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-4xl space-y-4">
        <Button variant="ghost" asChild className="px-0">
          <Link href="/requests">
            <ArrowLeft className="h-4 w-4" />
            Back to requests
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Best Recos</CardTitle>
            <CardDescription>All selected best recommendations.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-muted-foreground">No best recos yet.</div>
            ) : (
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.id} className="rounded-xl border border-border bg-accent/30 px-3 py-3">
                    <div className="text-sm font-semibold">{item.prompt}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.trackName} - {item.artistName}
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
