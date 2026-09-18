"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/types/auth";

const LINKS = [
  { href: "#ask", label: "Ask" },
  { href: "#how-it-works", label: "Process" },
  { href: "#examples", label: "Capabilities" },
];

function UserMenu({
  session,
}: {
  session: { username: string; role: UserRole; employeeId: number };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open account menu"
        className={
          "flex items-center gap-2 border px-3 py-2 text-left transition-colors " +
          (open ? "border-accent-400" : "border-ink-700 hover:border-ink-500") +
          " bg-ink-900/70"
        }
      >
        <span className="grid h-6 w-6 place-items-center rounded-full border border-ink-600 bg-ink-800 text-[10px] font-semibold text-ink-300">
          {session.username.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block max-w-[120px] truncate text-xs font-semibold text-ink-100">{session.username}</span>
          <span className="block text-[9px] uppercase tracking-[0.18em] text-ink-500">
            {session.role === "admin" ? "Admin" : "Member"}
          </span>
        </span>
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-ink-500" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-12 w-64 animate-fade-in border border-ink-700 bg-ink-950 py-2 shadow-[0_18px_50px_rgba(0,0,0,0.5)]">
          <div className="border-b border-ink-800 px-4 py-4">
            <p className="truncate text-sm font-semibold text-ink-100">{session.username}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-accent-400">
              {session.role === "admin" ? "Admin · controlled access" : "Member · read only"}
            </p>
            <p className="mt-2 font-mono text-[10px] text-ink-600">employee_id / {session.employeeId}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            disabled={loggingOut}
            className="block w-full px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-ink-400 transition-colors hover:bg-ink-900 hover:text-ink-100 disabled:opacity-50"
          >
            {loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}

export function Navigation() {
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
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.authenticated) {
          setSession({
            username: data.username,
            role: data.role,
            employeeId: data.employeeId,
          });
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <header
      className={
        "fixed inset-x-0 top-0 z-50 border-b transition-all duration-300 " +
        (scrolled ? "border-ink-800 bg-ink-950/92 backdrop-blur-md" : "border-transparent bg-ink-950/40")
      }
    >
      <nav className="section flex h-[72px] items-center justify-between">
        <a href="#top" className="group flex items-baseline gap-2">
          <span className="font-display text-[22px] italic tracking-tight text-ink-100">
            Data<span className="text-accent-400 not-italic">Mind</span>
          </span>
          <span className="hidden text-[9px] uppercase tracking-[0.2em] text-ink-600 sm:inline">database intelligence</span>
        </a>

        <div className="hidden items-center gap-9 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-400 transition-colors hover:text-ink-100"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {session && <UserMenu session={session} />}
          <a
            href="#ask"
            className="hidden border border-accent-500/50 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-400 transition-colors hover:bg-accent-500/10 sm:inline-flex"
          >
            Ask database
          </a>
          <button
            type="button"
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
            className="grid h-9 w-9 place-items-center border border-ink-700 text-ink-300 md:hidden"
          >
            <span className="space-y-1.5">
              <span className="block h-px w-4 bg-current" />
              <span className="block h-px w-4 bg-current" />
            </span>
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="border-t border-ink-800 bg-ink-950 px-5 py-4 md:hidden">
          <div className="section flex flex-col gap-1 px-0">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="border-b border-ink-900 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink-300"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
