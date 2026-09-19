"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { UserRole } from "@/types/auth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const [panel, setPanel] = useState<UserRole>("member");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password, panel }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Could not log in. Please try again.");
        setSubmitting(false);
        return;
      }

      router.push(next);
      router.refresh();
    } catch {
      setError("Could not reach DataMind. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-950">
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.045]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
        <div className="absolute right-[-8%] top-[-12%] h-[600px] w-[600px] rounded-full bg-accent-500/[0.07] blur-[140px]" />
      </div>

      <div className="section relative z-10 flex min-h-screen items-center py-16">
        <div className="grid w-full gap-14 lg:grid-cols-[1fr_420px] lg:items-center lg:gap-24">
          <div className="hidden lg:block">
            <a href="/" className="font-display text-2xl italic tracking-tight text-ink-100">
              Data<span className="text-accent-400 not-italic">Mind</span>
            </a>
            <p className="eyebrow mt-16">Database intelligence</p>
            <h1 className="mt-5 max-w-2xl font-display text-6xl leading-[0.98] tracking-[-0.03em] text-ink-100">
              Ask the data.
              <br />
              <span className="italic text-accent-400">Not the model.</span>
            </h1>
            <p className="mt-7 max-w-lg text-base leading-7 text-ink-500">
              DataMind translates natural-language questions into validated PostgreSQL
              and returns answers from the real database within the user&apos;s permitted scope.
            </p>
            <div className="mt-10 grid max-w-xl grid-cols-3 border-y border-ink-800">
              {[
                ["01", "Question", "Plain English"],
                ["02", "Control", "Access + SQL"],
                ["03", "Answer", "Real rows"],
              ].map(([n, title, body]) => (
                <div key={n} className="border-r border-ink-800 px-4 py-5 first:pl-0 last:border-r-0">
                  <span className="font-mono text-[9px] text-accent-400">{n}</span>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink-300">{title}</p>
                  <p className="mt-1 text-[10px] text-ink-600">{body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full max-w-md lg:ml-auto">
            <div className="mb-8 lg:hidden">
              <a href="/" className="font-display text-2xl italic tracking-tight text-ink-100">
                Data<span className="text-accent-400 not-italic">Mind</span>
              </a>
              <p className="mt-2 text-sm text-ink-500">Ask your database in plain English.</p>
            </div>

            <div className="border border-ink-800 bg-ink-900/80 p-7 sm:p-8">
              <div className="mb-7">
                <p className="eyebrow">Secure workspace entry</p>
                <h2 className="mt-3 font-display text-3xl text-ink-100">Sign in to DataMind.</h2>
                <p className="mt-2 text-sm leading-6 text-ink-600">Choose your access role, then continue with your DataMind credentials.</p>
              </div>

              <div className="mb-7 grid grid-cols-2 border border-ink-700 bg-ink-950 p-1">
                {(["member", "admin", "owner"] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setPanel(r)}
                    className={
                      "py-3 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors " +
                      (panel === r ? "bg-accent-500 text-ink-950" : "text-ink-500 hover:text-ink-100")
                    }
                  >
                    {r === "owner" ? "Owner" : r === "admin" ? "Admin" : "Member"}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="username" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-600">Username</label>
                  <input
                    id="username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full border border-ink-700 bg-ink-950 px-4 py-3.5 text-sm text-ink-100 placeholder:text-ink-700 outline-none transition-colors focus:border-accent-400"
                    placeholder={panel === "owner" ? "owner" : panel === "admin" ? "admin" : "member"}
                  />
                </div>

                <div>
                  <label htmlFor="password" className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-600">Password</label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full border border-ink-700 bg-ink-950 px-4 py-3.5 text-sm text-ink-100 placeholder:text-ink-700 outline-none transition-colors focus:border-accent-400"
                    placeholder="••••••••"
                  />
                </div>

                {error && (
                  <div className="border border-red-900/50 bg-red-950/20 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-red-400">Authentication failed</p>
                    <p className="mt-1 text-sm text-red-200">{error}</p>
                  </div>
                )}

                <button type="submit" disabled={submitting} className="btn-primary w-full">
                  {submitting ? "Signing in…" : "Continue"}
                </button>
              </form>

              <div className="mt-7 border-t border-ink-800 pt-5">
                <p className="text-xs leading-5 text-ink-600">
                  {panel === "owner" ? "Owner access provides database administration capabilities subject to the configured database permissions." : panel === "admin"
                    ? "Admin access includes controlled changes in addition to permitted database queries."
                    : "Member access is read-only, with personal data and approved aggregate queries within scope."}
                </p>
              </div>
            </div>

            <p className="mt-5 text-center font-mono text-[9px] uppercase tracking-[0.16em] text-ink-700">
              DataMind / governed natural-language database access
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
