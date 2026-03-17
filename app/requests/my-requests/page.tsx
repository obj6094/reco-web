"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

type Item = {
  id: string;
  prompt: string;
  created_at: string;
  best_answer_id: string | null;
};

export default function MyRequestsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "selected">("all");

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        router.replace("/login");
        return;
      }

      const { data } = await supabase
        .from("qna_requests")
        .select("id, prompt, created_at, best_answer_id")
        .eq("requester_id", uid)
        .order("created_at", { ascending: false });

      setItems((data ?? []) as Item[]);
      setLoading(false);
    }

    load();
  }, [router]);

  const filtered = useMemo(() => {
    if (filter === "selected") return items.filter((i) => !!i.best_answer_id);
    if (filter === "pending") return items.filter((i) => !i.best_answer_id);
    return items;
  }, [items, filter]);

  return (
    <main className="min-h-[calc(100dvh-120px)] bg-background px-3 py-6 text-foreground sm:px-4 sm:py-8 md:py-10">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <Button variant="ghost" asChild className="px-0">
          <Link href="/requests">
            <ArrowLeft className="h-4 w-4" />
            Back to requests
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>My requests</CardTitle>
            <CardDescription>All requests you created.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap gap-2 [&>button]:min-h-[44px]">
              <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
                All
              </Button>
              <Button
                size="sm"
                variant={filter === "pending" ? "default" : "outline"}
                onClick={() => setFilter("pending")}
              >
                Pending selection
              </Button>
              <Button
                size="sm"
                variant={filter === "selected" ? "default" : "outline"}
                onClick={() => setFilter("selected")}
              >
                Selected
              </Button>
            </div>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="text-sm text-muted-foreground">No requests yet.</div>
            ) : (
              <ul className="space-y-2">
                {filtered.map((item) => (
                  <li key={item.id}>
                    <Link href={`/requests/${item.id}`} className="block">
                      <Card className="cursor-pointer transition-colors hover:bg-accent/40">
                        <CardContent className="py-3">
                          <div className="line-clamp-1 truncate break-words text-[15px] font-semibold leading-relaxed tracking-tight">{item.prompt}</div>
                          <div className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</div>
                        </CardContent>
                      </Card>
                    </Link>
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
