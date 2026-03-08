"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";

type SubmissionRow = {
  id: string;
  trackName: string;
  artistName: string;
  voteCount: number;
  created_at: string;
};

export default function ChallengeSubmissionsPage() {
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"votes" | "recent">("votes");
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);

  useEffect(() => {
    async function load() {
      const { data: challenge } = await supabase
        .from("weekly_challenges")
        .select("id")
        .order("starts_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!challenge?.id) {
        setSubmissions([]);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("challenge_submissions")
        .select("id, spotify_track_name, spotify_artist_name, created_at, challenge_votes(id)")
        .eq("challenge_id", challenge.id);

      const mapped: SubmissionRow[] =
        data?.map((row: any) => ({
          id: row.id,
          trackName: row.spotify_track_name,
          artistName: row.spotify_artist_name,
          created_at: row.created_at,
          voteCount: (row.challenge_votes ?? []).length,
        })) ?? [];
      setSubmissions(mapped);
      setLoading(false);
    }

    load();
  }, []);

  const sorted = useMemo(() => {
    if (sortBy === "votes") {
      return [...submissions].sort((a, b) => b.voteCount - a.voteCount);
    }
    return [...submissions].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [submissions, sortBy]);

  return (
    <main className="min-h-[calc(100dvh-120px)] bg-background px-3 py-6 text-foreground sm:px-4 sm:py-8 md:py-10">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <Button variant="ghost" asChild className="px-0">
          <Link href="/challenge">
            <ArrowLeft className="h-4 w-4" />
            Back to challenge
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>All submissions</CardTitle>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={sortBy === "votes" ? "default" : "outline"}
                  onClick={() => setSortBy("votes")}
                >
                  Most Voted
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={sortBy === "recent" ? "default" : "outline"}
                  onClick={() => setSortBy("recent")}
                >
                  Most Recent
                </Button>
              </div>
            </div>
            <CardDescription>Full standings for this week.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : sorted.length === 0 ? (
              <div className="text-sm text-muted-foreground">No submissions yet.</div>
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {sorted.map((s) => (
                  <li key={s.id} className="rounded-xl border border-border bg-accent/30 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{s.trackName}</div>
                        <div className="truncate text-xs text-muted-foreground">{s.artistName}</div>
                      </div>
                      <Badge variant="secondary">{s.voteCount} votes</Badge>
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
