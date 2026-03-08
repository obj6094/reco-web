"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

type Item = {
  request_id: string;
  created_at: string;
  prompt: string;
  trackName: string;
  artistName: string;
  mode: "answer" | "nice_reco";
};

export default function MyAnswersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        router.replace("/login");
        return;
      }

      const { data: answerRows } = await supabase
        .from("qna_answers")
        .select("request_id, created_at, spotify_track_name, spotify_artist_name")
        .eq("responder_id", uid)
        .order("created_at", { ascending: false });

      const { data: ratingRows } = await supabase
        .from("qna_ratings")
        .select("answer_id, created_at")
        .eq("rater_id", uid)
        .eq("score", 1)
        .order("created_at", { ascending: false });

      const ratedAnswerIds = [...new Set((ratingRows ?? []).map((r: any) => r.answer_id).filter(Boolean))] as string[];
      let ratedAnswerMap: Record<string, { request_id: string; trackName: string; artistName: string }> = {};
      if (ratedAnswerIds.length) {
        const { data: ratedAnswers } = await supabase
          .from("qna_answers")
          .select("id, request_id, spotify_track_name, spotify_artist_name")
          .in("id", ratedAnswerIds);
        (ratedAnswers ?? []).forEach((row: any) => {
          ratedAnswerMap[row.id as string] = {
            request_id: row.request_id,
            trackName: row.spotify_track_name ?? "Unknown track",
            artistName: row.spotify_artist_name ?? "Unknown artist",
          };
        });
      }

      const mergedRows: Item[] = [];
      (answerRows ?? []).forEach((row: any) => {
        mergedRows.push({
          request_id: row.request_id,
          created_at: row.created_at,
          prompt: "",
          trackName: row.spotify_track_name ?? "Unknown track",
          artistName: row.spotify_artist_name ?? "Unknown artist",
          mode: "answer",
        });
      });
      (ratingRows ?? []).forEach((row: any) => {
        const rated = ratedAnswerMap[row.answer_id];
        if (!rated) return;
        mergedRows.push({
          request_id: rated.request_id,
          created_at: row.created_at,
          prompt: "",
          trackName: rated.trackName,
          artistName: rated.artistName,
          mode: "nice_reco",
        });
      });

      const reqIds = [...new Set(mergedRows.map((r) => r.request_id))];
      if (!reqIds.length) {
        setItems([]);
        setLoading(false);
        return;
      }

      const { data: reqs } = await supabase
        .from("qna_requests")
        .select("id, prompt")
        .in("id", reqIds);

      const byId: Record<string, string> = {};
      (reqs ?? []).forEach((r: any) => {
        byId[r.id] = r.prompt;
      });

      const seen = new Set<string>();
      const mapped: Item[] = mergedRows
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .filter((row) => {
          if (seen.has(row.request_id)) return false;
          seen.add(row.request_id);
          return true;
        })
        .map((row) => ({
          request_id: row.request_id,
          created_at: row.created_at,
          prompt: byId[row.request_id] ?? "",
          trackName: row.trackName,
          artistName: row.artistName,
          mode: row.mode,
        }));

      setItems(mapped);
      setLoading(false);
    }

    load();
  }, [router]);

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
            <CardTitle>My answers</CardTitle>
            <CardDescription>All requests you answered.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-muted-foreground">No answers yet.</div>
            ) : (
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.request_id}>
                    <Link href={`/requests/${item.request_id}`} className="block">
                      <Card className="cursor-pointer transition-colors hover:bg-accent/40">
                        <CardContent className="py-3">
                          <div className="text-[15px] font-semibold leading-relaxed tracking-tight">{item.prompt}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {item.mode === "answer" ? "My Reco" : "My Nice Reco"}: {item.trackName} - {item.artistName}
                          </div>
                          <div className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</div>
                        </CardContent>
                      </Card>
                    </Link>
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
