"use client";

import { useParams, useRouter } from "next/navigation";
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
import { ExpandableText } from "@/components/ExpandableText";
import { ArrowLeft, ArrowRight, MessageCircle, Play, Star, Trophy, User } from "lucide-react";

type PublicSubmission = {
  id: string;
  challenge_id: string;
  challengePrompt: string;
  trackName: string;
  artistName: string;
  albumImage: string | null;
  comment: string | null;
  created_at: string;
  voteCount: number;
  spotify_track_id: string | null;
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
  requesterName: string;
  requesterSlug: string;
};

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const usernameParam = params?.username;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);

  const [recoScore, setRecoScore] = useState<number | null>(null);
  const [bestCount, setBestCount] = useState<number | null>(null);
  const [voteCountTotal, setVoteCountTotal] = useState<number | null>(null);
  const [songsThisWeek, setSongsThisWeek] = useState<number | null>(null);

  const [submissions, setSubmissions] = useState<PublicSubmission[]>([]);
  const [totalSubmissionsCount, setTotalSubmissionsCount] = useState(0);
  const [answers, setAnswers] = useState<PublicAnswer[]>([]);
  const [totalAnswersCount, setTotalAnswersCount] = useState(0);
  const [expandedPlayAnswerId, setExpandedPlayAnswerId] = useState<string | null>(null);
  const [expandedPlaySubmissionId, setExpandedPlaySubmissionId] = useState<string | null>(null);
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

      // Load challenge submissions and QnA answers in parallel
      const [subCountRes, subRowsRes, ansCountRes, ansRowsRes] = await Promise.all([
        supabase.from("challenge_submissions").select("id", { count: "exact", head: true }).eq("user_id", uid),
        supabase.from("challenge_submissions").select("id, challenge_id, spotify_track_id, spotify_track_name, spotify_artist_name, spotify_album_image_url, comment, created_at, challenge_votes(id)").eq("user_id", uid).order("created_at", { ascending: false }).limit(4),
        supabase.from("qna_answers").select("id", { count: "exact", head: true }).eq("responder_id", uid),
        supabase.from("qna_answers").select("id, request_id, spotify_track_name, spotify_artist_name, spotify_album_image_url, spotify_track_id, comment, created_at").eq("responder_id", uid).order("created_at", { ascending: false }).limit(5),
      ]);

      const totalSubmissionsCount = subCountRes.count;
      const subRows = subRowsRes.data;
      const subError = subRowsRes.error;
      const totalAnswersCount = ansCountRes.count;
      const ansRows = ansRowsRes.data;
      const ansError = ansRowsRes.error;

      if (subError) {
        setStatus("Failed to load submissions: " + subError.message);
      }
      if (ansError) {
        setStatus("Failed to load QnA answers: " + ansError.message);
      }

      const challengeIds = [...new Set((subRows ?? []).map((r: any) => r.challenge_id).filter(Boolean))];
      const requestIds = [...new Set((ansRows ?? []).map((r: any) => r.request_id).filter(Boolean))];

      const [chalRowsRes, reqRowsRes] = await Promise.all([
        challengeIds.length ? supabase.from("weekly_challenges").select("id, prompt").in("id", challengeIds) : Promise.resolve({ data: [] as { id: string; prompt: string }[] }),
        requestIds.length ? supabase.from("qna_requests").select("id, prompt, requester_id").in("id", requestIds) : Promise.resolve({ data: [] as { id: string; prompt: string; requester_id: string }[] }),
      ]);

      const chalRows = chalRowsRes.data ?? [];
      const reqRows = reqRowsRes.data ?? [];
      const promptByChallengeId: Record<string, string> = {};
      chalRows.forEach((r: any) => {
        promptByChallengeId[r.id as string] = (r.prompt as string) ?? "";
      });
      const reqMap: Record<string, { prompt: string; requester_id: string }> = {};
      reqRows.forEach((r: any) => {
        reqMap[r.id as string] = { prompt: (r.prompt as string) ?? "", requester_id: r.requester_id as string };
      });

      const requesterIds = [...new Set(Object.values(reqMap).map((r) => r.requester_id).filter(Boolean))];
      let requesterProfileMap: Record<string, { name: string; slug: string }> = {};
      if (requesterIds.length) {
        const { data: profiles } = await supabase.from("profiles").select("id, nickname, username").in("id", requesterIds);
        (profiles ?? []).forEach((p: any) => {
          const slug = ((p.nickname ?? p.username ?? "user") as string).trim() || "user";
          requesterProfileMap[p.id as string] = { name: getDisplayName(p.nickname, p.username), slug };
        });
      }

      const mappedSubs: PublicSubmission[] =
        subRows?.map((row: any) => ({
          id: row.id,
          challenge_id: row.challenge_id ?? "",
          challengePrompt: promptByChallengeId[row.challenge_id as string] ?? "",
          trackName: row.spotify_track_name ?? "Unknown",
          artistName: row.spotify_artist_name ?? "Unknown",
          albumImage: row.spotify_album_image_url ?? null,
          comment: row.comment ?? null,
          created_at: row.created_at,
          voteCount: (row.challenge_votes ?? []).length,
          spotify_track_id: row.spotify_track_id ?? null,
        })) ?? [];

      setSubmissions(mappedSubs);
      setTotalSubmissionsCount(totalSubmissionsCount ?? 0);

      const mappedAns: PublicAnswer[] =
        ansRows?.map((row: any) => {
          const req = reqMap[row.request_id as string];
          const requester = req ? requesterProfileMap[req.requester_id] : null;
          return {
            id: row.id,
            request_id: row.request_id,
            trackName: row.spotify_track_name,
            artistName: row.spotify_artist_name,
            comment: row.comment ?? null,
            requestPrompt: req?.prompt ?? "",
            created_at: row.created_at,
            albumImage: row.spotify_album_image_url ?? null,
            spotify_track_id: row.spotify_track_id ?? null,
            requesterName: requester?.name ?? "user",
            requesterSlug: requester?.slug ?? "user",
          };
        }) ?? [];

      setAnswers(mappedAns);
      setTotalAnswersCount(totalAnswersCount ?? 0);

      // Calculate Reco Score components and songs this week in parallel
      const now = new Date();
      const day = now.getDay();
      const daysToMonday = day === 0 ? 6 : day - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - daysToMonday);
      monday.setHours(0, 0, 0, 0);
      const startOfWeek = monday.toISOString();

      const answerIds = mappedAns.map((a) => a.id);
      const submissionIds = mappedSubs.map((s) => s.id);

      const [bestReqRes, voteRes, ansWeekRes, subWeekRes] = await Promise.all([
        answerIds.length ? supabase.from("qna_requests").select("best_answer_id").in("best_answer_id", answerIds) : Promise.resolve({ data: [] as { best_answer_id: string | null }[], error: null }),
        submissionIds.length ? supabase.from("challenge_votes").select("id", { count: "exact", head: true }).in("submission_id", submissionIds) : Promise.resolve({ count: 0, error: null }),
        supabase.from("qna_answers").select("id", { count: "exact", head: true }).eq("responder_id", uid).gte("created_at", startOfWeek),
        supabase.from("challenge_submissions").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("created_at", startOfWeek),
      ]);

      let bestRecoCount = 0;
      if (answerIds.length && !bestReqRes.error) {
        const uniqueBest = new Set(
          (bestReqRes.data ?? []).map((r: any) => r.best_answer_id).filter((id: string | null) => !!id)
        );
        bestRecoCount = uniqueBest.size;
      }
      const votesTotal = submissionIds.length && !voteRes.error ? (voteRes.count ?? 0) : 0;

      setBestCount(bestRecoCount);
      setVoteCountTotal(votesTotal);
      setRecoScore(bestRecoCount + votesTotal);
      setSongsThisWeek((ansWeekRes.count ?? 0) + (subWeekRes.count ?? 0));

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
              {songsThisWeek != null && songsThisWeek > 0 ? (
                <div className="text-sm text-muted-foreground pt-1">
                  recommended {songsThisWeek} {songsThisWeek === 1 ? "song" : "songs"} this week
                </div>
              ) : null}
            </div>
            <Button asChild variant="outline" className="shrink-0">
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
                <Badge variant="secondary">{totalSubmissionsCount}</Badge>
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
                <div className="space-y-3">
                  {submissions.map((s) => (
                    <Card key={s.id} className="border-border/80 bg-muted/40">
                      <CardContent className="space-y-2.5 p-3 sm:p-4">
                        {s.challengePrompt ? (
                          <div className="line-clamp-2 break-words text-sm font-bold text-primary">
                            {s.challengePrompt}
                          </div>
                        ) : null}
                        <div className="flex min-w-0 items-start justify-between gap-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl border border-border bg-card sm:h-16 sm:w-16">
                              {s.albumImage ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={s.albumImage}
                                  alt={s.trackName}
                                  className="h-full w-full object-cover"
                                />
                              ) : null}
                            </div>
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="truncate text-sm font-semibold">{s.trackName}</div>
                              <div className="truncate text-xs text-muted-foreground">{s.artistName}</div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs text-muted-foreground">Votes</div>
                            <div className="text-lg font-extrabold text-primary">{s.voteCount}</div>
                          </div>
                        </div>
                        {s.comment ? (
                          <div className="rounded-2xl border border-border bg-accent/40 px-3 py-2">
                            <ExpandableText
                              text={s.comment}
                              maxChars={160}
                              variant="compact-card"
                              toggleAriaLabel="Toggle comment expansion"
                            />
                          </div>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          {s.spotify_track_id ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setExpandedPlaySubmissionId((prev) => (prev === s.id ? null : s.id))}
                              className="px-3 py-1.5 text-xs"
                            >
                              <Play className="mr-1 h-3.5 w-3.5" />
                              {expandedPlaySubmissionId === s.id ? "Hide" : "Play"}
                            </Button>
                          ) : null}
                        </div>
                        {expandedPlaySubmissionId === s.id && s.spotify_track_id ? (
                          <div className="mt-1.5 overflow-hidden rounded-2xl border border-border">
                            <iframe
                              className="w-full"
                              src={`https://open.spotify.com/embed/track/${s.spotify_track_id}`}
                              width="100%"
                              height="80"
                              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                              loading="lazy"
                              title={`Play ${s.trackName}`}
                            />
                          </div>
                        ) : null}
                        <div className="text-xs text-muted-foreground">
                          {new Date(s.created_at).toLocaleString()}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {totalSubmissionsCount > 4 ? (
                    <Button variant="outline" asChild className="w-full sm:w-auto">
                      <Link href={`/u/${encodeURIComponent(usernameParam ?? "")}/submissions`}>
                        View all ({totalSubmissionsCount})
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  ) : null}
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
                <Badge variant="secondary">{totalAnswersCount}</Badge>
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
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {answers.map((a) => (
                      <Card
                        key={a.id}
                        role="button"
                        tabIndex={0}
                        className="h-full cursor-pointer overflow-hidden border-border/80 bg-gradient-to-br from-card to-accent/20 transition-colors hover:bg-accent/10"
                        onClick={() => router.push(`/requests/${a.request_id}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            router.push(`/requests/${a.request_id}`);
                          }
                        }}
                      >
                          <CardHeader className="space-y-2 p-4 sm:p-6">
                            <CardTitle className="line-clamp-1 truncate break-words text-sm">
                              {a.requestPrompt}
                            </CardTitle>
                            <CardDescription>
                              {new Date(a.created_at).toLocaleDateString()}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl border border-border bg-card">
                                {a.albumImage ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={a.albumImage} alt={a.trackName} className="h-full w-full object-cover" />
                                ) : null}
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold">{a.trackName}</div>
                                <div className="truncate text-xs text-muted-foreground">{a.artistName}</div>
                              </div>
                            </div>
                            <div
                              className="space-y-1 rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <p>
                                Request by{" "}
                                <Link
                                  href={`/u/${encodeURIComponent(a.requesterSlug)}`}
                                  className="font-medium text-primary hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  @{a.requesterName}
                                </Link>
                              </p>
                              <p>
                                Reco by{" "}
                                <Link
                                  href={`/u/${encodeURIComponent(usernameParam ?? "")}`}
                                  className="font-medium text-primary hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  @{nickname ?? "user"}
                                </Link>
                              </p>
                            </div>
                            {a.comment ? (
                              <div className="rounded-2xl border border-border bg-accent/40 px-3 py-2">
                                <ExpandableText
                                  text={a.comment}
                                  maxChars={160}
                                  variant="compact-card"
                                  toggleAriaLabel="Toggle comment expansion"
                                />
                              </div>
                            ) : null}
                            {a.spotify_track_id ? (
                              <div
                                className="pt-1"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                              >
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setExpandedPlayAnswerId((prev) => (prev === a.id ? null : a.id));
                                  }}
                                >
                                  <Play className="h-4 w-4" />
                                  {expandedPlayAnswerId === a.id ? "Hide" : "Play"}
                                </Button>
                              </div>
                            ) : null}
                            {expandedPlayAnswerId === a.id && a.spotify_track_id ? (
                              <div
                                className="overflow-hidden rounded-xl border border-border"
                                onClick={(e) => e.stopPropagation()}
                              >
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
                          </CardContent>
                        </Card>
                    ))}
                  </div>
                  {totalAnswersCount > 5 ? (
                    <Button variant="outline" asChild className="mt-4 w-full sm:w-auto">
                      <Link href={`/u/${encodeURIComponent(usernameParam ?? "")}/answers`}>
                        View all ({totalAnswersCount})
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  ) : null}
                </>
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

