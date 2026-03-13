"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getDisplayName } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Flame, Sparkles, Trophy, Users, ArrowRight, Lock, Music2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { BestRecosSection } from "@/components/BestRecosSection";

type WeeklyChallenge = {
  id: string;
  prompt: string;
  starts_at: string | null;
  ends_at: string | null;
  week_start: string | null;
};

type TrendingReco = {
  id: string;
  trackName: string;
  artistName: string;
  albumImage: string | null;
  voteCount: number;
};

type TopCurator = {
  userId: string;
  nickname: string;
  username: string | null;
  score: number;
};

export default function HomePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [current, setCurrent] = useState<WeeklyChallenge | null>(null);
  const [past, setPast] = useState<WeeklyChallenge[]>([]);
  const [loadingChallenges, setLoadingChallenges] = useState(true);

  const [submittedThisWeek, setSubmittedThisWeek] = useState<boolean | null>(null);
  const [bestRecoCount, setBestRecoCount] = useState<number | null>(null);
  const [trending, setTrending] = useState<TrendingReco[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(false);

  const [topCurators, setTopCurators] = useState<TopCurator[]>([]);
  const [loadingCurators, setLoadingCurators] = useState(false);

  const [status, setStatus] = useState("");

  useEffect(() => {
    async function boot() {
      // ?대씪?댁뼵?몄뿉???몄뀡 湲곕컲?쇰줈 濡쒓렇???곹깭 ?뺤씤 (env ??lib/supabaseClient.ts ?먯꽌留??ъ슜)
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", uid)
          .maybeSingle();
        if (!profile?.username) {
          router.replace("/setup-account");
          return;
        }
      }
      setAuthChecked(true);

      // weekly_challenges ??RLS ?먯꽌 怨듦컻 議고쉶媛 媛?ν빐???쒕떎
      setLoadingChallenges(true);
      const now = new Date().toISOString();

      const { data: currentRow, error: currentError } = await supabase
        .from("weekly_challenges")
        .select("*")
        .lte("starts_at", now)
        .gt("ends_at", now)
        .order("starts_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (currentError) {
        setStatus("Failed to load challenge data: " + currentError.message);
        setLoadingChallenges(false);
        return;
      }

      const { data: pastRows, error: pastError } = await supabase
        .from("weekly_challenges")
        .select("*")
        .lt("ends_at", now)
        .order("starts_at", { ascending: false })
        .limit(10);

      if (pastError) {
        setStatus("Failed to load past challenges: " + pastError.message);
        setLoadingChallenges(false);
        return;
      }

      setCurrent((currentRow as WeeklyChallenge | null) ?? null);
      setPast((pastRows as WeeklyChallenge[] | null) ?? []);

      setLoadingChallenges(false);
    }

    boot();
  }, [router]);

  useEffect(() => {
    if (!userId || !current) {
      setSubmittedThisWeek(null);
      setBestRecoCount(null);
      return;
    }

    const currentChallengeId = current.id;
    const uid = userId;

    async function loadMyStatus() {
      setStatus("");

      // ?대쾲 二?梨뚮┛吏???쒖텧?덈뒗吏 ?뺤씤
      const { data: submissionRow, error: submissionError } = await supabase
        .from("challenge_submissions")
        .select("id")
        .eq("challenge_id", currentChallengeId)
        .eq("user_id", uid)
        .maybeSingle();

      if (submissionError && submissionError.code !== "PGRST116") {
        setStatus("Failed to load your submission status: " + submissionError.message);
      }

      setSubmittedThisWeek(!!submissionRow);

      // ?닿? ?묒꽦???듬???以?Best Reco 濡??좏깮???잛닔 怨꾩궛
      const { data: myAnswers, error: answersError } = await supabase
        .from("qna_answers")
        .select("id")
        .eq("responder_id", uid);

      if (answersError) {
        setStatus("Failed to load your QnA data: " + answersError.message);
        return;
      }

      if (!myAnswers || myAnswers.length === 0) {
        setBestRecoCount(0);
        return;
      }

      const answerIds = myAnswers.map((a) => a.id);

      const { count, error: bestError } = await supabase
        .from("qna_requests")
        .select("id", { count: "exact", head: true })
        .in("best_answer_id", answerIds);

      if (bestError) {
        setStatus("Failed to load Best Reco history: " + bestError.message);
        return;
      }

      setBestRecoCount(count ?? 0);
    }

    loadMyStatus();
  }, [userId, current]);

  useEffect(() => {
    if (!current) {
      setTrending([]);
      return;
    }

    const currentChallengeId = current.id;

    async function loadTrending() {
      setLoadingTrending(true);

      // ?대쾲 二?梨뚮┛吏???곸쐞 ?쒖텧??怨듦컻 ?쇰뱶?⑹쑝濡?遺덈윭?⑤떎 (RLS ?먯꽌 怨듦컻 議고쉶 ?꾩슂)
      const { data, error } = await supabase
        .from("challenge_submissions")
        .select(
          "id, spotify_track_name, spotify_artist_name, spotify_album_image_url, created_at, challenge_votes(id)"
        )
        .eq("challenge_id", currentChallengeId);

      if (error) {
        setLoadingTrending(false);
        return;
      }

      const mapped: TrendingReco[] =
        data?.map((row: any) => ({
          id: row.id,
          trackName: row.spotify_track_name,
          artistName: row.spotify_artist_name,
          albumImage: row.spotify_album_image_url,
          voteCount: (row.challenge_votes ?? []).length,
        })) ?? [];

      mapped.sort((a, b) => b.voteCount - a.voteCount);
      setTrending(mapped.slice(0, 3));
      setLoadingTrending(false);
    }

    loadTrending();
  }, [current]);

  const currentTitle = useMemo(() => {
    if (!current) return "No challenge yet";
    return "This Week?셲 Challenge";
  }, [current]);

  const currentRange = useMemo(() => {
    if (!current?.starts_at || !current.ends_at) return null;
    const start = new Date(current.starts_at);
    const end = new Date(current.ends_at);
    return `${start.toLocaleDateString()} ??${end.toLocaleDateString()}`;
  }, [current]);

  const currentDday = useMemo(() => {
    if (!current?.ends_at) return null;
    const end = new Date(current.ends_at);
    end.setHours(23, 59, 59, 999);
    const now = new Date();
    const diffMs = end.getTime() - now.getTime();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (days < 0) return "Closed";
    if (days === 0) return "D-Day";
    return `D-${days}`;
  }, [current]);

  useEffect(() => {
    async function loadTopCurators() {
      setLoadingCurators(true);

      // Reco Score: Best Reco count + votes received on submissions
      const { data: bestReqs, error: bestReqError } = await supabase
        .from("qna_requests")
        .select("best_answer_id")
        .not("best_answer_id", "is", null);

      if (bestReqError) {
        setLoadingCurators(false);
        return;
      }

      const bestAnswerIds = (bestReqs ?? [])
        .map((r: any) => r.best_answer_id)
        .filter((id: string | null) => !!id);

      const bestCountByUser: Record<string, number> = {};

      if (bestAnswerIds.length) {
        const { data: bestAnswers, error: bestAnswersError } = await supabase
          .from("qna_answers")
          .select("id, responder_id")
          .in("id", bestAnswerIds);

        if (bestAnswersError) {
          setLoadingCurators(false);
          return;
        }

        for (const row of bestAnswers ?? []) {
          const uid = row.responder_id as string;
          bestCountByUser[uid] = (bestCountByUser[uid] ?? 0) + 1;
        }
      }

      const { data: submissions, error: subsError } = await supabase
        .from("challenge_submissions")
        .select("id, user_id");

      if (subsError) {
        setLoadingCurators(false);
        return;
      }

      const submissionOwner: Record<string, string> = {};
      for (const row of submissions ?? []) {
        submissionOwner[row.id as string] = row.user_id as string;
      }

      const { data: votes, error: votesError } = await supabase
        .from("challenge_votes")
        .select("submission_id");

      if (votesError) {
        setLoadingCurators(false);
        return;
      }

      const voteCountByUser: Record<string, number> = {};
      for (const v of votes ?? []) {
        const sid = v.submission_id as string;
        const owner = submissionOwner[sid];
        if (!owner) continue;
        voteCountByUser[owner] = (voteCountByUser[owner] ?? 0) + 1;
      }

      const userIds = Array.from(
        new Set([...Object.keys(bestCountByUser), ...Object.keys(voteCountByUser)])
      );

      if (!userIds.length) {
        setTopCurators([]);
        setLoadingCurators(false);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, nickname")
        .in("id", userIds);

      if (profilesError) {
        setLoadingCurators(false);
        return;
      }

      const curators: TopCurator[] = (profiles ?? []).map((p: any) => {
        const uid = p.id as string;
        const score = (bestCountByUser[uid] ?? 0) + (voteCountByUser[uid] ?? 0);
        return {
          userId: uid,
          username: p.username ?? null,
          nickname: getDisplayName(p.nickname, p.username),
          score,
        };
      });

      curators.sort((a, b) => b.score - a.score);
      setTopCurators(curators.slice(0, 3));
      setLoadingCurators(false);
    }

    // ?꾨줈??肄섑뀗痢좊뒗 怨듦컻 議고쉶媛 媛?ν빐???쒕떎 (RLS)
    loadTopCurators();
  }, []);

  return (
    <main className="min-h-[calc(100dvh-120px)] bg-background px-3 py-6 text-foreground sm:px-4 sm:py-8 md:py-10">
      <div className="mx-auto w-full max-w-5xl space-y-6 sm:space-y-8">
        {/* Hero */}
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2 md:items-center">
          <div className="space-y-3 sm:space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                Weekly picks
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Users className="h-3.5 w-3.5" />
                Real people, real taste
              </Badge>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
              Discover music through real people.
            </h1>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              Recommend songs, vote together, and find your next favorite track.
            </p>
            <div className="flex flex-wrap gap-2 [&>a]:min-h-[44px] [&>button]:min-h-[44px]">
              {userId ? (
                <>
                  <Button asChild className="min-h-[44px] min-w-[160px] sm:min-w-[180px]">
                    <Link href="/challenge">
                      <Trophy className="h-4 w-4" />
                      Go to Challenge
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="outline" asChild className="min-h-[44px] min-w-[160px] sm:min-w-[180px]">
                    <Link href="/requests">
                      <Music2 className="h-4 w-4" />
                      Browse Requests
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild>
                    <Link href="/login?mode=login">
                      <ArrowRight className="h-4 w-4" />
                      Log in
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/login?mode=signup">Sign up</Link>
                  </Button>
                </>
              )}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="hidden md:block"
          >
            {/* abstract illustration */}
            <Card className="relative overflow-hidden">
              <CardContent className="p-0">
                <div className="relative h-56 w-full bg-card">
                  <svg
                    className="absolute inset-0 h-full w-full"
                    viewBox="0 0 640 260"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle cx="140" cy="120" r="90" fill="hsl(var(--primary))" fillOpacity="0.12" />
                    <circle cx="260" cy="140" r="120" fill="hsl(var(--primary))" fillOpacity="0.08" />
                    <circle cx="450" cy="110" r="95" fill="hsl(var(--primary))" fillOpacity="0.10" />
                    <path
                      d="M60 210 C 160 150, 240 260, 360 200 C 470 150, 540 235, 610 190"
                      stroke="hsl(var(--primary))"
                      strokeOpacity="0.35"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    <path
                      d="M60 210 C 160 170, 240 240, 360 215 C 470 185, 540 215, 610 205"
                      stroke="hsl(var(--primary))"
                      strokeOpacity="0.20"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute left-5 top-5 space-y-2">
                    <div className="text-sm font-semibold">Reco</div>
                    <div className="text-xs text-muted-foreground">
                      Weekly challenge 쨌 Voting 쨌 QnA
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Loading state */}
        {!authChecked || loadingChallenges ? (
          <Card>
            <CardHeader>
              <CardTitle>Loading</CardTitle>
              <CardDescription>Preparing your home feed...</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4 sm:gap-5 lg:grid-cols-3">
            {/* Weekly challenge + trending combined */}
            <motion.div whileHover={{ scale: 1.01 }} transition={{ duration: 0.15 }} className="lg:col-span-2">
              <Card className="h-full">
                <CardHeader className="space-y-2">
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-primary" />
                    {currentTitle}
                  </CardTitle>
                  {currentRange ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{currentRange}</span>
                      {currentDday ? (
                        <Badge variant="secondary" className="px-2 py-0.5 text-[11px]">
                          {currentDday}
                        </Badge>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">This week&apos;s theme</p>
                    <p className="mt-1 text-sm font-semibold leading-snug tracking-tight sm:text-base break-words">
                      {current?.prompt ?? "No challenge has been posted yet."}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {userId ? (
                      <Button asChild>
                        <Link href="/challenge">
                          Submit / Vote <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    ) : (
                      <Button asChild>
                        <Link href="/login?mode=login">
                          Log in to participate <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                    <Badge variant="secondary" className="gap-1">
                      <Flame className="h-3.5 w-3.5" />
                      Top 3 this week
                    </Badge>
                  </div>

                  {loadingTrending ? (
                    <div className="text-sm text-muted-foreground">Loading...</div>
                  ) : trending.length === 0 ? (
                    <EmptyState
                      icon={Music2}
                      title="No trending recos yet"
                      description="No votes yet. Be the first to join."
                    />
                  ) : (
                    <motion.div
                      initial="hidden"
                      animate="show"
                      variants={{
                        hidden: { opacity: 0, y: 6 },
                        show: { opacity: 1, y: 0, transition: { staggerChildren: 0.06 } },
                      }}
                      className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3"
                    >
                      {trending.map((t, index) => (
                        <motion.div
                          key={t.id}
                          variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
                          className="flex flex-col gap-2 rounded-2xl border border-border bg-accent/40 p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant="secondary">#{index + 1}</Badge>
                            <Badge variant="outline">{t.voteCount} votes</Badge>
                          </div>
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl border border-border bg-card">
                              {t.albumImage ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={t.albumImage} alt={t.trackName} className="h-full w-full object-cover" />
                              ) : null}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold">{t.trackName}</div>
                              <div className="truncate text-xs text-muted-foreground">{t.artistName}</div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Top curators */}
            <motion.div whileHover={{ scale: 1.01 }} transition={{ duration: 0.15 }}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Top Curators
                  </CardTitle>
                  <CardDescription>
                    Reco Score = Best Reco count + total votes received on submissions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {loadingCurators ? (
                    <div className="text-sm text-muted-foreground">Loading...</div>
                  ) : topCurators.length === 0 ? (
                    <EmptyState
                      icon={Users}
                      title="No curators yet"
                      description="Join challenges and answer QnA requests to appear here."
                    />
                  ) : (
                    <div className="space-y-2">
                      {topCurators.map((c, index) => (
                        <Link
                          key={c.userId}
                          href={(c.nickname ?? c.username) ? `/u/${encodeURIComponent((c.nickname ?? c.username) as string)}` : "#"}
                          className="flex min-h-[48px] items-center justify-between gap-3 rounded-2xl border border-border bg-accent/40 px-3 py-3 text-sm transition-colors hover:bg-accent/60 active:bg-accent/70"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-5 text-xs text-muted-foreground">#{index + 1}</span>
                            <div className="min-w-0">
                              <div className="truncate font-semibold">{c.nickname}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">Reco Score</div>
                            <div className="text-lg font-extrabold text-primary">{c.score}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}

        {/* Past challenges */}
        <Card>
          <CardHeader>
            <CardTitle>Past Challenges</CardTitle>
            <CardDescription>Previous challenges by theme and period.</CardDescription>
          </CardHeader>
          <CardContent>
            {past.length === 0 ? (
              <EmptyState
                icon={Trophy}
                title="No past challenges yet"
                description="Past challenges will appear here soon."
              />
            ) : (
              <>
                <ul className="space-y-2">
                  {past.slice(0, 4).map((ch) => (
                    <li key={ch.id}>
                      <Link
                        href={`/challenge/past/${ch.id}`}
                        className="block rounded-2xl border border-border bg-accent/30 px-3 py-3 hover:bg-accent/40 transition-colors"
                      >
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                          <div className="text-sm font-semibold break-words sm:max-w-[70%]">
                            {ch.prompt}
                          </div>
                          <div className="text-xs text-muted-foreground sm:text-right">
                            {ch.starts_at && ch.ends_at
                              ? `${new Date(ch.starts_at).toLocaleDateString()} ??${new Date(
                                  ch.ends_at,
                                ).toLocaleDateString()}`
                              : "-"}
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
                {past.length > 4 ? (
                  <div className="mt-4">
                    <Button variant="outline" asChild>
                      <Link href="/challenge/past">View all</Link>
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        {/* Best Recos from Requests */}
        <BestRecosSection />

        {status ? (
          <div className="rounded-2xl border border-border bg-accent px-4 py-3 text-sm text-foreground/90">
            {status}
          </div>
        ) : null}
      </div>
    </main>
  );
}
