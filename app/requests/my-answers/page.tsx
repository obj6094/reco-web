"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

type Item = {
  request_id: string;
  created_at: string;
  prompt: string;
};

export default function MyAnswersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        router.replace("/login");
        return;
      }

      const { data: answerRows } = await supabase
        .from("qna_answers")
        .select("request_id, created_at")
        .eq("responder_id", uid)
        .order("created_at", { ascending: false });

      const reqIds = [...new Set((answerRows ?? []).map((r: any) => r.request_id))];
      if (!reqIds.length) {
        setItems([]);
        setLoading(false);
        return;
      }

      const { data: reqs } = await supabase
        .from("qna_requests")
        .select("id, prompt")
        .in("id", reqIds);

      const byId: Record<string, string> = {};
      (reqs ?? []).forEach((r: any) => {
        byId[r.id] = r.prompt;
      });

      const seen = new Set<string>();
      const mapped: Item[] = (answerRows ?? [])
        .filter((r: any) => {
          if (seen.has(r.request_id)) return false;
          seen.add(r.request_id);
          return true;
        })
        .map((r: any) => ({
          request_id: r.request_id,
          created_at: r.created_at,
          prompt: byId[r.request_id] ?? "",
        }));

      setItems(mapped);
      setLoading(false);
    }

    load();
  }, [router]);

  return (
    <main className="min-h-[calc(100vh-56px)] bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-4xl space-y-4">
        <Button variant="ghost" asChild className="px-0">
          <Link href="/requests">
            <ArrowLeft className="h-4 w-4" />
            Back to requests
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>My answers</CardTitle>
            <CardDescription>All requests you answered.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-muted-foreground">No answers yet.</div>
            ) : (
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.request_id} className="rounded-xl border border-border bg-accent/30 px-3 py-3">
                    <div className="text-sm font-semibold">{item.prompt}</div>
                    <div className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
