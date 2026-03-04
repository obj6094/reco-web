"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { EmptyState } from "@/components/EmptyState";
import { ArrowRight, Search, ThumbsUp, Trophy, Music2, Sparkles } from "lucide-react";

type Track = {
  id: string;
  name: string;
  artists: string;
  albumImage: string | null;
  externalUrl: string | null;
};

type Submission = {
  id: string;
  user_id: string;
  trackName: string;
  artistName: string;
  albumImage: string | null;
  comment: string | null;
  created_at: string;
  voteCount: number;
  viewerVoted: boolean;
  isMine: boolean;
};

export default function ChallengePage() {
  const router = useRouter();
  const [challenge, setChallenge] = useState<any>(null);

  // 인증 상태
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // 검색
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [selected, setSelected] = useState<Track | null>(null);

  // 제출 코멘트
  const [comment, setComment] = useState("");

  // 제출 / 투표 상태
  const [status, setStatus] = useState("");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [mySubmission, setMySubmission] = useState<Submission | null>(null);
  const [votingOnId, setVotingOnId] = useState<string | null>(null);

  const embedUrl = useMemo(() => {
    if (!selected) return null;
    return `https://open.spotify.com/embed/track/${selected.id}`;
  }, [selected]);

  useEffect(() => {
    async function boot() {
      // 로그인 유저 가져오기 (세션 체크)
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      setUserId(uid);

      // 보호된 페이지: 로그인 안 했으면 /login 으로 리다이렉트
      if (!uid) {
        router.replace("/login");
        setAuthChecked(true);
        return;
      }

      // 최신 챌린지 가져오기
      const { data, error } = await supabase
        .from("weekly_challenges")
        .select("*")
        .order("starts_at", { ascending: false })
        .limit(1)
        .single();

      if (error) {
        setStatus("챌린지를 불러오지 못했어: " + error.message);
      } else {
        setChallenge(data);
      }

      setAuthChecked(true);
    }

    boot();
  }, [router]);

  useEffect(() => {
    if (!challenge || !userId) return;

    async function loadSubmissions() {
      setLoadingSubmissions(true);
      setStatus("");

      // 현재 챌린지의 모든 제출 + 투표 정보 불러오기
      // 각 제출(challenge_submissions) 행을 그대로 랭킹 단위로 사용 (동일 곡이어도 사람/제출마다 분리)
      const { data, error } = await supabase
        .from("challenge_submissions")
        .select(
          "id, challenge_id, user_id, spotify_track_name, spotify_artist_name, spotify_album_image_url, comment, created_at, challenge_votes(id, voter_id)"
        )
        .eq("challenge_id", challenge.id);

      if (error) {
        setStatus("제출 목록을 불러오지 못했어: " + error.message);
        setLoadingSubmissions(false);
        return;
      }

      const mapped: Submission[] =
        data?.map((row: any) => {
          const votes = row.challenge_votes ?? [];
          const voteCount = votes.length;
          const viewerVoted = !!userId && votes.some((v: any) => v.voter_id === userId);

          return {
            id: row.id,
            user_id: row.user_id,
            trackName: row.spotify_track_name,
            artistName: row.spotify_artist_name,
            albumImage: row.spotify_album_image_url,
            comment: row.comment,
            created_at: row.created_at,
            voteCount,
            viewerVoted,
            isMine: !!userId && row.user_id === userId,
          };
        }) ?? [];

      // 정렬: 투표 수 desc, created_at desc
      mapped.sort((a, b) => {
        if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setSubmissions(mapped);
      setMySubmission(mapped.find((s) => s.isMine) ?? null);
      setLoadingSubmissions(false);
    }

    loadSubmissions();
  }, [challenge, userId]);

  function sortSubmissions(list: Submission[]) {
    return [...list].sort((a, b) => {
      if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }

  async function searchTracks() {
    setStatus("");
    if (!query.trim()) return;
    setSearching(true);
    setTracks([]);
    setSelected(null);

    try {
      // Spotify 검색은 /api 라우트를 통해서만 호출 (env 값은 서버 라우트에서만 사용)
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setTracks(data.tracks ?? []);
      if (!data.tracks?.length) setStatus("검색 결과가 없어.");
    } catch (e: any) {
      setStatus("검색 오류: " + e.message);
    } finally {
      setSearching(false);
    }
  }

  async function submit() {
    setStatus("");
    if (!challenge) return;
    if (!userId) {
      setStatus("제출하려면 로그인해야 해. /login 에서 로그인해줘.");
      return;
    }
    if (mySubmission) {
      // 서버에서도 unique 제약이 있으나, 클라이언트에서 한 번 더 막아줌
      setStatus("이미 이 챌린지에 곡을 제출했어. 변경은 안 돼.");
      return;
    }
    if (!selected) {
      setStatus("먼저 곡을 선택해줘.");
      return;
    }

    // challenge_submissions 테이블에 저장 (Supabase env는 lib/supabaseClient.ts에서만 사용)
    const { error } = await supabase.from("challenge_submissions").insert({
      challenge_id: challenge.id,
      user_id: userId,
      spotify_track_id: selected.id,
      spotify_track_name: selected.name,
      spotify_artist_name: selected.artists,
      spotify_album_image_url: selected.albumImage,
      comment: comment || null,
    });

    if (error) {
      // unique(challenge_id, user_id) 때문에 1인 1곡 제한에 걸릴 수 있음
      setStatus("제출 실패: " + error.message);
      return;
    }

    setStatus("✅ 제출 완료!");
    setComment("");
    setSelected(null);

    // 내 제출/목록 새로고침
    if (challenge) {
      const { data, error: reloadError } = await supabase
        .from("challenge_submissions")
        .select(
          "id, challenge_id, user_id, spotify_track_name, spotify_artist_name, spotify_album_image_url, comment, created_at, challenge_votes(id, voter_id)"
        )
        .eq("challenge_id", challenge.id);

      if (!reloadError && data) {
        const mapped: Submission[] = data.map((row: any) => {
          const votes = row.challenge_votes ?? [];
          const voteCount = votes.length;
          const viewerVoted = !!userId && votes.some((v: any) => v.voter_id === userId);

          return {
            id: row.id,
            user_id: row.user_id,
            trackName: row.spotify_track_name,
            artistName: row.spotify_artist_name,
            albumImage: row.spotify_album_image_url,
            comment: row.comment,
            created_at: row.created_at,
            voteCount,
            viewerVoted,
            isMine: !!userId && row.user_id === userId,
          };
        });

        mapped.sort((a, b) => {
          if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        setSubmissions(mapped);
        setMySubmission(mapped.find((s) => s.isMine) ?? null);
      }
    }
  }

  async function toggleVote(submission: Submission) {
    setStatus("");

    if (!userId) {
      // 보호된 페이지지만, 안전장치로 한 번 더 처리
      router.replace("/login");
      return;
    }

    if (submission.isMine) {
      // 서버 쿼리 전에 한번 더 막기
      setStatus("자기 추천에는 투표할 수 없어.");
      return;
    }

    setVotingOnId(submission.id);

    // UI는 즉시 반영 (optimistic update)
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
    setMySubmission(optimistic.find((s) => s.isMine) ?? null);

    try {
      if (submission.viewerVoted) {
        // 이미 투표한 경우 -> 취소
        const { error } = await supabase
          .from("challenge_votes")
          .delete()
          .eq("submission_id", submission.id)
          .eq("voter_id", userId);

        if (error) {
          // 실패하면 원복
          setSubmissions(before);
          setMySubmission(before.find((s) => s.isMine) ?? null);
          setStatus("투표 취소에 실패했어: " + error.message);
        }
      } else {
        // 서버 측에서도 본인 제출인지 한 번 더 확인
        const { data: ownerRow, error: ownerError } = await supabase
          .from("challenge_submissions")
          .select("user_id")
          .eq("id", submission.id)
          .single();

        if (ownerError) {
          setSubmissions(before);
          setMySubmission(before.find((s) => s.isMine) ?? null);
          setStatus("투표 준비 중 오류가 있었어: " + ownerError.message);
          return;
        }

        if (ownerRow?.user_id === userId) {
          setSubmissions(before);
          setMySubmission(before.find((s) => s.isMine) ?? null);
          setStatus("자기 추천에는 투표할 수 없어.");
          return;
        }

        const { error } = await supabase.from("challenge_votes").insert({
          submission_id: submission.id,
          voter_id: userId,
        });

        if (error) {
          setSubmissions(before);
          setMySubmission(before.find((s) => s.isMine) ?? null);
          setStatus("투표에 실패했어: " + error.message);
        }
      }
    } finally {
      setVotingOnId(null);
      // 투표 후 정합성 확보를 위해 목록/카운트 새로고침
      if (challenge && userId) {
        const { data, error } = await supabase
          .from("challenge_submissions")
          .select(
            "id, challenge_id, user_id, spotify_track_name, spotify_artist_name, spotify_album_image_url, comment, created_at, challenge_votes(id, voter_id)"
          )
          .eq("challenge_id", challenge.id);

        if (!error && data) {
          const mapped: Submission[] = data.map((row: any) => {
            const votes = row.challenge_votes ?? [];
            const voteCount = votes.length;
            const viewerVoted = !!userId && votes.some((v: any) => v.voter_id === userId);

            return {
              id: row.id,
              user_id: row.user_id,
              trackName: row.spotify_track_name,
              artistName: row.spotify_artist_name,
              albumImage: row.spotify_album_image_url,
              comment: row.comment,
              created_at: row.created_at,
              voteCount,
              viewerVoted,
              isMine: !!userId && row.user_id === userId,
            };
          });

          const sorted = sortSubmissions(mapped);
          setSubmissions(sorted);
          setMySubmission(sorted.find((s) => s.isMine) ?? null);
        }
      }
    }
  }

  if (!challenge) {
    return (
      <main className="min-h-[calc(100vh-56px)] bg-background px-4 py-16 text-foreground">
        <div className="mx-auto max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>Challenge</CardTitle>
              <CardDescription>이번 주 챌린지를 불러오는 중이야...</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-56px)] bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-5xl space-y-6">
        <Card>
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                This Week’s Reco Challenge
              </CardTitle>
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                Weekly
              </Badge>
            </div>
            <CardDescription className="text-base">{challenge.prompt}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/">
                Back to Home <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {!authChecked ? (
          <Card>
            <CardHeader>
              <CardTitle>Loading</CardTitle>
              <CardDescription>세션을 확인하는 중이야...</CardDescription>
            </CardHeader>
          </Card>
        ) : !userId ? (
          <Card>
            <CardHeader>
              <CardTitle>Redirecting</CardTitle>
              <CardDescription>로그인 페이지로 이동하는 중이야...</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            {mySubmission ? (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                <Card className="border-primary/60 bg-primary/5">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle>Your Submission</CardTitle>
                      <Badge variant="success">이미 제출 완료 · 변경 불가</Badge>
                    </div>
                    <CardDescription>
                      이 챌린지는 1인 1곡만 제출할 수 있어. 이번 주에는 곡 변경이 안 돼.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="h-16 w-16 overflow-hidden rounded-2xl border border-border bg-card">
                        {mySubmission.albumImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={mySubmission.albumImage} alt={mySubmission.trackName} className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold">{mySubmission.trackName}</div>
                        <div className="truncate text-sm text-muted-foreground">{mySubmission.artistName}</div>
                        {mySubmission.comment ? (
                          <div className="mt-2 rounded-2xl border border-border bg-accent/40 px-3 py-2 text-sm">
                            “{mySubmission.comment}”
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Votes</div>
                      <div className="text-2xl font-extrabold text-primary">{mySubmission.voteCount}</div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-primary" />
                    Submit your Reco
                  </CardTitle>
                  <CardDescription>이번 주 프롬프트에 가장 잘 어울리는 곡을 골라줘.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search a song (e.g., Radiohead Creep)"
                    />
                    <Button onClick={searchTracks} disabled={searching || !query.trim()}>
                      <Search className="h-4 w-4" />
                      {searching ? "Searching..." : "Search"}
                    </Button>
                  </div>

                  {tracks.length ? (
                    <motion.div
                      initial="hidden"
                      animate="show"
                      variants={{
                        hidden: { opacity: 0, y: 8 },
                        show: { opacity: 1, y: 0, transition: { staggerChildren: 0.05 } },
                      }}
                      className="grid gap-2"
                    >
                      {tracks.map((t) => (
                        <motion.button
                          key={t.id}
                          variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => setSelected(t)}
                          className={`text-left rounded-2xl border px-4 py-3 transition-colors ${
                            selected?.id === t.id
                              ? "border-primary bg-primary/10"
                              : "border-border bg-accent/30 hover:bg-accent/50"
                          }`}
                        >
                          <div className="text-sm font-semibold">{t.name}</div>
                          <div className="text-xs text-muted-foreground">{t.artists}</div>
                        </motion.button>
                      ))}
                    </motion.div>
                  ) : null}

                  {selected ? (
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-border bg-accent/30 px-4 py-3">
                        <div className="text-xs text-muted-foreground">Selected</div>
                        <div className="text-sm font-semibold">
                          {selected.name} — {selected.artists}
                        </div>
                      </div>

                      {embedUrl ? (
                        <iframe
                          className="w-full rounded-2xl border border-border"
                          src={embedUrl}
                          width="100%"
                          height="152"
                          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                          loading="lazy"
                        />
                      ) : null}

                      <Textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="One line: why this song?"
                      />

                      <Button onClick={submit} className="w-full">
                        Submit
                      </Button>
                    </div>
                  ) : null}

                  {status ? (
                    <div className="rounded-2xl border border-border bg-accent px-4 py-3 text-sm">
                      {status}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>All submissions</CardTitle>
                  <Badge variant="secondary">
                    {loadingSubmissions ? "Loading..." : `${submissions.length} entries`}
                  </Badge>
                </div>
                <CardDescription>
                  투표 수가 많은 제출이 위로 올라가. (votes DESC, created_at DESC)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingSubmissions && !submissions.length ? (
                  <div className="text-sm text-muted-foreground">제출 목록을 불러오는 중이야...</div>
                ) : submissions.length === 0 ? (
                  <EmptyState
                    icon={Music2}
                    title="No submissions yet"
                    description="아직 아무도 곡을 제출하지 않았어. 첫 번째로 올려볼래?"
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
                    {submissions.map((s) => (
                      <motion.div
                        key={s.id}
                        variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                        whileHover={{ scale: 1.01 }}
                        transition={{ duration: 0.15 }}
                      >
                        <Card className={s.isMine ? "border-primary/60 bg-primary/5" : ""}>
                          <CardContent className="flex items-center justify-between gap-4 p-5">
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="h-14 w-14 overflow-hidden rounded-2xl border border-border bg-card">
                                {s.albumImage ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={s.albumImage} alt={s.trackName} className="h-full w-full object-cover" />
                                ) : null}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className="truncate text-sm font-semibold">{s.trackName}</div>
                                  {s.isMine ? <Badge variant="secondary">Your Submission</Badge> : null}
                                </div>
                                <div className="truncate text-xs text-muted-foreground">{s.artistName}</div>
                                {s.comment ? (
                                  <div className="mt-2 line-clamp-2 text-sm text-foreground/90">“{s.comment}”</div>
                                ) : null}
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2">
                              <Badge variant="secondary">{s.voteCount} votes</Badge>
                              <motion.div
                                whileTap={{ scale: 0.98 }}
                                animate={s.viewerVoted ? { scale: 1.02 } : { scale: 1 }}
                                transition={{ duration: 0.12 }}
                              >
                                <Button
                                  size="sm"
                                  variant={s.viewerVoted ? "default" : "outline"}
                                  onClick={() => toggleVote(s)}
                                  disabled={s.isMine || votingOnId === s.id}
                                >
                                  <ThumbsUp className="h-4 w-4" />
                                  {s.isMine ? "Mine" : votingOnId === s.id ? "..." : s.viewerVoted ? "Voted" : "Vote"}
                                </Button>
                              </motion.div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </motion.div>
                )}

                {status && mySubmission ? (
                  <div className="mt-4 rounded-2xl border border-border bg-accent px-4 py-3 text-sm">
                    {status}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </>
        )}

        {status && !mySubmission ? (
          <div className="rounded-2xl border border-border bg-accent px-4 py-3 text-sm">
            {status}
          </div>
        ) : null}
      </div>
    </main>
  );
}