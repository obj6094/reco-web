"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getDisplayName } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { ArrowLeft, ArrowRight, MessageCircle, Play, Star, Trophy, User } from "lucide-react";

type PublicSubmission = {
  id: string;
  trackName: string;
  artistName: string;
  created_at: string;
  voteCount: number;
};

type PublicAnswer = {
  id: string;
  request_id: string;
  trackName: string;
  artistName: string;
  comment: string | null;
  requestPrompt: string;
  created_at: string;
  albumImage: string | null;
  spotify_track_id: string | null;
};

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const usernameParam = params?.username;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);

  const [recoScore, setRecoScore] = useState<number | null>(null);
  const [bestCount, setBestCount] = useState<number | null>(null);
  const [voteCountTotal, setVoteCountTotal] = useState<number | null>(null);

  const [submissions, setSubmissions] = useState<PublicSubmission[]>([]);
  const [answers, setAnswers] = useState<PublicAnswer[]>([]);
  const [expandedPlayAnswerId, setExpandedPlayAnswerId] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    async function loadProfile() {
      if (!usernameParam) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setLoading(true);
      setStatus("");

      const slug = decodeURIComponent(usernameParam).trim();
      let profile: { id: string; username: string | null; nickname: string | null } | null = null;
      const { data: byNickname, error: errNick } = await supabase
        .from("profiles")
        .select("id, username, nickname")
        .eq("nickname", slug)
        .maybeSingle();
      if (!errNick && byNickname) {
        profile = byNickname;
      } else {
        const { data: byUsername, error: errUser } = await supabase
          .from("profiles")
          .select("id, username, nickname")
          .eq("username", slug)
          .maybeSingle();
        if (!errUser && byUsername) profile = byUsername;
      }

      if (!profile) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const uid = profile.id as string;
      setUserId(uid);
      setNickname(getDisplayName(profile.nickname as string | null, profile.username as string | null));

      // Load challenge submissions for this user
      const { data: subRows, error: subError } = await supabase
        .from("challenge_submissions")
        .select(
          "id, spotify_track_name, spotify_artist_name, created_at, challenge_votes(id)"
        )
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(5);

      if (subError) {
        setStatus("Failed to load submissions: " + subError.message);
      }

      const mappedSubs: PublicSubmission[] =
        subRows?.map((row: any) => ({
          id: row.id,
          trackName: row.spotify_track_name,
          artistName: row.spotify_artist_name,
          created_at: row.created_at,
          voteCount: (row.challenge_votes ?? []).length,
        })) ?? [];

      setSubmissions(mappedSubs);

      // Load QnA answers for this user
      const { data: ansRows, error: ansError } = await supabase
        .from("qna_answers")
        .select("id, request_id, spotify_track_name, spotify_artist_name, spotify_album_image_url, spotify_track_id, comment, created_at")
        .eq("responder_id", uid)
        .order("created_at", { ascending: false })
        .limit(5);

      if (ansError) {
        setStatus("Failed to load QnA answers: " + ansError.message);
      }

      const requestIds = [...new Set((ansRows ?? []).map((r: any) => r.request_id).filter(Boolean))];
      const promptByRequestId: Record<string, string> = {};
      if (requestIds.length) {
        const { data: reqRows } = await supabase
          .from("qna_requests")
          .select("id, prompt")
          .in("id", requestIds);
        (reqRows ?? []).forEach((r: any) => {
          promptByRequestId[r.id as string] = (r.prompt as string) ?? "";
        });
      }

      const mappedAns: PublicAnswer[] =
        ansRows?.map((row: any) => ({
          id: row.id,
          request_id: row.request_id,
          trackName: row.spotify_track_name,
          artistName: row.spotify_artist_name,
          comment: row.comment ?? null,
          requestPrompt: promptByRequestId[row.request_id as string] ?? "",
          created_at: row.created_at,
          albumImage: row.spotify_album_image_url ?? null,
          spotify_track_id: row.spotify_track_id ?? null,
        })) ?? [];

      setAnswers(mappedAns);

      // Calculate Reco Score components
      let bestRecoCount = 0;
      let votesTotal = 0;

      if (mappedAns.length) {
        const answerIds = mappedAns.map((a) => a.id);
        const { data: bestReqRows, error: bestReqError } = await supabase
          .from("qna_requests")
          .select("best_answer_id")
          .in("best_answer_id", answerIds);

        if (!bestReqError) {
          const uniqueBest = new Set(
            (bestReqRows ?? [])
              .map((r: any) => r.best_answer_id)
              .filter((id: string | null) => !!id)
          );
          bestRecoCount = uniqueBest.size;
        }
      }

      if (mappedSubs.length) {
        const submissionIds = mappedSubs.map((s) => s.id);
        const { count, error: voteError } = await supabase
          .from("challenge_votes")
          .select("id", { count: "exact", head: true })
          .in("submission_id", submissionIds);

        if (!voteError) {
          votesTotal = count ?? 0;
        }
      }

      setBestCount(bestRecoCount);
      setVoteCountTotal(votesTotal);
      setRecoScore(bestRecoCount + votesTotal);
      setLoading(false);
    }

    // Public profile is readable without login; RLS must allow it
    loadProfile();
  }, [usernameParam]);

  if (loading) {
    return (
      <main className="min-h-[calc(100vh-56px)] bg-background px-4 py-16 text-foreground">
        <div className="mx-auto max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>Loading profile</CardTitle>
              <CardDescription>Fetching curator information…</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
    );
  }

  if (notFound || !userId) {
    return (
      <main className="min-h-[calc(100vh-56px)] bg-background px-4 py-16 text-foreground">
        <div className="mx-auto max-w-md space-y-4">
          <Button variant="ghost" asChild className="px-0">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to home
            </Link>
          </Button>
          <Card>
            <CardHeader>
              <CardTitle>Profile not found</CardTitle>
              <CardDescription>
                We couldn&apos;t find a curator with that username.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-56px)] bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-4xl space-y-6">
        <Button variant="ghost" asChild className="px-0">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to home
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <span>{nickname || "user"}</span>
            </CardTitle>
            <CardDescription>Curator profile</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">
                Reco Score
              </div>
              <div className="text-3xl font-extrabold text-primary">
                {recoScore ?? 0}
              </div>
              <div className="text-xs text-muted-foreground">
                Best selections: {bestCount ?? 0} · Challenge votes received:{" "}
                {voteCountTotal ?? 0}
              </div>
            </div>
            <Button asChild variant="outline">
              <Link href="/challenge">
                See this week&apos;s challenge <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  Challenge submissions
                </CardTitle>
                <Badge variant="secondary">{submissions.length}</Badge>
              </div>
              <CardDescription>Their recent challenge Recos.</CardDescription>
            </CardHeader>
            <CardContent>
              {submissions.length === 0 ? (
                <EmptyState
                  icon={Trophy}
                  title="No submissions yet"
                  description="This curator has not submitted to challenges yet."
                />
              ) : (
                <div className="space-y-2">
                  {submissions.map((s) => (
                    <Card key={s.id}>
                      <CardContent className="flex items-start justify-between gap-4 p-4">
                        <div className="min-w-0 space-y-1">
                          <div className="truncate text-sm font-semibold">
                            {s.trackName}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {s.artistName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(s.created_at).toLocaleString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Votes</div>
                          <div className="text-lg font-extrabold text-primary">
                            {s.voteCount}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-primary" />
                  QnA answers
                </CardTitle>
                <Badge variant="secondary">{answers.length}</Badge>
              </div>
              <CardDescription>
                Where they responded to other people&apos;s requests.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {answers.length === 0 ? (
                <EmptyState
                  icon={MessageCircle}
                  title="No answers yet"
                  description="This curator has not answered any requests yet."
                />
              ) : (
                <div className="space-y-2">
                  {answers.map((a) => (
                    <Card key={a.id} className="bg-muted/40 border-border/80">
                      <CardContent className="p-4 space-y-3">
                        <div className="text-sm font-medium text-foreground/90 break-words">
                          {a.requestPrompt}
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl border border-border bg-card">
                            {a.albumImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={a.albumImage} alt={a.trackName} className="h-full w-full object-cover" />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold">{a.trackName}</div>
                            <div className="truncate text-xs text-muted-foreground">{a.artistName}</div>
                          </div>
                          {a.spotify_track_id ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="shrink-0"
                              onClick={() => setExpandedPlayAnswerId(expandedPlayAnswerId === a.id ? null : a.id)}
                            >
                              <Play className="h-4 w-4" />
                              {expandedPlayAnswerId === a.id ? "Hide" : "Play"}
                            </Button>
                          ) : null}
                        </div>
                        {expandedPlayAnswerId === a.id && a.spotify_track_id ? (
                          <div className="overflow-hidden rounded-xl border border-border">
                            <iframe
                              className="w-full"
                              src={`https://open.spotify.com/embed/track/${a.spotify_track_id}`}
                              width="100%"
                              height="80"
                              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                              loading="lazy"
                              title={`Play ${a.trackName}`}
                            />
                          </div>
                        ) : null}
                        {a.comment ? (
                          <div className="text-sm text-muted-foreground rounded-lg bg-background/60 px-3 py-2 border border-border/60">
                            {a.comment}
                          </div>
                        ) : null}
                        <div className="text-xs text-muted-foreground">
                          {new Date(a.created_at).toLocaleString()}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {status ? (
          <div className="rounded-2xl border border-border bg-accent px-4 py-3 text-sm">
            {status}
          </div>
        ) : null}
      </div>
    </main>
  );
}

