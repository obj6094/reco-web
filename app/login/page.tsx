"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { KeyRound, Mail } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    // URL 쿼리로 로그인/회원가입 모드를 제어 (/login?mode=signup)
    const modeParam = new URLSearchParams(window.location.search).get("mode");
    if (modeParam === "signup") {
      setMode("signup");
    } else if (modeParam === "login") {
      setMode("login");
    }
  }, []);

  useEffect(() => {
    async function checkSession() {
      // 이미 로그인된 유저는 로그인 페이지 대신 메인으로 보낸다
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        router.replace("/");
      } else {
        setCheckingSession(false);
      }
    }

    checkSession();
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage("");

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
      } else {
        // Supabase 프로젝트에서 이메일 인증을 켜둔 경우를 가정한 안내 문구
        setMessage(
          "회원가입이 완료되었어. 이메일로 전송된 인증 링크를 확인한 뒤 로그인해줘."
        );
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
      } else {
        // 로그인 성공 시 홈으로 이동 (홈에서 챌린지/대시보드로 진입)
        router.replace("/");
      }
    }
  }

  if (checkingSession) {
    return (
      <main className="min-h-[calc(100vh-56px)] bg-background px-4 py-16 text-foreground">
        <div className="mx-auto max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>Reco</CardTitle>
              <CardDescription>세션을 확인하는 중이야...</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-56px)] bg-background px-4 py-16 text-foreground">
      <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-2 md:items-center">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_20px_hsl(var(--primary)/0.65)]" />
            <span className="text-sm font-semibold text-muted-foreground">Reco</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
            Discover music through real people.
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            매주 챌린지에 참여하고, QnA 요청에 답하며, Best Reco를 쌓아가자.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Weekly Challenge</Badge>
            <Badge variant="secondary">QnA Requests</Badge>
            <Badge variant="secondary">Voting</Badge>
          </div>
        </div>

        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          <Card className="shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
            <CardHeader>
              <CardTitle>{mode === "login" ? "로그인" : "회원가입"}</CardTitle>
              <CardDescription>
                {mode === "login"
                  ? "계정으로 로그인해서 Reco를 시작해."
                  : "계정을 만들고 이메일 인증을 완료해줘."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="이메일"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-11"
                    autoComplete="email"
                  />
                </div>

                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="비밀번호"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-11"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                  />
                </div>

                <Button type="submit" className="w-full">
                  {mode === "login" ? "로그인" : "회원가입"}
                </Button>
              </form>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
              >
                {mode === "login" ? "회원가입하기" : "이미 계정이 있나요? 로그인"}
              </Button>

              {message ? (
                <div className="rounded-2xl border border-border bg-accent px-4 py-3 text-sm text-foreground/90">
                  {message}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </main>
  );
}