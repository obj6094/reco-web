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
  requesterName: string;
  responderName: string;
  requesterSlug: string;
  responderSlug: string;
};

export default function BestRecosPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<BestReco[]>([]);

  useEffect(() => {
    async function load() {
      const { data: reqs } = await supabase
        .from("qna_requests")
        .select("id, prompt, best_answer_id, created_at, requester_id")
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
        .select("id, responder_id, spotify_track_name, spotify_artist_name")
        .in("id", ids);

      const byId: Record<string, any> = {};
      (answers ?? []).forEach((a: any) => {
        byId[a.id] = a;
      });

      const profileIds = Array.from(
        new Set(
          (reqs ?? []).map((r: any) => r.requester_id).filter(Boolean).concat(
            (answers ?? []).map((a: any) => a.responder_id).filter(Boolean)
          )
        )
      );
      const profileMap: Record<string, { nickname: string | null; username: string | null }> = {};
      if (profileIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nickname, username")
          .in("id", profileIds);
        (profiles ?? []).forEach((p: any) => {
          profileMap[p.id] = { nickname: p.nickname ?? null, username: p.username ?? null };
        });
      }
      const getDisplayName = (nick: string | null, user: string | null) =>
        (nick?.trim() || user?.trim() || "user");

      const merged =
        reqs?.map((r: any) => {
          const ans = byId[r.best_answer_id];
          if (!ans) return null;
          const reqProfile = profileMap[r.requester_id];
          const resProfile = profileMap[ans.responder_id];
          return {
            id: r.id,
            prompt: r.prompt,
            created_at: r.created_at,
            trackName: ans.spotify_track_name,
            artistName: ans.spotify_artist_name,
            requesterName: getDisplayName(reqProfile?.nickname, reqProfile?.username),
            responderName: getDisplayName(resProfile?.nickname, resProfile?.username),
            requesterSlug: (reqProfile?.nickname ?? reqProfile?.username ?? "user").trim(),
            responderSlug: (resProfile?.nickname ?? resProfile?.username ?? "user").trim(),
          };
        }).filter((row): row is BestReco => row !== null) ?? [];

      setItems(merged);
      setLoading(false);
    }

    load();
  }, []);

  return (
    <main className="min-h-[calc(100dvh-120px)] bg-background px-3 py-6 text-foreground sm:px-4 sm:py-8 md:py-10">
      <div className="mx-auto w-full max-w-4xl space-y-4">
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
                  <li key={item.id} className="rounded-xl border border-border/80 bg-muted/30 px-3 py-3">
                    <div className="break-words text-sm font-semibold">{item.prompt}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {item.trackName} - {item.artistName}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1.5 space-y-0.5">
                      <span>Request by{" "}
                        <Link href={`/u/${encodeURIComponent(item.requesterSlug)}`} className="text-primary hover:underline">
                          @{item.requesterName}
                        </Link>
                      </span>
                      <span className="block">Best Reco by{" "}
                        <Link href={`/u/${encodeURIComponent(item.responderSlug)}`} className="text-primary hover:underline">
                          @{item.responderName}
                        </Link>
                      </span>
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
