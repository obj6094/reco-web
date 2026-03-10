"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getDisplayName } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { SubmissionCard, type SubmissionCardData } from "@/components/SubmissionCard";

type Submission = {
  id: string;
  user_id: string;
  spotify_track_id: string | null;
  trackName: string;
  artistName: string;
  albumImage: string | null;
  comment: string | null;
  voteCount: number;
  created_at: string;
  viewerVoted: boolean;
  isMine: boolean;
  submitterNickname: string | null;
  submitterUsername: string | null;
};

export default function ChallengeSubmissionsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"votes" | "recent">("votes");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [votingOnId, setVotingOnId] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    async function boot() {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      setUserId(uid);
      setAuthChecked(true);

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

      const { data, error } = await supabase
        .from("challenge_submissions")
        .select(
          "id, challenge_id, user_id, spotify_track_id, spotify_track_name, spotify_artist_name, spotify_album_image_url, comment, created_at, challenge_votes(id, voter_id)"
        )
        .eq("challenge_id", challenge.id);

      if (error) {
        setStatus("Failed to load submissions: " + error.message);
        setSubmissions([]);
        setLoading(false);
        return;
      }

      const rawBase =
        data?.map((row: any) => {
          const votes = row.challenge_votes ?? [];
          const voteCount = votes.length;
          const viewerVoted = !!uid && votes.some((v: any) => v.voter_id === uid);
          return {
            id: row.id as string,
            user_id: row.user_id as string,
            spotify_track_id: (row.spotify_track_id as string | null) ?? null,
            trackName: row.spotify_track_name as string,
            artistName: row.spotify_artist_name as string,
            albumImage: (row.spotify_album_image_url as string | null) ?? null,
            comment: (row.comment as string | null) ?? null,
            created_at: row.created_at as string,
            voteCount,
            viewerVoted,
            isMine: !!uid && row.user_id === uid,
          };
        }) ?? [];

      const userIds = [...new Set(rawBase.map((r) => r.user_id).filter(Boolean))] as string[];
      let profileMap: Record<string, { nickname: string | null; username: string | null }> = {};
      if (userIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, nickname")
          .in("id", userIds);
        profiles?.forEach((p: any) => {
          profileMap[p.id as string] = {
            nickname: (p.nickname as string | null) ?? null,
            username: (p.username as string | null) ?? null,
          };
        });
      }

      const mapped: Submission[] = rawBase.map((r) => ({
        ...r,
        submitterNickname: profileMap[r.user_id]?.nickname ?? null,
        submitterUsername: profileMap[r.user_id]?.username ?? null,
      }));

      mapped.sort((a, b) => {
        if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setSubmissions(mapped);
      setLoading(false);
    }

    boot();
  }, []);

  function sortSubmissions(list: Submission[]) {
    return [...list].sort((a, b) => {
      if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }

  const sorted = useMemo(() => {
    if (sortBy === "votes") {
      return sortSubmissions(submissions);
    }
    return [...submissions].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [submissions, sortBy]);

  async function toggleVote(submission: Submission) {
    setStatus("");

    if (!userId) {
      router.replace("/login");
      return;
    }

    if (submission.isMine) {
      setStatus("You cannot vote for your own submission.");
      return;
    }

    setVotingOnId(submission.id);

    const before = submissions;
    const optimistic = sortSubmissions(
      submissions.map((s) => {
        if (s.id !== submission.id) return s;
        const nextVoted = !s.viewerVoted;
        return {
          ...s,
          viewerVoted: nextVoted,
          voteCount: Math.max(0, s.voteCount + (nextVoted ? 1 : -1)),
        };
      })
    );
    setSubmissions(optimistic);

    try {
      if (submission.viewerVoted) {
        const { error } = await supabase
          .from("challenge_votes")
          .delete()
          .eq("submission_id", submission.id)
          .eq("voter_id", userId);

        if (error) {
          setSubmissions(before);
          setStatus("Failed to remove vote: " + error.message);
        }
      } else {
        const { data: ownerRow, error: ownerError } = await supabase
          .from("challenge_submissions")
          .select("user_id")
          .eq("id", submission.id)
          .single();

        if (ownerError) {
          setSubmissions(before);
          setStatus("Vote error: " + ownerError.message);
          return;
        }

        if (ownerRow?.user_id === userId) {
          setSubmissions(before);
          setStatus("You cannot vote for your own submission.");
          return;
        }

        const { error } = await supabase.from("challenge_votes").insert({
          submission_id: submission.id,
          voter_id: userId,
        });

        if (error) {
          setSubmissions(before);
          setStatus("Vote failed: " + error.message);
        }
      }
    } finally {
      setVotingOnId(null);
    }
  }

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
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {sorted.map((s) => {
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
                    isMine: s.isMine,
                    viewerVoted: s.viewerVoted,
                  };
                  return (
                    <li key={s.id}>
                      <SubmissionCard
                        submission={data}
                        canVote
                        onVote={() => toggleVote(s)}
                        voting={votingOnId === s.id}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
            {status ? (
              <div className="mt-4 rounded-2xl border border-border bg-accent px-4 py-3 text-sm">
                {status}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
