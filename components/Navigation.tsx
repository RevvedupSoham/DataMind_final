"use client";

import { useEffect, useState } from "react";
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
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [session, setSession] = useState<{ username: string; role: UserRole } | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const saved = localStorage.getItem("datamind-theme");
    const next = saved === "light" ? "light" : "dark";
    setTheme(next);

    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.username && data?.role) setSession({ username: data.username, role: data.role as UserRole });
      })
      .catch(() => undefined);

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
    events.forEach((event) => window.addEventListener(event, markActivity, { passive: true }));
    markActivity();

    return () => {
      events.forEach((event) => window.removeEventListener(event, markActivity));
      if (activityTimer) clearTimeout(activityTimer);
    };
  }, [session, router]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("datamind-theme", next);
    document.documentElement.classList.toggle("theme-light", next === "light");
    document.documentElement.style.colorScheme = next;
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className={`fixed inset-x-0 top-0 z-40 transition-all duration-500 ${scrolled ? "bg-ink-950/85 shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur-md" : "bg-transparent"}`}>
      <div className="section">
        <div className="flex h-[72px] items-center justify-between border-b border-ink-800/70">
          <a href="#top" className="group flex items-center gap-3">
            <span className="grid h-7 w-7 place-items-center border border-accent-400/60 font-mono text-[9px] text-accent-400 transition-transform duration-300 group-hover:rotate-45">D</span>
            <span className="font-display text-base italic text-ink-100">DataMind</span>
          </a>

          <nav className="hidden items-center gap-7 md:flex">
            {LINKS.map((link) => (
              <a key={link.href} href={link.href} className="text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-500 transition-colors hover:text-accent-400">
                {link.label}
              </a>
            ))}
            {session?.role === "owner" && (
              <a href="/owner" className="text-[9px] font-semibold uppercase tracking-[0.18em] text-accent-400 transition-colors hover:text-accent-300">
                Control room
              </a>
            )}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            {session && (
              <span className="max-w-[150px] truncate border-l border-ink-800 pl-3 text-[9px] uppercase tracking-[0.16em] text-ink-600">
                {session.username} / {session.role}
              </span>
            )}
            <button type="button" onClick={toggleTheme} aria-label="Toggle theme" className="grid h-8 w-8 place-items-center border border-ink-700 text-xs text-ink-500 transition-all hover:border-accent-400 hover:text-accent-400">
              {theme === "dark" ? "☼" : "◐"}
            </button>
            {session && (
              <button type="button" onClick={logout} className="text-[9px] font-semibold uppercase tracking-[0.16em] text-ink-600 transition-colors hover:text-red-400">
                Exit
              </button>
            )}
          </div>

          <button type="button" onClick={() => setMenuOpen((v) => !v)} aria-label="Toggle navigation" className="grid h-9 w-9 place-items-center border border-ink-700 text-ink-300 md:hidden">
            <span className="font-mono text-xs">{menuOpen ? "×" : "≡"}</span>
          </button>
        </div>

        <div className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-400 md:hidden ${menuOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="min-h-0">
            <nav className="border-b border-ink-800 bg-ink-950/95 px-1 py-5">
              <div className="flex flex-col gap-4">
                {LINKS.map((link) => (
                  <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)} className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-400 hover:text-accent-400">
                    {link.label}
                  </a>
                ))}
                {session?.role === "owner" && <a href="/owner" className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-400">Control room</a>}
                {session && <button type="button" onClick={logout} className="self-start text-xs font-semibold uppercase tracking-[0.18em] text-ink-600">Exit {session.username}</button>}
                <button type="button" onClick={toggleTheme} className="self-start text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">
                  Theme / {theme}
                </button>
              </div>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
