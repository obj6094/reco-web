"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getDisplayName } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { EmptyState } from "@/components/EmptyState";
import { ArrowRight, ChevronDown, ChevronUp, Play, Search, ThumbsUp, Trophy, Music2 } from "lucide-react";
import { SubmissionCard, type SubmissionCardData } from "@/components/SubmissionCard";
import { ExpandableText } from "@/components/ExpandableText";

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
  ends_at: string | null;
};

export default function ChallengePage() {
  const router = useRouter();
  const [challenge, setChallenge] = useState<any>(null);

  // ??? ???
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // ???
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [selected, setSelected] = useState<Track | null>(null);

  // ??? ????
  const [comment, setComment] = useState("");

  // ??? / ??? ???
  const [status, setStatus] = useState("");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [mySubmission, setMySubmission] = useState<Submission | null>(null);
  const [votingOnId, setVotingOnId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"votes" | "recent">("votes");
  const [pastChallenges, setPastChallenges] = useState<PastChallengeItem[]>([]);
  const [loadingPast, setLoadingPast] = useState(false);

  const embedUrl = useMemo(() => {
    if (!selected) return null;
    return `https://open.spotify.com/embed/track/${selected.id}`;
  }, [selected]);

  useEffect(() => {
    async function boot() {
      // ???????? ??????(??? ??)
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;
      setUserId(uid);

      // ????????: ???????????/login ??? ???????
      if (!uid) {
        setAuthChecked(true);
      }

      if (uid) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", uid)
          .maybeSingle();
        if (!profile?.username) {
          router.replace("/setup-account");
          setAuthChecked(true);
          return;
        }
      }

      // Time-based current challenge: starts_at <= now < ends_at
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("weekly_challenges")
        .select("*")
        .lte("starts_at", now)
        .gt("ends_at", now)
        .order("starts_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        setStatus("Failed to load challenge: " + error.message);
      } else {
        setChallenge(data ?? null);
      }

      setAuthChecked(true);
    }

    boot();
  }, [router]);

  useEffect(() => {
    if (!challenge) return;

    async function loadSubmissions() {
      setLoadingSubmissions(true);
      setStatus("");

      // ??? ??????? ??? + ??? ??? ?????
      // ?????(challenge_submissions) ??? ????????? ???????? (??? ????? ???/????? ??)
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
  const previewSubmissions = sortedSubmissions.slice(0, 4);
  const previewPastChallenges = pastChallenges.slice(0, 4);

  function challengeDuration(startsAt: string | null, endsAt: string | null): string {
    if (!startsAt || !endsAt) return "";
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    return `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`;
  }

  function challengeDday(endsAt: string | null): string {
    if (!endsAt) return "";
    const end = new Date(endsAt);
    end.setHours(23, 59, 59, 999);
    const now = new Date();
    const diffMs = end.getTime() - now.getTime();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (days < 0) return "Closed";
    if (days === 0) return "D-Day";
    return `D-${days}`;
  }

  useEffect(() => {
    const now = new Date().toISOString();
    async function loadPast() {
      setLoadingPast(true);
      const { data, error } = await supabase
        .from("weekly_challenges")
        .select("id, prompt, starts_at, ends_at")
        .lt("ends_at", now)
        .order("starts_at", { ascending: false })
        .limit(8);

      if (error) {
        setLoadingPast(false);
        return;
      }

      setPastChallenges((data ?? []) as PastChallengeItem[]);
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
      // Spotify ????? /api ??????? ?????? ??? (env ??? ??? ????????? ???)
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
      // ????????unique ?????????? ?????????????????????
      setStatus("You already submitted for this challenge. Changes are not allowed.");
      return;
    }
    if (!selected) {
      setStatus("Please select a track first.");
      return;
    }

    // challenge_submissions ????? ????(Supabase env??lib/supabaseClient.ts????????)
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
      // unique(challenge_id, user_id) ?????1??1????????? ?????
      setStatus("Submit failed: " + error.message);
      return;
    }

    setStatus("Submitted!");
    setComment("");
    setSelected(null);

    // ?????/?? ?????
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
      // ??????????? ????????????????
      router.replace("/login");
      return;
    }

    if (submission.isMine) {
      setStatus("You cannot vote for your own submission.");
      return;
    }

    setVotingOnId(submission.id);

    // Optimistic update
    const before = submissions;
    const optimistic = sortSubmissions(
      submissions.map((s) => {
        if (submission.viewerVoted && s.id === submission.id) {
          // Unvote: remove vote from this submission
          return {
            ...s,
            viewerVoted: false,
            voteCount: Math.max(0, s.voteCount - 1),
          };
        }
        if (!submission.viewerVoted && s.id === submission.id) {
          // Vote: add to this, remove from any other (one per challenge)
          return {
            ...s,
            viewerVoted: true,
            voteCount: s.voteCount + 1,
          };
        }
        if (!submission.viewerVoted && s.viewerVoted) {
          // Moving vote: remove from previously voted
          return {
            ...s,
            viewerVoted: false,
            voteCount: Math.max(0, s.voteCount - 1),
          };
        }
        return s;
      })
    );
    setSubmissions(optimistic);
    setMySubmission(optimistic.find((s) => s.isMine) ?? null);

    try {
      if (submission.viewerVoted) {
        // ???? ??????? -> ??
        const { error } = await supabase
          .from("challenge_votes")
          .delete()
          .eq("submission_id", submission.id)
          .eq("voter_id", userId);

        if (error) {
          // ?????? ???
          setSubmissions(before);
          setMySubmission(before.find((s) => s.isMine) ?? null);
          setStatus("Failed to remove vote: " + error.message);
        }
      } else {
        // Add vote: one vote per challenge - remove any existing vote first
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

        // Remove any existing vote by this user in this challenge (one vote per challenge)
        if (challenge) {
          const submissionIds = submissions.map((s) => s.id);
          await supabase
            .from("challenge_votes")
            .delete()
            .eq("voter_id", userId)
            .in("submission_id", submissionIds);
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
      // ??? ??????????????? ??/?????????
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
              <CardDescription>Loading this week&apos;s challenge?</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100dvh-120px)] bg-background px-3 py-6 text-foreground sm:px-4 sm:py-8 md:py-10">
      <div className="mx-auto w-full max-w-5xl space-y-6 sm:space-y-8">
        <section className="rounded-2xl border border-border bg-card px-4 py-6 sm:px-6 sm:py-8 md:px-10 md:py-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Weekly Challenge</p>
          <h1 className="mt-2 break-words text-2xl font-extrabold tracking-tight sm:text-3xl md:text-4xl lg:text-5xl">
            {challenge.prompt}
          </h1>
          {userId ? (
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {challengeDuration(challenge.starts_at, challenge.ends_at)}
              </span>
              <Badge className="border border-primary/40 bg-primary/10 text-primary">
                {challengeDday(challenge.ends_at)}
              </Badge>
              <p className="text-sm text-muted-foreground">
                Submit your track here. Voting is available in the submissions list below.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              <span className="block text-sm text-muted-foreground">
                {challengeDuration(challenge.starts_at, challenge.ends_at)}
              </span>
              <Badge className="w-fit border border-primary/40 bg-primary/10 text-primary">
                {challengeDday(challenge.ends_at)}
              </Badge>
              <div className="rounded-2xl border border-border bg-accent/30 p-3 sm:p-4">
                <p className="text-sm text-foreground/90">
                  Log in or sign up to submit your track and vote on submissions.
                </p>
                <div className="mt-3 flex flex-wrap gap-2 [&>a]:min-h-[44px]">
                  <Button asChild className="min-h-[44px] min-w-24">
                    <Link href="/login?mode=login">Log in</Link>
                  </Button>
                  <Button variant="outline" asChild className="min-h-[44px] min-w-24">
                    <Link href="/login?mode=signup">Sign up</Link>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {userId && !mySubmission ? (
            <div className="mt-6 space-y-4 rounded-2xl border border-border bg-accent/30 p-3 sm:p-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (query.trim()) searchTracks();
                }}
                className="flex flex-col gap-2 sm:flex-row"
              >
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search a song (e.g., Radiohead Creep)"
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
                      {selected.name} - {selected.artists}
                    </div>
                  </div>

                  {embedUrl ? (
                    <iframe
                      className="w-full rounded-2xl border border-border"
                      src={embedUrl}
                      width="100%"
                      height="80"
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
            </div>
          ) : null}
        </section>

        {!authChecked ? (
          <Card>
            <CardHeader>
              <CardTitle>Loading</CardTitle>
              <CardDescription>Checking your session?</CardDescription>
            </CardHeader>
          </Card>
        ) : !userId ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>This week&apos;s standings</CardTitle>
                <CardDescription>Browse submissions and sort by votes or recent entries.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">Sort:</span>
                  <div className="flex h-9 min-h-[44px] items-center rounded-xl border border-border bg-muted/40 p-1">
                    <button
                      type="button"
                      onClick={() => setSortBy("votes")}
                      className="relative h-7 rounded-lg px-3 text-sm font-medium transition-colors"
                    >
                      {sortBy === "votes" ? (
                        <motion.span
                          layoutId="submission-sort-pill"
                          className="absolute inset-0 rounded-lg bg-primary"
                          transition={{ type: "spring", stiffness: 420, damping: 32 }}
                        />
                      ) : null}
                      <span
                        className={`relative z-10 ${
                          sortBy === "votes" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Most Voted
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSortBy("recent")}
                      className="relative h-7 rounded-lg px-3 text-sm font-medium transition-colors"
                    >
                      {sortBy === "recent" ? (
                        <motion.span
                          layoutId="submission-sort-pill"
                          className="absolute inset-0 rounded-lg bg-primary"
                          transition={{ type: "spring", stiffness: 420, damping: 32 }}
                        />
                      ) : null}
                      <span
                        className={`relative z-10 ${
                          sortBy === "recent" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Most Recent
                      </span>
                    </button>
                  </div>
                </div>
                <div className="mt-4">
                  {loadingSubmissions && !submissions.length ? (
                    <div className="text-sm text-muted-foreground">Loading submissions...</div>
                  ) : submissions.length === 0 ? (
                    <EmptyState
                      icon={Music2}
                      title="No submissions yet"
                      description="No one has submitted to this challenge yet."
                    />
                  ) : (
                    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {previewSubmissions.map((s) => {
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
                            <SubmissionCard submission={data} canVote={false} variant="compact" />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                {submissions.length > previewSubmissions.length ? (
                  <div className="mt-4">
                    <Button variant="outline" asChild>
                      <Link href="/challenge/submissions">View all</Link>
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </>
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
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-border bg-card">
                          {mySubmission.albumImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={mySubmission.albumImage} alt={mySubmission.trackName} className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-base font-semibold">{mySubmission.trackName}</div>
                          <div className="truncate text-sm text-muted-foreground">{mySubmission.artistName}</div>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-xs text-muted-foreground">Votes</div>
                        <div className="text-2xl font-extrabold text-primary">{mySubmission.voteCount}</div>
                      </div>
                    </div>
                    {mySubmission.comment ? (
                      <div className="w-full rounded-2xl border border-border bg-accent/40 px-3 py-2.5 text-sm break-words">
                        <ExpandableText
                          text={mySubmission.comment}
                          maxChars={140}
                          toggleAriaLabel="Toggle challenge submission comment"
                        />
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </motion.div>
            ) : null}

            <Card id="submissions">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <CardTitle className="w-full sm:w-auto">Submissions</CardTitle>
                  <span className="text-sm text-muted-foreground shrink-0">Sort:</span>
                  <div className="flex h-9 min-h-[44px] items-center rounded-xl border border-border bg-muted/40 p-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setSortBy("votes")}
                        className="relative h-7 rounded-lg px-3 text-sm font-medium transition-colors"
                      >
                        {sortBy === "votes" ? (
                          <motion.span
                            layoutId="submission-sort-pill"
                            className="absolute inset-0 rounded-lg bg-primary"
                            transition={{ type: "spring", stiffness: 420, damping: 32 }}
                          />
                        ) : null}
                        <span
                          className={`relative z-10 ${
                            sortBy === "votes" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Most Voted
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSortBy("recent")}
                        className="relative h-7 rounded-lg px-3 text-sm font-medium transition-colors"
                      >
                        {sortBy === "recent" ? (
                          <motion.span
                            layoutId="submission-sort-pill"
                            className="absolute inset-0 rounded-lg bg-primary"
                            transition={{ type: "spring", stiffness: 420, damping: 32 }}
                          />
                        ) : null}
                        <span
                          className={`relative z-10 ${
                            sortBy === "recent" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Most Recent
                        </span>
                      </button>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {loadingSubmissions ? "?" : `${submissions.length} entries`}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {loadingSubmissions && !submissions.length ? (
                  <div className="text-sm text-muted-foreground">Loading submissions?</div>
                ) : submissions.length === 0 ? (
                  <EmptyState
                    icon={Music2}
                    title="No submissions yet"
                    description="Be the first to submit a track for this week."
                  />
                ) : (
                  <motion.ul
                    layout
                    className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                    transition={{ type: "spring", stiffness: 260, damping: 28 }}
                  >
                    {previewSubmissions.map((s) => {
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
                        <motion.li
                          key={s.id}
                          layout
                          whileHover={{ scale: 1.01 }}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.18 }}
                        >
                          <SubmissionCard
                            submission={data}
                            canVote
                            onVote={() => toggleVote(s)}
                            voting={votingOnId === s.id}
                          />
                        </motion.li>
                      );
                    })}
                  </motion.ul>
                )}

                {submissions.length > previewSubmissions.length ? (
                  <div className="mt-4">
                    <Button variant="outline" asChild>
                      <Link href="/challenge/submissions">View all</Link>
                    </Button>
                  </div>
                ) : null}

                {status && mySubmission ? (
                  <div className="mt-4 rounded-2xl border border-border bg-accent px-4 py-3 text-sm">
                    {status}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </>
        )}

        {/* Past Challenges */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              Past Challenges
            </CardTitle>
            <CardDescription>Previous challenges and their date ranges.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingPast ? (
              <div className="text-sm text-muted-foreground">Loading past challenges?</div>
            ) : pastChallenges.length === 0 ? (
              <EmptyState
                icon={Trophy}
                title="No past challenges"
                description="Previous weeks will appear here."
              />
            ) : (
              <ul className="space-y-2">
                {previewPastChallenges.map((past) => (
                  <li key={past.id}>
                    <Link
                      href={`/challenge/past/${past.id}`}
                      className="block rounded-2xl border border-border bg-accent/30 px-3 py-3 hover:bg-accent/40 transition-colors"
                    >
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                        <div className="text-sm font-semibold break-words sm:max-w-[70%]">
                          {past.prompt}
                        </div>
                        <div className="text-xs text-muted-foreground sm:text-right">
                          {past.starts_at && past.ends_at
                            ? `${new Date(past.starts_at).toLocaleDateString()} – ${new Date(
                                past.ends_at,
                              ).toLocaleDateString()}`
                            : "-"}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {pastChallenges.length > previewPastChallenges.length ? (
              <div className="mt-4">
                <Button variant="outline" asChild>
                  <Link href="/challenge/past">View all</Link>
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {status && !mySubmission ? (
          <div className="rounded-2xl border border-border bg-accent px-4 py-3 text-sm">
            {status}
          </div>
        ) : null}
      </div>
    </main>
  );
}