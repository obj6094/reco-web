"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { EmptyState } from "@/components/EmptyState";
import { ArrowRight, MessageCirclePlus, MessagesSquare, Tag } from "lucide-react";

type RequestItem = {
  id: string;
  prompt: string;
  requester_id: string;
  created_at: string;
  claimsCount: number;
};

export default function RequestsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [prompt, setPrompt] = useState("");
  const [creating, setCreating] = useState(false);

  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    async function boot() {
      // 인증 유저 확인 (RLS 에서 requester_id 를 맞추기 위해 필요)
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      setUserId(uid);
      setAuthChecked(true);

      // 보호된 페이지: 로그인 안 했으면 /login 으로 리다이렉트
      if (!uid) {
        router.replace("/login");
        return;
      }

      await loadRequests();
    }

    async function loadRequests() {
      setLoading(true);
      setStatus("");

      const { data, error } = await supabase
        .from("qna_requests")
        .select(
          "id, prompt, requester_id, created_at, best_answer_id, qna_claims(id)"
        )
        .is("best_answer_id", null)
        .order("created_at", { ascending: false });

      if (error) {
        setStatus("요청 목록을 불러오지 못했어: " + error.message);
        setLoading(false);
        return;
      }

      const mapped: RequestItem[] =
        data?.map((row: any) => ({
          id: row.id,
          prompt: row.prompt,
          requester_id: row.requester_id,
          created_at: row.created_at,
          claimsCount: (row.qna_claims ?? []).length,
        })) ?? [];

      setRequests(mapped);
      setLoading(false);
    }

    boot();
  }, [router]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setStatus("");

    if (!userId) {
      setStatus("요청을 만들려면 로그인해야 해.");
      return;
    }
    if (!prompt.trim()) {
      setStatus("프롬프트를 적어줘.");
      return;
    }

    setCreating(true);
    const { error } = await supabase.from("qna_requests").insert({
      prompt: prompt.trim(),
      requester_id: userId,
    });

    if (error) {
      setStatus("요청 생성에 실패했어: " + error.message);
      setCreating(false);
      return;
    }

    setPrompt("");
    setStatus("요청이 생성되었어.");
    setCreating(false);

    // 새 요청 포함해서 다시 불러오기
    const { data, error: reloadError } = await supabase
      .from("qna_requests")
      .select("id, prompt, requester_id, created_at, best_answer_id, qna_claims(id)")
      .is("best_answer_id", null)
      .order("created_at", { ascending: false });

    if (!reloadError && data) {
      const mapped: RequestItem[] = data.map((row: any) => ({
        id: row.id,
        prompt: row.prompt,
        requester_id: row.requester_id,
        created_at: row.created_at,
        claimsCount: (row.qna_claims ?? []).length,
      }));
      setRequests(mapped);
    }
  }

  return (
    <main className="min-h-[calc(100vh-56px)] bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight">Requests</h1>
          <p className="text-sm text-muted-foreground">
            곡 추천이 필요할 때 요청을 남기고, 다른 사람의 요청에 Reco를 남겨봐.
          </p>
        </div>

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
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCirclePlus className="h-4 w-4 text-primary" />
                    Ask for a Reco
                  </CardTitle>
                  <CardDescription>
                    상황이나 기분을 설명하면, 다른 사람들이 곡을 추천해 줄 거야.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <form onSubmit={handleCreate} className="space-y-3">
                    <Textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="예: 밤에 집중해서 코딩할 때 들을 곡 추천해줘."
                    />
                    <div className="flex items-center gap-2">
                      <Button type="submit" disabled={creating}>
                        {creating ? "Creating..." : "Create request"}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                      <Badge variant="secondary" className="gap-1">
                        <Tag className="h-3.5 w-3.5" />
                        max 3 claimers
                      </Badge>
                    </div>
                  </form>

                  {status ? (
                    <div className="rounded-2xl border border-border bg-accent px-4 py-3 text-sm">
                      {status}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </motion.div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <MessagesSquare className="h-4 w-4 text-primary" />
                    Open requests
                  </CardTitle>
                  <Badge variant="secondary">{loading ? "Loading..." : `${requests.length}`}</Badge>
                </div>
                <CardDescription>Newest first · open only</CardDescription>
              </CardHeader>
              <CardContent>
                {loading && !requests.length ? (
                  <div className="text-sm text-muted-foreground">요청 목록을 불러오는 중이야...</div>
                ) : !requests.length ? (
                  <EmptyState
                    icon={MessagesSquare}
                    title="No requests yet"
                    description="첫 번째 요청을 남겨서 추천을 받아볼래?"
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
                    {requests.map((req) => (
                      <motion.div
                        key={req.id}
                        variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                        whileHover={{ scale: 1.01 }}
                        transition={{ duration: 0.15 }}
                      >
                        <Card className="h-full">
                          <CardHeader className="space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <CardTitle className="text-base leading-6">{req.prompt}</CardTitle>
                              <Badge variant="secondary">Claims {req.claimsCount}/3</Badge>
                            </div>
                            <CardDescription>{new Date(req.created_at).toLocaleString()}</CardDescription>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <Button variant="outline" size="sm" asChild className="w-full">
                              <Link href={`/requests/${req.id}`}>
                                View <ArrowRight className="h-4 w-4" />
                              </Link>
                            </Button>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}

