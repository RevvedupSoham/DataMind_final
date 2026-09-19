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

    if (submitting) {
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const endpoint =
        panel === "owner"
          ? "/api/auth/owner-login"
          : "/api/auth/login";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
          panel,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Could not log in.");
        setSubmitting(false);
        return;
      }

      if (panel === "owner") {
        router.push("/owner");
      } else {
        router.push(next);
      }

      router.refresh();
    } catch {
      setError("Could not reach DataMind.");
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-950">
      <div className="section relative z-10 flex min-h-screen items-center py-16">
        <div className="grid w-full gap-14 lg:grid-cols-[1fr_420px] lg:items-center lg:gap-24">
          <div className="hidden lg:block">
            <a
              href="/"
              className="font-display text-2xl italic tracking-tight text-ink-100"
            >
              Data<span className="text-accent-400 not-italic">Mind</span>
            </a>

            <p className="mt-16 text-xs uppercase tracking-[0.22em] text-accent-400">
              Database Intelligence
            </p>

            <h1 className="mt-5 max-w-2xl font-display text-6xl leading-[0.98] tracking-[-0.03em] text-ink-100">
              Ask the data.
              <br />
              <span className="italic text-accent-400">
                Not the model.
              </span>
            </h1>

            <p className="mt-7 max-w-lg text-base leading-7 text-ink-500">
              DataMind translates natural-language questions into validated
              PostgreSQL operations with role-based authorization.
            </p>
          </div>

          <div className="w-full max-w-md lg:ml-auto">
            <div className="border border-ink-800 bg-ink-900/80 p-7 sm:p-8">
              <div className="mb-7">
                <p className="text-xs uppercase tracking-[0.18em] text-accent-400">
                  Secure Workspace Entry
                </p>

                <h2 className="mt-3 font-display text-3xl text-ink-100">
                  Sign in to DataMind.
                </h2>

                <p className="mt-2 text-sm leading-6 text-ink-600">
                  Choose your access role and continue with your credentials.
                </p>
              </div>

              <div className="mb-7 grid grid-cols-3 border border-ink-700 bg-ink-950 p-1">
                {(["member", "admin", "owner"] as UserRole[]).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setPanel(role)}
                    className={
                      "py-3 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors " +
                      (panel === role
                        ? "bg-accent-500 text-ink-950"
                        : "text-ink-500 hover:text-ink-100")
                    }
                  >
                    {role}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-600">
                    Username
                  </label>

                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full border border-ink-700 bg-ink-950 px-4 py-3.5 text-sm text-ink-100 outline-none transition-colors focus:border-accent-400"
                    placeholder={panel}
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-600">
                    Password
                  </label>

                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-ink-700 bg-ink-950 px-4 py-3.5 text-sm text-ink-100 outline-none transition-colors focus:border-accent-400"
                    placeholder="••••••••"
                    required
                  />
                </div>

                {error && (
                  <div className="border border-red-900/50 bg-red-950/20 px-4 py-3 text-sm text-red-200">
                    {error}
                  </div>
                )}

                <button type="submit" className="btn-primary w-full">
                  {submitting ? "Signing in..." : "Continue"}
                </button>
              </form>

              <div className="mt-7 border-t border-ink-800 pt-5 text-xs leading-5 text-ink-600">
                {panel === "owner"
                  ? "Owner access includes database administration, schema management, and privileged operations."
                  : panel === "admin"
                    ? "Admin access includes controlled employee and organizational management operations."
                    : "Member access is limited to self-service and approved read-only queries."}
              </div>
            </div>
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
