"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/types/auth";

const LINKS = [
  { href: "#ask", label: "Ask" },
  { href: "#how-it-works", label: "Process" },
  { href: "#examples", label: "Capabilities" },
];

export function Navigation() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [session, setSession] = useState<{ username: string; role: UserRole; employeeId: number } | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!session) return;

    let activityTimer: ReturnType<typeof setTimeout> | null = null;

    const markActivity = () => {
      if (activityTimer) clearTimeout(activityTimer);

      activityTimer = setTimeout(() => {
        void fetch("/api/auth/logout", { method: "POST" }).finally(() => {
          router.push("/login");
          router.refresh();
        });
      }, 30 * 60 * 1000);
    };

    const events = ["pointerdown", "keydown", "touchstart"];

    events.forEach((event) => {
      window.addEventListener(event, markActivity, {
        passive: true,
      });
    });

    markActivity();

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, markActivity);
      });

      if (activityTimer) clearTimeout(activityTimer);
    };
  }, [session, router]);

  return <header />;
}
