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

type TopCurator = {
  userId: string;
  nickname: string;
  username: string | null;
  score: number;
};

type BestRecoFromRequest = {
  id: string;
  prompt: string;
  created_at: string;
  trackId: string;
  trackName: string;
  artistName: string;
  albumImage: string | null;
  comment: string | null;
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

  const [bestFromRequests, setBestFromRequests] = useState<BestRecoFromRequest[]>([]);
  const [loadingBestFromRequests, setLoadingBestFromRequests] = useState(false);

  const [status, setStatus] = useState("");

  useEffect(() => {
    async function boot() {
      // 클라이언트에서 세션 기반으로 로그인 상태 확인 (env 는 lib/supabaseClient.ts 에서만 사용)
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

      // weekly_challenges 는 RLS 에서 공개 조회가 가능해야 한다
      setLoadingChallenges(true);
      const { data, error } = await supabase
        .from("weekly_challenges")
        .select("*")
        .order("starts_at", { ascending: false })
        .limit(10);

      if (error) {
        setStatus("Failed to load challenge data: " + error.message);
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

      // 이번 주 챌린지에 제출했는지 확인
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

      // 내가 작성한 답변들 중 Best Reco 로 선택된 횟수 계산
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

      // 이번 주 챌린지의 상위 제출을 공개 피드용으로 불러온다 (RLS 에서 공개 조회 필요)
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
    return "This Week’s Challenge";
  }, [current]);

  const currentRange = useMemo(() => {
    if (!current?.starts_at) return null;
    const start = new Date(current.starts_at);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${start.toLocaleDateString()} → ${end.toLocaleDateString()}`;
  }, [current]);

  useEffect(() => {
    async function loadTopCurators() {
      setLoadingCurators(true);

      // Reco Score 계산을 위해 Best Reco와 챌린지 투표 데이터를 모두 모은다
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
      setTopCurators(curators.slice(0, 5));
      setLoadingCurators(false);
    }

    // 프로필/콘텐츠는 공개 조회가 가능해야 한다 (RLS)
    loadTopCurators();
  }, []);

  useEffect(() => {
    async function loadBestFromRequests() {
      setLoadingBestFromRequests(true);

      // qna_requests 의 best_answer_id 를 이용해 Best Reco 피드를 구성 (공개 조회)
      const { data: reqs, error: reqError } = await supabase
        .from("qna_requests")
        .select("id, prompt, best_answer_id, created_at")
        .not("best_answer_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(10);

      if (reqError) {
        setLoadingBestFromRequests(false);
        return;
      }

      const answerIds = (reqs ?? [])
        .map((r: any) => r.best_answer_id)
        .filter((id: string | null) => !!id);

      if (!answerIds.length) {
        setBestFromRequests([]);
        setLoadingBestFromRequests(false);
        return;
      }

      const { data: answers, error: ansError } = await supabase
        .from("qna_answers")
        .select(
          "id, spotify_track_id, spotify_track_name, spotify_artist_name, spotify_album_image_url, comment"
        )
        .in("id", answerIds);

      if (ansError) {
        setLoadingBestFromRequests(false);
        return;
      }

      const answerById: Record<string, any> = {};
      for (const a of answers ?? []) {
        answerById[a.id as string] = a;
      }

      const merged: BestRecoFromRequest[] =
        reqs?.map((r: any) => {
          const a = answerById[r.best_answer_id as string];
          if (!a) return null;
          return {
            id: r.id as string,
            prompt: r.prompt as string,
            created_at: r.created_at as string,
            trackId: a.spotify_track_id as string,
            trackName: a.spotify_track_name as string,
            artistName: a.spotify_artist_name as string,
            albumImage: (a.spotify_album_image_url as string) ?? null,
            comment: (a.comment as string | null) ?? null,
          };
        }).filter(Boolean) as BestRecoFromRequest[] ?? [];

      setBestFromRequests(merged);
      setLoadingBestFromRequests(false);
    }

    loadBestFromRequests();
  }, []);

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
              Recommend songs, vote together, and find your next favorite track.
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
              <CardDescription>Preparing your home feed...</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            {/* Weekly challenge + trending combined */}
            <motion.div whileHover={{ scale: 1.01 }} transition={{ duration: 0.15 }} className="lg:col-span-2">
              <Card className="h-full">
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-primary" />
                      {currentTitle}
                    </CardTitle>
                    {currentRange ? (
                      <span className="text-xs text-muted-foreground">{currentRange}</span>
                    ) : null}
                  </div>
                  <CardDescription className="text-base">
                    {current?.prompt ?? "No challenge has been posted yet."}
                  </CardDescription>
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
                      className="grid gap-3 md:grid-cols-3"
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
                          href={c.username ? `/u/${c.username}` : "#"}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-accent/40 px-3 py-2 text-sm transition-colors hover:bg-accent/60"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-5 text-xs text-muted-foreground">#{index + 1}</span>
                            <div className="min-w-0">
                              <div className="truncate font-semibold">{c.nickname}</div>
                              <div className="truncate text-xs text-muted-foreground">@{c.nickname}</div>
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
            <CardDescription>Recent challenges and top recommendations.</CardDescription>
          </CardHeader>
          <CardContent>
            {past.length === 0 ? (
              <EmptyState
                icon={Trophy}
                title="No past challenges yet"
                description="Past challenges will appear here soon."
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

        {/* Best Recos from Requests */}
        <Card>
          <CardHeader>
            <CardTitle>Best Recos from Requests</CardTitle>
            <CardDescription>Best Recos selected from QnA requests.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingBestFromRequests ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : bestFromRequests.length === 0 ? (
              <EmptyState
                icon={Music2}
                title="No best recos yet"
                description="No best recos yet. Be the first to ask and choose one."
              />
            ) : (
              <motion.div
                initial="hidden"
                animate="show"
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  show: { opacity: 1, y: 0, transition: { staggerChildren: 0.05 } },
                }}
                className="grid gap-3 md:grid-cols-2"
              >
                {bestFromRequests.map((item) => (
                  <motion.div
                    key={item.id}
                    variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                    whileHover={{ scale: 1.01 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Card>
                      <CardHeader className="space-y-2">
                        <CardTitle className="line-clamp-2 text-sm">
                          {item.prompt}
                        </CardTitle>
                        <CardDescription>
                          {new Date(item.created_at).toLocaleDateString()}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl border border-border bg-card">
                            {item.albumImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.albumImage}
                                alt={item.trackName}
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">
                              {item.trackName}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {item.artistName}
                            </div>
                          </div>
                        </div>
                        {item.comment ? (
                          <div className="rounded-2xl border border-border bg-accent/40 px-3 py-2 text-sm">
                            “{item.comment}”
                          </div>
                        ) : null}
                        {item.trackId ? (
                          <iframe
                            className="mt-1 w-full rounded-2xl border border-border"
                            src={`https://open.spotify.com/embed/track/${item.trackId}`}
                            width="100%"
                            height="80"
                            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                            loading="lazy"
                          />
                        ) : null}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
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
