"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-10 text-center",
        className
      )}
    >
      <motion.div
        initial={{ y: 6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="relative"
      >
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary"
        >
          <Icon className="h-6 w-6" />
        </motion.div>

        {/* abstract dots */}
        <svg
          className="pointer-events-none absolute -right-6 -top-5 opacity-60"
          width="64"
          height="36"
          viewBox="0 0 64 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="8" cy="8" r="2" fill="hsl(var(--primary))" fillOpacity="0.5" />
          <circle cx="24" cy="6" r="1.8" fill="hsl(var(--primary))" fillOpacity="0.35" />
          <circle cx="40" cy="10" r="1.6" fill="hsl(var(--primary))" fillOpacity="0.25" />
          <circle cx="56" cy="8" r="2" fill="hsl(var(--primary))" fillOpacity="0.4" />
          <circle cx="16" cy="22" r="1.6" fill="hsl(var(--primary))" fillOpacity="0.25" />
          <circle cx="34" cy="26" r="2" fill="hsl(var(--primary))" fillOpacity="0.35" />
          <circle cx="52" cy="24" r="1.6" fill="hsl(var(--primary))" fillOpacity="0.22" />
        </svg>
      </motion.div>

      <div className="space-y-1">
        <div className="text-base font-semibold">{title}</div>
        {description ? (
          <div className="text-sm text-muted-foreground">{description}</div>
        ) : null}
      </div>
    </div>
  );
}

