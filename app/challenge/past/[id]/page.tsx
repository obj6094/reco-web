"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubmissionCard, type SubmissionCardData } from "@/components/SubmissionCard";
import { ArrowLeft, Trophy } from "lucide-react";

type PastChallenge = {
  id: string;
  prompt: string;
  starts_at: string | null;
  ends_at: string | null;
};

type PastSubmission = {
  id: string;
  user_id: string;
  trackName: string;
  artistName: string;
  albumImage: string | null;
  comment: string | null;
  spotify_track_id: string | null;
  voteCount: number;
  submitterNickname: string | null;
  submitterUsername: string | null;
};

export default function PastChallengeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const challengeId = params?.id as string | undefined;

  const [challenge, setChallenge] = useState<PastChallenge | null>(null);
  const [submissions, setSubmissions] = useState<PastSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!challengeId) return;

    async function load() {
      setLoading(true);
      setStatus("");

      const { data: challengeRow, error: challengeError } = await supabase
        .from("weekly_challenges")
        .select("id, prompt, starts_at, ends_at")
        .eq("id", challengeId)
        .maybeSingle();

      if (challengeError || !challengeRow) {
        setStatus("Failed to load challenge.");
        setChallenge(null);
        setSubmissions([]);
        setLoading(false);
        return;
      }

      setChallenge({
        id: challengeRow.id as string,
        prompt: challengeRow.prompt as string,
        starts_at: (challengeRow.starts_at as string | null) ?? null,
        ends_at: (challengeRow.ends_at as string | null) ?? null,
      });

      const { data: subRows, error: subError } = await supabase
        .from("challenge_submissions")
        .select(
          "id, user_id, spotify_track_id, spotify_track_name, spotify_artist_name, spotify_album_image_url, comment, challenge_votes(id)",
        )
        .eq("challenge_id", challengeRow.id);

      if (subError) {
        setStatus("Failed to load submissions: " + subError.message);
        setSubmissions([]);
        setLoading(false);
        return;
      }

      const base: Omit<PastSubmission, "submitterNickname" | "submitterUsername">[] =
        subRows?.map((row: any) => ({
          id: row.id as string,
          user_id: row.user_id as string,
          trackName: row.spotify_track_name as string,
          artistName: row.spotify_artist_name as string,
          albumImage: (row.spotify_album_image_url as string | null) ?? null,
          comment: (row.comment as string | null) ?? null,
          spotify_track_id: (row.spotify_track_id as string | null) ?? null,
          voteCount: (row.challenge_votes ?? []).length,
        })) ?? [];

      const userIds = [...new Set(base.map((r) => r.user_id).filter(Boolean))] as string[];
      let profileMap: Record<string, { nickname: string | null; username: string | null }> = {};
      if (userIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, nickname")
          .in("id", userIds);
        (profiles ?? []).forEach((p: any) => {
          profileMap[p.id as string] = {
            nickname: (p.nickname as string | null) ?? null,
            username: (p.username as string | null) ?? null,
          };
        });
      }

      const mapped: PastSubmission[] = base.map((r) => ({
        ...r,
        submitterNickname: profileMap[r.user_id]?.nickname ?? null,
        submitterUsername: profileMap[r.user_id]?.username ?? null,
      }));

      mapped.sort((a, b) => {
        if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
        return 0;
      });

      // Top 5 submissions by votes
      setSubmissions(mapped.slice(0, 5));
      setLoading(false);
    }

    load();
  }, [challengeId]);

  const dateRange = useMemo(() => {
    if (!challenge?.starts_at || !challenge.ends_at) return "";
    const start = new Date(challenge.starts_at);
    const end = new Date(challenge.ends_at);
    return `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`;
  }, [challenge]);

  if (!challengeId) {
    if (typeof window !== "undefined") router.replace("/challenge/past");
    return null;
  }

  return (
    <main className="min-h-[calc(100dvh-120px)] bg-background px-3 py-6 text-foreground sm:px-4 sm:py-8 md:py-10">
      <div className="mx-auto w-full max-w-5xl space-y-5 sm:space-y-6">
        <Button variant="ghost" asChild className="px-0">
          <Link href="/challenge/past">
            <ArrowLeft className="h-4 w-4" />
            Back to past challenges
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              Past Challenge
            </CardTitle>
            {challenge ? (
              <CardDescription>
                {dateRange ? `${dateRange} ·` : ""} Top 5 submissions for this challenge.
              </CardDescription>
            ) : (
              <CardDescription>Loading challenge details…</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {challenge ? (
              <div className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Theme
                </p>
                <p className="mt-1 text-sm font-semibold leading-snug tracking-tight sm:text-base break-words">
                  {challenge.prompt}
                </p>
              </div>
            ) : null}

            {loading ? (
              <div className="text-sm text-muted-foreground">Loading submissions…</div>
            ) : submissions.length === 0 ? (
              <div className="text-sm text-muted-foreground">No submissions for this challenge.</div>
            ) : (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 min-w-0 overflow-hidden">
                {submissions.map((s, index) => {
                  const data: SubmissionCardData = {
                    id: s.id,
                    trackName: s.trackName,
                    artistName: s.artistName,
                    albumImage: s.albumImage,
                    comment: s.comment,
                    voteCount: s.voteCount,
                    spotify_track_id: s.spotify_track_id,
                    submitterNickname: s.submitterNickname,
                    submitterUsername: s.submitterUsername,
                  };
                  return (
                    <li key={s.id} className="min-w-0">
                      <SubmissionCard
                        submission={data}
                        canVote={false}
                        variant="compact"
                        rank={index + 1}
                        className="min-w-0 overflow-hidden"
                      />
                    </li>
                  );
                })}
              </ul>
            )}

            {status ? (
              <div className="rounded-2xl border border-border bg-accent px-4 py-3 text-sm">
                {status}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

