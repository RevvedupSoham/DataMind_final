"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/types/auth";

const LINKS = [
  { href: "#ask", label: "Ask Database" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#examples", label: "Examples" },
];

function UserMenu({ session }: { session: { username: string; role: UserRole } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
          open ? "border-accent-400" : "border-ink-700 hover:border-ink-500"
        } bg-ink-800`}
      >
        {/* Blank/generic profile silhouette — no photo, just a placeholder avatar. */}
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-ink-400" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="12" cy="8" r="3.4" />
          <path d="M4.5 20c1.4-3.6 4.4-5.4 7.5-5.4s6.1 1.8 7.5 5.4" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 w-56 animate-fade-in rounded-sm border border-ink-700 bg-ink-900 py-2 shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
        >
          <div className="border-b border-ink-800 px-4 py-3">
            <p className="truncate text-sm font-semibold text-ink-100">{session.username}</p>
            <p className={`mt-0.5 text-xs uppercase tracking-widest2 ${session.role === "admin" ? "text-accent-400" : "text-ink-500"}`}>
              {session.role === "admin" ? "Admin" : "Member"}
            </p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            disabled={loggingOut}
            className="block w-full px-4 py-2.5 text-left text-sm text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100 disabled:opacity-50"
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
  const [session, setSession] = useState<{ username: string; role: UserRole } | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
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
          setSession({ username: data.username, role: data.role });
        }
      })
      .catch(() => {
        /* nav badge is a nice-to-have */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled ? "bg-ink-950/90 backdrop-blur-sm shadow-[0_1px_0_0_rgba(255,255,255,0.06)]" : "bg-transparent"
      }`}
    >
      <nav className="section flex h-20 items-center justify-between">
        <a href="#top" className="font-display text-xl italic tracking-tight text-ink-100">
          Data<span className="text-accent-400 not-italic">Mind</span>
        </a>
        <ul className="hidden items-center gap-10 md:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-xs font-semibold uppercase tracking-widest2 text-ink-300 transition-colors hover:text-accent-400"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-6">
          {session && <UserMenu session={session} />}
          <a href="#ask" className="hidden text-xs font-semibold uppercase tracking-widest2 text-accent-400 md:inline-block">
            Ask Database →
          </a>
        </div>
      </nav>
    </header>
  );
}
