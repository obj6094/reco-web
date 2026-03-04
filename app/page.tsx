"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Flame, Sparkles, Trophy, Users, ArrowRight, Lock, Music2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

type WeeklyChallenge = {
  id: string;
  prompt: string;
  starts_at: string | null;
  week_start: string | null;
};

type TrendingReco = {
  id: string;
  trackName: string;
  artistName: string;
  albumImage: string | null;
  voteCount: number;
};

export default function HomePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [current, setCurrent] = useState<WeeklyChallenge | null>(null);
  const [past, setPast] = useState<WeeklyChallenge[]>([]);
  const [loadingChallenges, setLoadingChallenges] = useState(true);

  const [submittedThisWeek, setSubmittedThisWeek] = useState<boolean | null>(null);
  const [bestRecoCount, setBestRecoCount] = useState<number | null>(null);
  const [trending, setTrending] = useState<TrendingReco[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(false);

  const [status, setStatus] = useState("");

  useEffect(() => {
    async function boot() {
      // 클라이언트에서 세션 기반으로 로그인 상태 확인 (env 는 lib/supabaseClient.ts 에서만 사용)
      const { data: userData } = await supabase.auth.getUser();
      setUserId(userData.user?.id ?? null);
      setAuthChecked(true);

      // weekly_challenges 는 RLS 에서 공개 조회가 가능해야 한다
      setLoadingChallenges(true);
      const { data, error } = await supabase
        .from("weekly_challenges")
        .select("*")
        .order("starts_at", { ascending: false })
        .limit(10);

      if (error) {
        setStatus("챌린지 정보를 불러오지 못했어: " + error.message);
        setLoadingChallenges(false);
        return;
      }

      if (data && data.length) {
        setCurrent(data[0] as WeeklyChallenge);
        setPast(data.slice(1) as WeeklyChallenge[]);
      } else {
        setCurrent(null);
        setPast([]);
      }

      setLoadingChallenges(false);
    }

    boot();
  }, []);

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

      // 이번 주 챌린지에 제출했는지 확인
      const { data: submissionRow, error: submissionError } = await supabase
        .from("challenge_submissions")
        .select("id")
        .eq("challenge_id", currentChallengeId)
        .eq("user_id", uid)
        .maybeSingle();

      if (submissionError && submissionError.code !== "PGRST116") {
        setStatus("내 제출 정보를 불러오지 못했어: " + submissionError.message);
      }

      setSubmittedThisWeek(!!submissionRow);

      // 내가 작성한 답변들 중 Best Reco 로 선택된 횟수 계산
      const { data: myAnswers, error: answersError } = await supabase
        .from("qna_answers")
        .select("id")
        .eq("responder_id", uid);

      if (answersError) {
        setStatus("내 QnA 정보를 불러오지 못했어: " + answersError.message);
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
        setStatus("Best Reco 기록을 불러오지 못했어: " + bestError.message);
        return;
      }

      setBestRecoCount(count ?? 0);
    }

    loadMyStatus();
  }, [userId, current]);

  useEffect(() => {
    if (!userId || !current) {
      setTrending([]);
      return;
    }

    const currentChallengeId = current.id;

    async function loadTrending() {
      setLoadingTrending(true);

      // 로그인 유저에게만 보여주는 "Trending Recos" (RLS 보호)
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
  }, [userId, current]);

  const currentTitle = useMemo(() => {
    if (!current) return "No challenge yet";
    return "This Week’s Challenge";
  }, [current]);

  return (
    <main className="min-h-[calc(100vh-56px)] bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Hero */}
        <div className="grid gap-6 md:grid-cols-2 md:items-center">
          <div className="space-y-4">
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
            <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">
              Discover music through real people.
            </h1>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              매주 프롬프트에 맞는 곡을 추천하고, 서로 투표해서 Best Reco를 뽑아봐.
              그리고 QnA 요청으로 “지금 내 상황에 딱 맞는 곡”을 받아가자.
            </p>
            <div className="flex flex-wrap gap-2">
              {userId ? (
                <>
                  <Button asChild>
                    <Link href="/challenge">
                      <Trophy className="h-4 w-4" />
                      Go to Challenge
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
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
                      Weekly challenge · Voting · QnA
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
              <CardDescription>홈을 준비하는 중이야...</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            {/* This week */}
            <motion.div whileHover={{ scale: 1.01 }} transition={{ duration: 0.15 }}>
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-primary" />
                      {currentTitle}
                    </CardTitle>
                    {current?.starts_at ? (
                      <span className="text-xs text-muted-foreground">
                        {new Date(current.starts_at).toLocaleDateString()}
                      </span>
                    ) : null}
                  </div>
                  <CardDescription>
                    {current?.prompt ?? "아직 등록된 챌린지가 없어."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-2">
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
                </CardContent>
              </Card>
            </motion.div>

            {/* Trending */}
            <motion.div whileHover={{ scale: 1.01 }} transition={{ duration: 0.15 }}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-primary" />
                    Trending Recos
                  </CardTitle>
                  <CardDescription>
                    이번 주 인기 추천 (로그인 유저 기준으로 표시)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!userId ? (
                    <div className="flex items-start gap-3 rounded-2xl border border-border bg-accent p-4">
                      <div className="mt-0.5 text-primary">
                        <Lock className="h-4 w-4" />
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-semibold">Sign in to see trending</div>
                        <div className="text-sm text-muted-foreground">
                          RLS 보호 때문에 로그인 후에만 볼 수 있어.
                        </div>
                        <Button size="sm" className="mt-2" asChild>
                          <Link href="/login?mode=login">Log in</Link>
                        </Button>
                      </div>
                    </div>
                  ) : loadingTrending ? (
                    <div className="text-sm text-muted-foreground">불러오는 중이야...</div>
                  ) : trending.length === 0 ? (
                    <EmptyState
                      icon={Music2}
                      title="No trending recos yet"
                      description="아직 투표가 모이지 않았어. 먼저 참여해볼래?"
                    />
                  ) : (
                    <motion.div
                      initial="hidden"
                      animate="show"
                      variants={{
                        hidden: { opacity: 0, y: 6 },
                        show: { opacity: 1, y: 0, transition: { staggerChildren: 0.06 } },
                      }}
                      className="space-y-2"
                    >
                      {trending.map((t) => (
                        <motion.div
                          key={t.id}
                          variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-accent/40 px-3 py-2"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-xl border border-border bg-card">
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
                          <Badge variant="secondary" className="flex-shrink-0">
                            {t.voteCount} votes
                          </Badge>
                        </motion.div>
                      ))}
                      <Button variant="outline" size="sm" asChild className="w-full">
                        <Link href="/challenge">See full ranking</Link>
                      </Button>
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
                    Reco는 커뮤니티가 만드는 큐레이션이야.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {userId ? (
                    <>
                      <div className="flex items-center justify-between rounded-2xl border border-border bg-accent/40 px-4 py-3">
                        <div className="text-sm font-semibold">Best Reco</div>
                        <div className="text-lg font-extrabold text-primary">
                          {bestRecoCount ?? "—"}
                        </div>
                      </div>
                      <div className="flex items-center justify-between rounded-2xl border border-border bg-accent/40 px-4 py-3">
                        <div className="text-sm font-semibold">This week</div>
                        <Badge variant={submittedThisWeek ? "success" : "secondary"}>
                          {submittedThisWeek === null
                            ? "Loading…"
                            : submittedThisWeek
                            ? "Submitted"
                            : "Not yet"}
                        </Badge>
                      </div>
                      <Button variant="outline" asChild>
                        <Link href="/profile">
                          View profile <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </>
                  ) : (
                    <EmptyState
                      icon={Users}
                      title="Build your curator profile"
                      description="로그인하면 내 Best Reco, 제출 상태 등을 확인할 수 있어."
                    />
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
            <CardDescription>최근 챌린지를 빠르게 훑어볼 수 있어.</CardDescription>
          </CardHeader>
          <CardContent>
            {past.length === 0 ? (
              <EmptyState
                icon={Trophy}
                title="No past challenges yet"
                description="곧 지난 챌린지들이 여기에 쌓일 거야."
              />
            ) : (
              <div className="grid gap-2">
                {past.slice(0, 8).map((ch) => (
                  <div
                    key={ch.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-accent/30 px-4 py-3"
                  >
                    <div className="text-xs text-muted-foreground">
                      {ch.week_start ? new Date(ch.week_start).toLocaleDateString() : "Past"}
                    </div>
                    <div className="flex-1 truncate text-right text-sm">
                      {ch.prompt}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {status ? (
          <div className="rounded-2xl border border-border bg-accent px-4 py-3 text-sm text-foreground/90">
            {status}
          </div>
        ) : null}
      </div>
    </main>
  );
}
