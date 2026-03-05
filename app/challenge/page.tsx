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
import { motion, AnimatePresence } from "framer-motion";
import { EmptyState } from "@/components/EmptyState";
import { ArrowRight, ChevronDown, ChevronUp, Play, Search, ThumbsUp, Trophy, Music2 } from "lucide-react";

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
  spotify_track_id: string | null;
  trackName: string;
  artistName: string;
  albumImage: string | null;
  comment: string | null;
  created_at: string;
  voteCount: number;
  viewerVoted: boolean;
  isMine: boolean;
  submitterNickname: string | null;
  submitterUsername: string | null;
};

type PastChallengeItem = {
  id: string;
  prompt: string;
  starts_at: string | null;
  topSubmissions: { trackName: string; artistName: string; albumImage: string | null; comment: string | null; voteCount: number }[];
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
  const [sortBy, setSortBy] = useState<"votes" | "recent">("votes");
  const [expandedPlayId, setExpandedPlayId] = useState<string | null>(null);
  const [pastChallenges, setPastChallenges] = useState<PastChallengeItem[]>([]);
  const [expandedPastId, setExpandedPastId] = useState<string | null>(null);
  const [loadingPast, setLoadingPast] = useState(false);

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
      setStatus("Failed to load challenge: " + error.message);
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
          "id, challenge_id, user_id, spotify_track_id, spotify_track_name, spotify_artist_name, spotify_album_image_url, comment, created_at, challenge_votes(id, voter_id)"
        )
        .eq("challenge_id", challenge.id);

      if (error) {
        setStatus("Failed to load submissions: " + error.message);
        setLoadingSubmissions(false);
        return;
      }

      const rawMapped: Omit<Submission, "submitterNickname" | "submitterUsername">[] =
        data?.map((row: any) => {
          const votes = row.challenge_votes ?? [];
          const voteCount = votes.length;
          const viewerVoted = !!userId && votes.some((v: any) => v.voter_id === userId);

          return {
            id: row.id,
            user_id: row.user_id,
            spotify_track_id: row.spotify_track_id ?? null,
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

      const userIds = [...new Set(rawMapped.map((r) => r.user_id).filter(Boolean))] as string[];
      let profileMap: Record<string, { nickname: string | null; username: string | null }> = {};
      if (userIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, nickname")
          .in("id", userIds);
        profiles?.forEach((p: any) => {
          profileMap[p.id] = { nickname: p.nickname ?? null, username: p.username ?? null };
        });
      }

      const mapped: Submission[] = rawMapped.map((r) => ({
        ...r,
        submitterNickname: profileMap[r.user_id]?.nickname ?? null,
        submitterUsername: profileMap[r.user_id]?.username ?? null,
      }));

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

  const sortedSubmissions = useMemo(() => {
    if (sortBy === "votes") return sortSubmissions(submissions);
    return [...submissions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [submissions, sortBy]);

  function challengeDuration(startsAt: string | null): string {
    if (!startsAt) return "";
    const start = new Date(startsAt);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${start.toLocaleDateString()} → ${end.toLocaleDateString()}`;
  }

  useEffect(() => {
    if (!challenge?.id) return;
    async function loadPast() {
      setLoadingPast(true);
      const { data: allChallenges } = await supabase
        .from("weekly_challenges")
        .select("id, prompt, starts_at")
        .order("starts_at", { ascending: false })
        .limit(11);
      const past = (allChallenges ?? []).filter((c: any) => c.id !== challenge.id).slice(0, 10);
      if (past.length === 0) {
        setPastChallenges([]);
        setLoadingPast(false);
        return;
      }
      const pastIds = past.map((c: any) => c.id);
      const { data: subRows } = await supabase
        .from("challenge_submissions")
        .select("id, challenge_id, spotify_track_name, spotify_artist_name, spotify_album_image_url, comment, created_at, challenge_votes(id)")
        .in("challenge_id", pastIds);
      const byChallenge: Record<string, { trackName: string; artistName: string; albumImage: string | null; comment: string | null; voteCount: number }[]> = {};
      past.forEach((c: any) => { byChallenge[c.id] = []; });
      (subRows ?? []).forEach((row: any) => {
        const voteCount = (row.challenge_votes ?? []).length;
        const arr = byChallenge[row.challenge_id];
        if (arr) arr.push({ trackName: row.spotify_track_name, artistName: row.spotify_artist_name, albumImage: row.spotify_album_image_url, comment: row.comment, voteCount });
      });
      const items: PastChallengeItem[] = past.map((c: any) => {
        const list = (byChallenge[c.id] ?? []).sort((a, b) => b.voteCount - a.voteCount).slice(0, 3);
        return { id: c.id, prompt: c.prompt, starts_at: c.starts_at, topSubmissions: list };
      });
      setPastChallenges(items);
      setLoadingPast(false);
    }
    loadPast();
  }, [challenge?.id]);

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
      if (!data.tracks?.length) setStatus("No results found.");
    } catch (e: any) {
      setStatus("Search error: " + e.message);
    } finally {
      setSearching(false);
    }
  }

  async function submit() {
    setStatus("");
    if (!challenge) return;
    if (!userId) {
      setStatus("You must be logged in to submit. Go to /login.");
      return;
    }
    if (mySubmission) {
      // 서버에서도 unique 제약이 있으나, 클라이언트에서 한 번 더 막아줌
      setStatus("You already submitted for this challenge. Changes are not allowed.");
      return;
    }
    if (!selected) {
      setStatus("Please select a track first.");
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
      setStatus("Submit failed: " + error.message);
      return;
    }

    setStatus("Submitted!");
    setComment("");
    setSelected(null);

    // 내 제출/목록 새로고침
    if (challenge) {
      const { data: reloadData, error: reloadError } = await supabase
        .from("challenge_submissions")
        .select(
          "id, challenge_id, user_id, spotify_track_id, spotify_track_name, spotify_artist_name, spotify_album_image_url, comment, created_at, challenge_votes(id, voter_id)"
        )
        .eq("challenge_id", challenge.id);

      if (!reloadError && reloadData) {
        const rawReload = reloadData.map((row: any) => {
          const votes = row.challenge_votes ?? [];
          const voteCount = votes.length;
          const viewerVoted = !!userId && votes.some((v: any) => v.voter_id === userId);
          return {
            id: row.id,
            user_id: row.user_id,
            spotify_track_id: row.spotify_track_id ?? null,
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
        const uids = [...new Set(rawReload.map((r) => r.user_id).filter(Boolean))] as string[];
        let pm: Record<string, { nickname: string | null; username: string | null }> = {};
        if (uids.length) {
          const { data: profs } = await supabase.from("profiles").select("id, username, nickname").in("id", uids);
          profs?.forEach((p: any) => { pm[p.id] = { nickname: p.nickname ?? null, username: p.username ?? null }; });
        }
        const mapped: Submission[] = rawReload.map((r) => ({
          ...r,
          submitterNickname: pm[r.user_id]?.nickname ?? null,
          submitterUsername: pm[r.user_id]?.username ?? null,
        }));
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
      setStatus("You cannot vote for your own submission.");
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
          setStatus("Failed to remove vote: " + error.message);
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
          setStatus("Vote error: " + ownerError.message);
          return;
        }

        if (ownerRow?.user_id === userId) {
          setSubmissions(before);
          setMySubmission(before.find((s) => s.isMine) ?? null);
          setStatus("You cannot vote for your own submission.");
          return;
        }

        const { error } = await supabase.from("challenge_votes").insert({
          submission_id: submission.id,
          voter_id: userId,
        });

        if (error) {
          setSubmissions(before);
          setMySubmission(before.find((s) => s.isMine) ?? null);
          setStatus("Vote failed: " + error.message);
        }
      }
    } finally {
      setVotingOnId(null);
      // 투표 후 정합성 확보를 위해 목록/카운트 새로고침
      if (challenge && userId) {
        const { data: refetchData, error } = await supabase
          .from("challenge_submissions")
          .select(
            "id, challenge_id, user_id, spotify_track_id, spotify_track_name, spotify_artist_name, spotify_album_image_url, comment, created_at, challenge_votes(id, voter_id)"
          )
          .eq("challenge_id", challenge.id);

        if (!error && refetchData) {
          const raw = refetchData.map((row: any) => {
            const votes = row.challenge_votes ?? [];
            const voteCount = votes.length;
            const viewerVoted = !!userId && votes.some((v: any) => v.voter_id === userId);
            return {
              id: row.id,
              user_id: row.user_id,
              spotify_track_id: row.spotify_track_id ?? null,
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
          const uids = [...new Set(raw.map((r) => r.user_id).filter(Boolean))] as string[];
          let pm: Record<string, { nickname: string | null; username: string | null }> = {};
          if (uids.length) {
            const { data: profs } = await supabase.from("profiles").select("id, username, nickname").in("id", uids);
            profs?.forEach((p: any) => { pm[p.id] = { nickname: p.nickname ?? null, username: p.username ?? null }; });
          }
          const mapped: Submission[] = raw.map((r) => ({
            ...r,
            submitterNickname: pm[r.user_id]?.nickname ?? null,
            submitterUsername: pm[r.user_id]?.username ?? null,
          }));
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
              <CardDescription>Loading this week&apos;s challenge…</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-56px)] bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-5xl space-y-8">
        <section className="rounded-2xl border border-border bg-card px-6 py-10 md:px-10 md:py-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Weekly Challenge</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl lg:text-5xl">
            {challenge.prompt}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {challengeDuration(challenge.starts_at)}
            </span>
            <Button asChild>
              <Link href="#submissions">
                Submit / Vote <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>

        {!authChecked ? (
          <Card>
            <CardHeader>
              <CardTitle>Loading</CardTitle>
              <CardDescription>Checking your session…</CardDescription>
            </CardHeader>
          </Card>
        ) : !userId ? (
          <Card>
            <CardHeader>
              <CardTitle>Redirecting</CardTitle>
              <CardDescription>Sending you to the login page…</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            {mySubmission ? (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                <Card className="border-primary/60 bg-primary/5">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-primary" />
                      Your Submission
                    </CardTitle>
                    </div>
                    <CardDescription>One track per challenge. No changes after submit.</CardDescription>
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
              <>
              <Card id="your-submission">
                <CardContent className="flex flex-wrap items-center justify-between gap-4 py-6">
                  <p className="text-muted-foreground">You haven&apos;t submitted yet.</p>
                  <Button asChild>
                    <a href="#submit-form">Submit your Reco</a>
                  </Button>
                </CardContent>
              </Card>
              <Card id="submit-form">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-primary" />
                    Submit your Reco
                  </CardTitle>
                  <CardDescription>Pick a track that fits this week&apos;s prompt.</CardDescription>
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
              </>
            )}

            <Card id="submissions">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>Submissions</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Sort:</span>
                    <div className="flex rounded-lg border border-border bg-muted/30 p-0.5">
                      <button
                        type="button"
                        onClick={() => setSortBy("votes")}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                          sortBy === "votes" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Most Voted
                      </button>
                      <button
                        type="button"
                        onClick={() => setSortBy("recent")}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                          sortBy === "recent" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Most Recent
                      </button>
                    </div>
                    <Badge variant="secondary">
                      {loadingSubmissions ? "…" : `${submissions.length} entries`}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingSubmissions && !submissions.length ? (
                  <div className="text-sm text-muted-foreground">Loading submissions…</div>
                ) : submissions.length === 0 ? (
                  <EmptyState
                    icon={Music2}
                    title="No submissions yet"
                    description="Be the first to submit a track for this week."
                  />
                ) : (
                  <ul className="grid gap-3 md:grid-cols-2">
                    {sortedSubmissions.map((s) => (
                      <li key={s.id}>
                        <motion.div
                        variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                        whileHover={{ scale: 1.01 }}
                        transition={{ duration: 0.15 }}
                      >
                        <Card className={s.isMine ? "border-primary/60 bg-primary/5" : ""}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-4">
                              <div className="h-14 w-14 overflow-hidden rounded-2xl border border-border bg-card">
                                {s.albumImage ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={s.albumImage} alt={s.trackName} className="h-full w-full object-cover" />
                                ) : null}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className="truncate text-sm font-semibold">{s.trackName}</div>
                                  {s.isMine ? <Badge variant="secondary">Yours</Badge> : null}
                                </div>
                                <div className="truncate text-xs text-muted-foreground">{s.artistName}</div>
                                {s.comment ? (
                                  <div className="mt-2 line-clamp-2 text-sm text-foreground/90">“{s.comment}”</div>
                                ) : null}
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <Badge variant="secondary">{s.voteCount} votes</Badge>
                                  {s.submitterUsername ? (
                                    <Link href={`/u/${s.submitterUsername}`} className="text-xs text-primary hover:underline">
                                      {s.submitterNickname || `@${s.submitterUsername}`}
                                    </Link>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">{s.submitterNickname || "Unknown"}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2">
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
                                  {s.isMine ? "Mine" : votingOnId === s.id ? "…" : s.viewerVoted ? "Voted" : "Vote"}
                                </Button>
                              </motion.div>
                              {s.spotify_track_id ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setExpandedPlayId(expandedPlayId === s.id ? null : s.id)}
                                >
                                  <Play className="h-4 w-4" />
                                  {expandedPlayId === s.id ? "Hide" : "Play"}
                                </Button>
                              ) : null}
                            </div>
                              <AnimatePresence>
                                {expandedPlayId === s.id && s.spotify_track_id ? (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="mt-3 overflow-hidden"
                                  >
                                    <iframe
                                      className="w-full rounded-xl border border-border"
                                      src={`https://open.spotify.com/embed/track/${s.spotify_track_id}`}
                                      width="100%"
                                      height="152"
                                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                                      loading="lazy"
                                      title={`Play ${s.trackName}`}
                                    />
                                  </motion.div>
                                ) : null}
                              </AnimatePresence>
                            </CardContent>
                        </Card>
                      </motion.div>
                      </li>
                    ))}
                  </ul>
                )}

                {status && mySubmission ? (
                  <div className="mt-4 rounded-2xl border border-border bg-accent px-4 py-3 text-sm">
                    {status}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {/* Past Challenges */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  Past Challenges
                </CardTitle>
                <CardDescription>Click to expand and see top 3 submissions.</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingPast ? (
                  <div className="text-sm text-muted-foreground">Loading past challenges…</div>
                ) : pastChallenges.length === 0 ? (
                  <EmptyState
                    icon={Trophy}
                    title="No past challenges"
                    description="Previous weeks will appear here."
                  />
                ) : (
                  <ul className="space-y-2">
                    {pastChallenges.map((past) => {
                      const isExpanded = expandedPastId === past.id;
                      const top = past.topSubmissions[0];
                      return (
                        <li key={past.id}>
                          <Card>
                            <button
                              type="button"
                              className="w-full text-left"
                              onClick={() => setExpandedPastId(isExpanded ? null : past.id)}
                            >
                              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium">{past.prompt}</p>
                                  {top ? (
                                    <p className="mt-1 text-sm text-muted-foreground">
                                      #1: {top.trackName} — {top.artistName}
                                    </p>
                                  ) : (
                                    <p className="mt-1 text-sm text-muted-foreground">No submissions</p>
                                  )}
                                </div>
                                {isExpanded ? (
                                  <ChevronUp className="h-5 w-5 shrink-0 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
                                )}
                              </CardContent>
                            </button>
                            <AnimatePresence>
                              {isExpanded && past.topSubmissions.length > 0 ? (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden border-t border-border"
                                >
                                  <ul className="divide-y divide-border px-4 py-3">
                                    {past.topSubmissions.map((sub, idx) => (
                                      <li key={idx} className="flex items-center gap-3 py-3 first:pt-0">
                                        <span className="font-medium text-muted-foreground">#{idx + 1}</span>
                                        {sub.albumImage ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img
                                            src={sub.albumImage}
                                            alt=""
                                            className="h-10 w-10 rounded-lg object-cover"
                                          />
                                        ) : null}
                                        <div className="min-w-0 flex-1">
                                          <p className="text-sm font-medium">{sub.trackName}</p>
                                          <p className="text-xs text-muted-foreground">{sub.artistName}</p>
                                          {idx === 0 && sub.comment ? (
                                            <p className="mt-1 text-sm text-foreground/90">&quot;{sub.comment}&quot;</p>
                                          ) : null}
                                        </div>
                                        <Badge variant="secondary">{sub.voteCount} votes</Badge>
                                      </li>
                                    ))}
                                  </ul>
                                </motion.div>
                              ) : null}
                            </AnimatePresence>
                          </Card>
                        </li>
                      );
                    })}
                  </ul>
                )}
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