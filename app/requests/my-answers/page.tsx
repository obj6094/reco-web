"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getDisplayName } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, formatDateTime } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

type Item = {
  request_id: string;
  created_at: string;
  prompt: string;
  trackName: string;
  artistName: string;
  mode: "answer" | "nice_reco";
  isSelected?: boolean;
  requesterName: string;
  requesterSlug: string;
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
        .select("id, request_id, created_at, spotify_track_name, spotify_artist_name")
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

      const mergedRows: { request_id: string; created_at: string; prompt: string; trackName: string; artistName: string; mode: "answer" | "nice_reco"; answer_id?: string }[] = [];
      (answerRows ?? []).forEach((row: any) => {
        mergedRows.push({
          request_id: row.request_id,
          created_at: row.created_at,
          prompt: "",
          trackName: row.spotify_track_name ?? "Unknown track",
          artistName: row.spotify_artist_name ?? "Unknown artist",
          mode: "answer",
          answer_id: row.id,
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
        .select("id, prompt, best_answer_id, requester_id")
        .in("id", reqIds);

      const byId: Record<string, { prompt: string; best_answer_id: string | null; requester_id: string }> = {};
      (reqs ?? []).forEach((r: any) => {
        byId[r.id] = { prompt: r.prompt, best_answer_id: r.best_answer_id ?? null, requester_id: r.requester_id };
      });

      const requesterIds = [...new Set(Object.values(byId).map((r) => r.requester_id).filter(Boolean))];
      let requesterMap: Record<string, { name: string; slug: string }> = {};
      if (requesterIds.length) {
        const { data: profiles } = await supabase.from("profiles").select("id, nickname, username").in("id", requesterIds);
        (profiles ?? []).forEach((p: any) => {
          const slug = ((p.nickname ?? p.username ?? "user") as string).trim() || "user";
          requesterMap[p.id as string] = { name: getDisplayName(p.nickname, p.username), slug };
        });
      }

      const seen = new Set<string>();
      const mapped: Item[] = mergedRows
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .filter((row) => {
          if (seen.has(row.request_id)) return false;
          seen.add(row.request_id);
          return true;
        })
        .map((row) => {
          const req = byId[row.request_id];
          const requester = req ? requesterMap[req.requester_id] : null;
          const isSelected = row.mode === "answer" && row.answer_id && req?.best_answer_id === row.answer_id;
          return {
            request_id: row.request_id,
            created_at: row.created_at,
            prompt: req?.prompt ?? "",
            trackName: row.trackName,
            artistName: row.artistName,
            mode: row.mode,
            isSelected: !!isSelected,
            requesterName: requester?.name ?? "user",
            requesterSlug: requester?.slug ?? "user",
          };
        });

      setItems(mapped);
      setLoading(false);
    }

    load();
  }, [router]);

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
                      <Card
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-accent/40",
                          item.isSelected && "border-primary/60 bg-primary/5"
                        )}
                      >
                        <CardContent className="py-3">
                          <div className="line-clamp-1 truncate text-[15px] font-semibold leading-relaxed tracking-tight">{item.prompt}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            by{" "}
                            <span
                              role="button"
                              tabIndex={0}
                              className="text-primary hover:underline cursor-pointer"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                router.push(`/u/${encodeURIComponent(item.requesterSlug)}`);
                              }}
                              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), router.push(`/u/${encodeURIComponent(item.requesterSlug)}`))}
                            >
                              @{item.requesterName}
                            </span>
                            {" · "}
                            {formatDateTime(item.created_at)}
                          </div>
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
