"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { EmptyState } from "@/components/EmptyState";
import { ArrowRight, MessageCirclePlus, Send, Inbox, CheckCircle } from "lucide-react";

type QueueRequest = {
  id: string;
  prompt: string;
  created_at: string;
  answersCount: number;
};

type MyRequest = {
  id: string;
  prompt: string;
  created_at: string;
  answersCount: number;
  best_answer_id: string | null;
};

type MyAnswerEntry = {
  request_id: string;
  prompt: string;
  created_at: string;
};

export default function RequestsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [prompt, setPrompt] = useState("");
  const [creating, setCreating] = useState(false);

  const [queueForYou, setQueueForYou] = useState<QueueRequest[]>([]);
  const [myRequests, setMyRequests] = useState<MyRequest[]>([]);
  const [myAnswers, setMyAnswers] = useState<MyAnswerEntry[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [loadingMine, setLoadingMine] = useState(false);
  const [status, setStatus] = useState("");

  const loadQueue = useCallback(async (uid: string) => {
    setLoadingQueue(true);
    setStatus("");
    const { data: answeredRows } = await supabase
      .from("qna_answers")
      .select("request_id")
      .eq("responder_id", uid);
    const answeredIds = new Set((answeredRows ?? []).map((r: any) => r.request_id));
    const { data, error } = await supabase
      .from("qna_requests")
      .select("id, prompt, created_at, qna_answers(id)")
      .is("best_answer_id", null)
      .neq("requester_id", uid)
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) {
      setStatus("Failed to load requests: " + error.message);
      setLoadingQueue(false);
      return;
    }
    const withCount = (data ?? []).map((row: any) => ({
      id: row.id,
      prompt: row.prompt,
      created_at: row.created_at,
      answersCount: (row.qna_answers ?? []).length,
    }));
    const filtered = withCount.filter((r) => !answeredIds.has(r.id)).slice(0, 3);
    setQueueForYou(filtered);
    setLoadingQueue(false);
  }, []);

  const loadMyRequests = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from("qna_requests")
      .select("id, prompt, created_at, best_answer_id, qna_answers(id)")
      .eq("requester_id", uid)
      .order("created_at", { ascending: false });
    if (error) {
      setStatus("Failed to load my requests: " + error.message);
      return;
    }
    setMyRequests(
      (data ?? []).map((row: any) => ({
        id: row.id,
        prompt: row.prompt,
        created_at: row.created_at,
        answersCount: (row.qna_answers ?? []).length,
        best_answer_id: row.best_answer_id ?? null,
      }))
    );
  }, []);

  const loadMyAnswers = useCallback(async (uid: string) => {
    const { data: ansRows, error: ansError } = await supabase
      .from("qna_answers")
      .select("request_id")
      .eq("responder_id", uid)
      .order("created_at", { ascending: false });
    if (ansError || !ansRows?.length) {
      setMyAnswers([]);
      return;
    }
    const reqIds = [...new Set(ansRows.map((r: any) => r.request_id))];
    const { data: reqData } = await supabase
      .from("qna_requests")
      .select("id, prompt, created_at")
      .in("id", reqIds);
    const byId: Record<string, { prompt: string; created_at: string }> = {};
    (reqData ?? []).forEach((r: any) => {
      byId[r.id] = { prompt: r.prompt, created_at: r.created_at };
    });
    const seen = new Set<string>();
    setMyAnswers(
      ansRows
        .filter((r: any) => {
          if (seen.has(r.request_id)) return false;
          seen.add(r.request_id);
          return true;
        })
        .map((r: any) => ({
          request_id: r.request_id,
          prompt: byId[r.request_id]?.prompt ?? "",
          created_at: byId[r.request_id]?.created_at ?? "",
        }))
    );
  }, []);

  useEffect(() => {
    async function boot() {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      setUserId(uid);
      setAuthChecked(true);
      if (!uid) {
        router.replace("/login");
        return;
      }
      setLoadingMine(true);
      await loadQueue(uid);
      await loadMyRequests(uid);
      await loadMyAnswers(uid);
      setLoadingMine(false);
    }
    boot();
  }, [router, loadQueue, loadMyRequests, loadMyAnswers]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setStatus("");
    if (!userId) {
      setStatus("You must be logged in to create a request.");
      return;
    }
    if (!prompt.trim()) {
      setStatus("Please enter a prompt.");
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("qna_requests").insert({
      prompt: prompt.trim(),
      requester_id: userId,
    });
    if (error) {
      setStatus("Failed to create request: " + error.message);
      setCreating(false);
      return;
    }
    setPrompt("");
    setStatus("Request created.");
    setCreating(false);
    await loadMyRequests(userId);
  }

  function myRequestStatus(req: MyRequest): { label: string; variant: "secondary" | "default" | "success" } {
    if (req.best_answer_id) return { label: "Best selected", variant: "success" };
    if (req.answersCount > 0) return { label: "Choose best", variant: "default" };
    return { label: "Awaiting answers", variant: "secondary" };
  }

  return (
    <main className="min-h-[calc(100vh-56px)] bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight">Requests</h1>
          <p className="text-sm text-muted-foreground">
            Ask for a Reco or answer others&apos; requests. Your requests and answers appear below.
          </p>
        </div>

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
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCirclePlus className="h-4 w-4 text-primary" />
                    Ask for a Reco
                  </CardTitle>
                  <CardDescription>
                    Describe your mood or situation and others can recommend a track.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <form onSubmit={handleCreate} className="space-y-3">
                    <Textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="e.g. A song for late-night coding."
                    />
                    <Button type="submit" disabled={creating}>
                      {creating ? "Creating…" : "Create request"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </form>
                  {status ? (
                    <div className="rounded-2xl border border-border bg-accent px-4 py-3 text-sm">{status}</div>
                  ) : null}
                </CardContent>
              </Card>
            </motion.div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <Inbox className="h-4 w-4 text-primary" />
                    Requests for you
                  </CardTitle>
                  <Badge variant="secondary">
                    {loadingQueue ? "…" : `${queueForYou.length} of 3`}
                  </Badge>
                </div>
                <CardDescription>
                  Up to 3 open requests you haven&apos;t answered yet (oldest first). Answer from the detail page.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingQueue && !queueForYou.length ? (
                  <div className="text-sm text-muted-foreground">Loading…</div>
                ) : queueForYou.length === 0 ? (
                  <EmptyState
                    icon={Inbox}
                    title="No requests for you right now"
                    description="Check back later or ask for a Reco above."
                  />
                ) : (
                  <ul className="grid gap-3 md:grid-cols-3">
                    {queueForYou.map((req) => (
                      <li key={req.id}>
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.15 }}
                          whileHover={{ scale: 1.01 }}
                        >
                          <Card className="h-full">
                            <CardHeader className="space-y-2">
                              <CardTitle className="text-sm font-medium leading-snug line-clamp-2">
                                {req.prompt}
                              </CardTitle>
                              <CardDescription className="text-xs">
                                {new Date(req.created_at).toLocaleString()}
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <Button variant="outline" size="sm" asChild className="w-full">
                                <Link href={`/requests/${req.id}`}>
                                  View & answer <ArrowRight className="ml-1 h-3 w-3" />
                                </Link>
                              </Button>
                            </CardContent>
                          </Card>
                        </motion.div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <Send className="h-4 w-4 text-primary" />
                    My Requests
                  </CardTitle>
                  <Badge variant="secondary">{myRequests.length}</Badge>
                </div>
                <CardDescription>Requests you created. Open one to choose a Best Reco.</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingMine && !myRequests.length ? (
                  <div className="text-sm text-muted-foreground">Loading…</div>
                ) : myRequests.length === 0 ? (
                  <EmptyState
                    icon={Send}
                    title="No requests yet"
                    description="Create a request above to get recommendations."
                  />
                ) : (
                  <ul className="space-y-2">
                    {myRequests.map((req) => {
                      const { label, variant } = myRequestStatus(req);
                      return (
                        <li key={req.id}>
                          <Card>
                            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium leading-snug">{req.prompt}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {new Date(req.created_at).toLocaleString()} · {req.answersCount} answer(s)
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={variant}>{label}</Badge>
                                <Button variant="outline" size="sm" asChild>
                                  <Link href={`/requests/${req.id}`}>View</Link>
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    My Answers
                  </CardTitle>
                  <Badge variant="secondary">{myAnswers.length}</Badge>
                </div>
                <CardDescription>Requests you answered. Open to see if your Reco was chosen.</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingMine && !myAnswers.length ? (
                  <div className="text-sm text-muted-foreground">Loading…</div>
                ) : myAnswers.length === 0 ? (
                  <EmptyState
                    icon={CheckCircle}
                    title="No answers yet"
                    description="Answer a request from &quot;Requests for you&quot; and it will appear here."
                  />
                ) : (
                  <ul className="space-y-2">
                    {myAnswers.map((entry) => (
                      <li key={entry.request_id}>
                        <Card>
                          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                            <p className="min-w-0 flex-1 font-medium leading-snug line-clamp-2">{entry.prompt}</p>
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/requests/${entry.request_id}`}>View</Link>
                            </Button>
                          </CardContent>
                        </Card>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
