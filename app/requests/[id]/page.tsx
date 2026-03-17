"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getDisplayName } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { EmptyState } from "@/components/EmptyState";
import { ExpandableText } from "@/components/ExpandableText";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight, Crown, Lock, Play, Search, Sparkles, Tag, ThumbsUp } from "lucide-react";

type RequestDetail = {
  id: string;
  prompt: string;
  requester_id: string;
  requesterName: string;
  requesterSlug: string;
  created_at: string;
  best_answer_id: string | null;
};

type Claim = {
  id: string;
  claimer_id: string;
};

type Track = {
  id: string;
  name: string;
  artists: string;
  albumImage: string | null;
};

type Answer = {
  id: string;
  responder_id: string;
  responderName: string;
  responderSlug: string;
  trackId: string | null;
  trackName: string;
  artistName: string;
  albumImage: string | null;
  comment: string | null;
  created_at: string;
  niceRecoCount: number;
  likedByMe: boolean;
};

export default function RequestDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const requestId = params?.id as string;

  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const [claiming, setClaiming] = useState(false);
  const [niceRecoSubmittingId, setNiceRecoSubmittingId] = useState<string | null>(null);
  const [handledByNiceReco, setHandledByNiceReco] = useState(false);

  // Answer submission state
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [selected, setSelected] = useState<Track | null>(null);
  const [comment, setComment] = useState("");
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [expandedPlayAnswerId, setExpandedPlayAnswerId] = useState<string | null>(null);
  const [expandedCommentAnswerId, setExpandedCommentAnswerId] = useState<string | null>(null);
  const COMMENT_PREVIEW_LEN = 80;

  const loadAll = useCallback(async () => {
    if (!requestId) return;
      setLoading(true);
      setStatus("");

      const [reqRes, claimsRes, answersRes] = await Promise.all([
        supabase.from("qna_requests").select("id, prompt, requester_id, created_at, best_answer_id").eq("id", requestId).single(),
        supabase.from("qna_claims").select("id, claimer_id").eq("request_id", requestId),
        supabase.from("qna_answers").select("id, responder_id, spotify_track_id, spotify_track_name, spotify_artist_name, spotify_album_image_url, comment, created_at").eq("request_id", requestId).order("created_at", { ascending: false }),
      ]);

      const reqData = reqRes.data;
      const reqError = reqRes.error;
      const claimsData = claimsRes.data;
      const answersData = answersRes.data;

      if (reqError || !reqData) {
        setStatus("Failed to load request: " + (reqError?.message ?? "Not found"));
        setRequest(null);
        setClaims([]);
        setAnswers([]);
        setLoading(false);
        return;
      }

      let requesterName = "user";
      let requesterSlug = "user";
      if (reqData.requester_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("nickname, username")
          .eq("id", reqData.requester_id)
          .maybeSingle();
        if (profile) {
          requesterName = getDisplayName(profile.nickname, profile.username);
          requesterSlug = ((profile.nickname ?? profile.username ?? "user") as string).trim() || "user";
        }
      }

      setRequest({
        id: reqData.id,
        prompt: reqData.prompt,
        requester_id: reqData.requester_id,
        requesterName,
        requesterSlug,
        created_at: reqData.created_at,
        best_answer_id: reqData.best_answer_id ?? null,
      });

      setClaims(
        (claimsData ?? []).map((c: any) => ({ id: c.id, claimer_id: c.claimer_id }))
      );
      const mappedAnswers =
        (answersData ?? []).map((a: any) => ({
          id: a.id,
          responder_id: a.responder_id,
          responderName: "user",
          responderSlug: "user",
          trackId: a.spotify_track_id ?? null,
          trackName: a.spotify_track_name,
          artistName: a.spotify_artist_name,
          albumImage: a.spotify_album_image_url,
          comment: a.comment,
          created_at: a.created_at,
          niceRecoCount: 0,
          likedByMe: false,
        })) ?? [];

      if (!mappedAnswers.length) {
        setHandledByNiceReco(false);
        setAnswers([]);
        setLoading(false);
        return;
      }

      const answerIds = mappedAnswers.map((a) => a.id);
      const responderIds = [...new Set(mappedAnswers.map((a) => a.responder_id).filter(Boolean))] as string[];

      const [ratingRes, profilesRes] = await Promise.all([
        supabase.from("qna_ratings").select("id, answer_id, rater_id, score").in("answer_id", answerIds).eq("score", 1),
        supabase.from("profiles").select("id, nickname, username").in("id", responderIds),
      ]);
      const ratingRows = ratingRes.data;
      const profiles = profilesRes.data ?? [];

      const countByAnswer: Record<string, number> = {};
      const likedByMeSet = new Set<string>();
      (ratingRows ?? []).forEach((row: any) => {
        countByAnswer[row.answer_id] = (countByAnswer[row.answer_id] ?? 0) + 1;
        if (userId && row.rater_id === userId) likedByMeSet.add(row.answer_id);
      });
      setHandledByNiceReco(likedByMeSet.size > 0);

      const responderMap: Record<string, { name: string; slug: string }> = {};
      if (profiles.length) {
        profiles.forEach((p: any) => {
          const slug = ((p.nickname ?? p.username ?? "user") as string).trim() || "user";
          responderMap[p.id as string] = {
            name: getDisplayName(p.nickname, p.username),
            slug,
          };
        });
      }

      const enriched = mappedAnswers.map((ans) => {
          const r = responderMap[ans.responder_id];
          return {
            ...ans,
            responderName: r?.name ?? "user",
            responderSlug: r?.slug ?? "user",
            niceRecoCount: countByAnswer[ans.id] ?? 0,
            likedByMe: likedByMeSet.has(ans.id),
          };
        });
      const bestId = reqData.best_answer_id ?? null;
      const sorted = bestId
        ? [...enriched].sort((a, b) => (a.id === bestId ? -1 : b.id === bestId ? 1 : 0))
        : enriched;
      setAnswers(sorted);

      setLoading(false);
  }, [requestId, userId]);

  useEffect(() => {
    async function boot() {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      setUserId(uid);
      setAuthChecked(true);
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
      if (!requestId) return;
      await loadAll();
    }
    boot();
  }, [requestId, router, loadAll]);

  const claimsCount = claims.length;
  const alreadyClaimed = useMemo(
    () => !!userId && claims.some((c) => c.claimer_id === userId),
    [claims, userId]
  );
  const alreadySubmitted = useMemo(
    () => !!userId && answers.some((a) => a.responder_id === userId),
    [answers, userId]
  );
  const canClaim =
    !!userId &&
    !!request &&
    !alreadyClaimed &&
    !alreadySubmitted &&
    userId !== request.requester_id;

  async function handleClaim() {
    setStatus("");
    if (!userId || !request) {
      setStatus("You must be logged in to claim.");
      return;
    }
    if (!canClaim) {
      setStatus("You can no longer claim this request.");
      return;
    }
    if (handledByNiceReco) {
      setStatus("You already handled this request with Nice Reco.");
      return;
    }
    if (alreadySubmitted) {
      setStatus("You already submitted a track for this request.");
      return;
    }

    setClaiming(true);
    const { error } = await supabase.from("qna_claims").insert({
      request_id: request.id,
      claimer_id: userId,
    });

    if (error) {
      setStatus("Failed to claim: " + error.message);
      setClaiming(false);
      return;
    }

    setClaiming(false);
    await loadAll();
  }

  async function searchTracks() {
    setStatus("");
    if (!query.trim()) return;
    setSearching(true);
    setTracks([]);
    setSelected(null);

    try {
      // Spotify 검색은 기존 /api 라우트 사용 (env 키는 라우트 내부에서만 사용)
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

  async function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    await searchTracks();
  }

  async function handleSubmitAnswer(e: FormEvent) {
    e.preventDefault();
    setStatus("");

    if (!userId || !request) {
      setStatus("You must be logged in to answer.");
      return;
    }
    if (!alreadyClaimed) {
      // 서버 RLS 로도 제한되겠지만, 클라이언트에서 한 번 더 막아준다
      setStatus("You must claim this request before answering.");
      return;
    }
    if (handledByNiceReco) {
      setStatus("You already handled this request with Nice Reco.");
      return;
    }
    if (alreadySubmitted) {
      setStatus("You already submitted a track for this request.");
      return;
    }
    if (!selected) {
      setStatus("Please select a track first.");
      return;
    }

    setSubmittingAnswer(true);

    const { error } = await supabase.from("qna_answers").insert({
      request_id: request.id,
      responder_id: userId,
      spotify_track_id: selected.id,
      spotify_track_name: selected.name,
      spotify_artist_name: selected.artists,
      spotify_album_image_url: selected.albumImage,
      comment: comment || null,
    });

    if (error) {
      setStatus("Failed to save answer: " + error.message);
      setSubmittingAnswer(false);
      return;
    }

    setSubmittingAnswer(false);
    setComment("");
    setSelected(null);
    setQuery("");
    setTracks([]);

    await loadAll();
  }

  async function markBest(answerId: string) {
    setStatus("");

    if (!userId || !request) return;
    if (userId !== request.requester_id) {
      // 요청자만 베스트 Reco 를 지정할 수 있다
      setStatus("Only the requester can choose Best Reco.");
      return;
    }

    const { error } = await supabase
      .from("qna_requests")
      .update({ best_answer_id: answerId })
      .eq("id", request.id);

    if (error) {
      setStatus("Failed to set Best Reco: " + error.message);
      return;
    }

    await loadAll();
  }

  async function handleNiceReco(answerId: string) {
    if (!userId) return;
    if (!request) return;
    if (request.requester_id === userId) {
      setStatus("Request creator cannot use Nice Reco.");
      return;
    }
    if (alreadySubmitted) {
      setStatus("You already submitted a track for this request.");
      return;
    }
    if (handledByNiceReco) {
      setStatus("You already used Nice Reco for this request.");
      return;
    }

    const current = answers.find((a) => a.id === answerId);
    if (!current) return;
    if (current.likedByMe) {
      setStatus("You already used Nice Reco for this request.");
      return;
    }

    setNiceRecoSubmittingId(answerId);
    const previous = answers;

    setAnswers((prev) =>
      prev.map((a) =>
        a.id === answerId
          ? { ...a, likedByMe: true, niceRecoCount: a.niceRecoCount + 1 }
          : a
      )
    );

    const { error } = await supabase.from("qna_ratings").insert({
      answer_id: answerId,
      rater_id: userId,
      score: 1,
    });

    if (error) {
      setAnswers(previous);
      setStatus("Failed to add Nice Reco: " + error.message);
      setNiceRecoSubmittingId(null);
      return;
    }

    setHandledByNiceReco(true);
    setStatus("Nice Reco saved. Loading next request...");
    setNiceRecoSubmittingId(null);
    router.push("/requests");
  }

  if (!authChecked) {
    return (
      <main className="min-h-[calc(100vh-56px)] bg-background px-4 py-16 text-foreground">
        <div className="mx-auto max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>Loading</CardTitle>
              <CardDescription>Checking your session…</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100dvh-120px)] bg-background px-3 py-6 text-foreground sm:px-4 sm:py-8 md:py-10">
      <div className="mx-auto w-full max-w-3xl space-y-5 sm:space-y-6">
        <Button variant="ghost" asChild className="px-0">
          <Link href="/requests">
            <ArrowLeft className="h-4 w-4" />
            Back to requests
          </Link>
        </Button>

        <Card>
          <CardHeader>
            {loading && !request ? (
              <>
                <CardTitle>Loading</CardTitle>
                <CardDescription>Loading request…</CardDescription>
              </>
            ) : !request ? (
              <>
                <CardTitle>Not found</CardTitle>
                <CardDescription>Request not found.</CardDescription>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      QnA request
                    </CardTitle>
                    <CardDescription className="break-words text-[15px] font-semibold leading-relaxed tracking-tight text-foreground/90">
                      {request.prompt}
                    </CardDescription>
                    <div className="text-xs text-muted-foreground">
                      by{" "}
                      <Link href={`/u/${encodeURIComponent(request.requesterSlug)}`} className="text-primary hover:underline">
                        @{request.requesterName}
                      </Link>
                      {" · "}
                      {new Date(request.created_at).toLocaleString()}
                    </div>
                  </div>
                  <Badge variant="secondary" className="mt-1 shrink-0">
                    Claims {claimsCount}
                  </Badge>
                </div>
              </>
            )}
          </CardHeader>

          {request ? (
            <CardContent className="flex flex-wrap items-center gap-2">
              {canClaim ? (
                <Button onClick={handleClaim} disabled={claiming}>
                  <Tag className="h-4 w-4" />
                  {claiming ? "Claiming..." : "Claim this request"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : alreadyClaimed ? (
                <Badge variant="success">You claimed this request</Badge>
              ) : alreadySubmitted ? (
                <Badge variant="secondary">You already answered this request</Badge>
              ) : handledByNiceReco ? (
                <Badge variant="secondary">You already used Nice Reco</Badge>
              ) : userId === request.requester_id ? (
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Lock className="mt-0.5 h-4 w-4" />
                  You cannot claim your own request.
                </div>
              ) : (
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Lock className="mt-0.5 h-4 w-4" />
                  Claim is unavailable right now.
                </div>
              )}
            </CardContent>
          ) : null}
        </Card>

        {/* Answer submission */}
        {request && alreadyClaimed && !handledByNiceReco && !alreadySubmitted ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <Card>
              <CardHeader>
                <CardTitle>Leave your Reco</CardTitle>
                <CardDescription>
                  Pick a track that fits this request and add a short comment.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleSearchSubmit} className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search a song"
                    className="min-h-[44px] w-full"
                  />
                  <Button type="submit" disabled={searching || !query.trim()} className="min-h-[44px] shrink-0 sm:w-auto">
                    <Search className="h-4 w-4" />
                    {searching ? "Searching..." : "Search"}
                  </Button>
                </form>

                {tracks.length ? (
                  <motion.div
                    initial="hidden"
                    animate="show"
                    variants={{
                      hidden: { opacity: 0, y: 8 },
                      show: { opacity: 1, y: 0, transition: { staggerChildren: 0.04 } },
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
                  <form onSubmit={handleSubmitAnswer} className="space-y-3">
                    <div className="rounded-2xl border border-border bg-accent/30 px-4 py-3">
                      <div className="text-xs text-muted-foreground">Selected</div>
                      <div className="text-sm font-semibold">
                        {selected.name} — {selected.artists}
                      </div>
                    </div>
                    <Textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="One line: why this song?"
                    />
                    <Button type="submit" disabled={submittingAnswer}>
                      {submittingAnswer ? "Submitting..." : "Submit answer"}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </form>
                ) : null}
              </CardContent>
            </Card>
          </motion.div>
        ) : null}

        {/* Answers list */}
        {request ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Answers</CardTitle>
                <Badge variant="secondary">{answers.length}</Badge>
              </div>
              <CardDescription>
                The requester can choose one answer as Best Reco.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!answers.length ? (
                <EmptyState
                  icon={Search}
                  title="No answers yet"
                  description="No answers yet for this request."
                />
              ) : (
                <motion.div
                  initial="hidden"
                  animate="show"
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    show: { opacity: 1, y: 0, transition: { staggerChildren: 0.05 } },
                  }}
                  className="grid gap-3"
                >
                  {answers.map((ans) => {
                    const isBest = request.best_answer_id === ans.id;
                    const isMine = ans.responder_id === userId;
                    return (
                      <motion.div
                        key={ans.id}
                        variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                        whileHover={{ scale: 1.01 }}
                        transition={{ duration: 0.15 }}
                      >
                        <Card className={isBest ? "border-primary/70 bg-primary/5" : ""}>
                          <CardContent className="space-y-2.5 p-3 sm:p-5">
                            {/* Top row: cover + title/artist + badges */}
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl border border-border bg-card sm:h-16 sm:w-16">
                                {ans.albumImage ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={ans.albumImage}
                                    alt={ans.trackName}
                                    className="h-full w-full object-cover"
                                  />
                                ) : null}
                              </div>
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <div className="truncate text-sm font-semibold">{ans.trackName}</div>
                                  {isBest ? (
                                    <Badge className="gap-1">
                                      <Crown className="h-3.5 w-3.5" />
                                      Best Reco
                                    </Badge>
                                  ) : null}
                                  {isMine && !isBest ? (
                                    <Badge variant="secondary">My answer</Badge>
                                  ) : null}
                                </div>
                                <div className="truncate text-xs text-muted-foreground">
                                  {ans.artistName}
                                </div>
                              </div>
                            </div>

                            {/* Second row: metadata */}
                            <div className="text-xs text-muted-foreground">
                              <span className="font-medium">{ans.niceRecoCount}</span>{" "}
                              {ans.niceRecoCount === 1 ? "reco" : "recos"} • by{" "}
                              <Link
                                href={`/u/${encodeURIComponent(ans.responderSlug)}`}
                                className="font-medium text-primary hover:underline"
                              >
                                @{ans.responderName}
                              </Link>
                            </div>

                            {/* Third row: comment preview */}
                            {ans.comment ? (
                              <ExpandableText
                                text={ans.comment}
                                maxChars={160}
                                variant="compact-card"
                                toggleAriaLabel="Toggle answer comment expansion"
                              />
                            ) : null}

                            {/* Bottom row: buttons */}
                            <div className="flex flex-row flex-wrap items-center gap-2 pt-0.5">
                              {ans.trackId ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setExpandedPlayAnswerId((prev) =>
                                      prev === ans.id ? null : ans.id,
                                    )
                                  }
                                  className="px-3 py-1.5 text-xs"
                                >
                                  <Play className="mr-1 h-3.5 w-3.5" />
                                  {expandedPlayAnswerId === ans.id ? "Hide" : "Play"}
                                </Button>
                              ) : null}
                              {userId ? (
                                <Button
                                  variant={ans.likedByMe ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => handleNiceReco(ans.id)}
                                  className={cn(
                                    "px-3 py-1.5 text-xs",
                                    ans.likedByMe && "bg-blue-600 text-white hover:bg-blue-500",
                                  )}
                                  disabled={
                                    !!niceRecoSubmittingId ||
                                    ans.likedByMe ||
                                    handledByNiceReco ||
                                    userId === request.requester_id ||
                                    answers.some((a) => a.responder_id === userId)
                                  }
                                >
                                  <ThumbsUp className="mr-1 h-3.5 w-3.5" />
                                  {ans.likedByMe
                                    ? "Liked"
                                    : niceRecoSubmittingId === ans.id
                                    ? "Saving..."
                                    : "Nice Reco"}{" "}
                                  ({ans.niceRecoCount})
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  Nice Reco ({ans.niceRecoCount})
                                </span>
                              )}
                              {userId === request.requester_id && !isBest ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => markBest(ans.id)}
                                  className="px-3 py-1.5 text-xs"
                                >
                                  <Crown className="mr-1 h-3.5 w-3.5" />
                                  Best Reco
                                </Button>
                              ) : null}
                            </div>

                            {/* Spotify player */}
                            {expandedPlayAnswerId === ans.id && ans.trackId ? (
                              <iframe
                                className="mt-1.5 w-full rounded-xl border border-border"
                                src={`https://open.spotify.com/embed/track/${ans.trackId}`}
                                width="100%"
                                height="80"
                                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                                loading="lazy"
                                title={`Play ${ans.trackName}`}
                              />
                            ) : null}

                            <div className="text-xs text-muted-foreground">
                              {new Date(ans.created_at).toLocaleString()}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {status ? (
          <div className="rounded-2xl border border-border bg-accent px-4 py-3 text-sm">
            {status}
          </div>
        ) : null}
      </div>
    </main>
  );
}

