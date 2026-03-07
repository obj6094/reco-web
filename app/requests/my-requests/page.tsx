"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

type Item = {
  id: string;
  prompt: string;
  created_at: string;
};

export default function MyRequestsPage() {
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

      const { data } = await supabase
        .from("qna_requests")
        .select("id, prompt, created_at")
        .eq("requester_id", uid)
        .order("created_at", { ascending: false });

      setItems((data ?? []) as Item[]);
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
            <CardTitle>My requests</CardTitle>
            <CardDescription>All requests you created.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : items.length === 0 ? (
              <div className="text-sm text-muted-foreground">No requests yet.</div>
            ) : (
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.id} className="rounded-xl border border-border bg-accent/30 px-3 py-3">
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
