"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Home, LogIn, LogOut, Trophy, User, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";

export function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkUser() {
      // 로그인 상태는 클라이언트에서 Supabase 세션으로 확인
      const { data } = await supabase.auth.getUser();
      setLoggedIn(!!data.user);
    }

    checkUser();

    // 로그인/로그아웃 시 네비 UI가 즉시 반영되도록 구독
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session?.user);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    // Supabase 세션 로그아웃 (키는 lib/supabaseClient.ts 에서 env 로 주입됨)
    await supabase.auth.signOut();
    router.replace("/");
  }

  function scrollToTopOnNavigate() {
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "auto" });
    });
  }

  const links = [
    { href: "/", label: "Home", icon: Home, active: pathname === "/" },
    {
      href: "/challenge",
      label: "Challenge",
      icon: Trophy,
      active: pathname === "/challenge",
    },
    {
      href: "/requests",
      label: "Requests",
      icon: MessageCircle,
      active: pathname === "/requests" || pathname?.startsWith("/requests/"),
    },
    { href: "/profile", label: "Profile", icon: User, active: pathname === "/profile" },
  ];

  return (
    <motion.nav
      initial={{ y: -8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/70 backdrop-blur"
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            scroll
            onClick={scrollToTopOnNavigate}
            className="inline-flex items-center gap-2 font-semibold tracking-tight text-foreground"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-primary shadow-[0_0_20px_hsl(var(--primary)/0.65)]" />
            Reco
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {links.map((l) => {
              const Icon = l.icon;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  scroll
                  onClick={scrollToTopOnNavigate}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                    l.active && "bg-accent text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {l.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {loggedIn ? (
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => router.push("/login")}>
              <LogIn className="h-4 w-4" />
              Login
            </Button>
          )}
        </div>
      </div>
      <div className="border-t border-border/60 px-2 py-2.5 md:hidden">
        <div className="mx-auto grid max-w-5xl grid-cols-4 gap-1">
          {links.map((l) => {
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                scroll
                onClick={scrollToTopOnNavigate}
                className={cn(
                  "inline-flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:bg-accent/80",
                  l.active && "bg-accent text-foreground"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="truncate max-w-full">{l.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </motion.nav>
  );
}

