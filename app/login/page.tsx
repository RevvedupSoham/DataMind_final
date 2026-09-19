"use client";

import { Suspense, useEffect, useState } from "react";
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
  const [ready, setReady] = useState(false);
  const [headlineVisible, setHeadlineVisible] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("datamind-theme");
    const light = saved === "light";
    document.documentElement.classList.toggle("theme-light", light);
    document.documentElement.style.colorScheme = light ? "light" : "dark";
    const timer = window.setTimeout(() => {
      setReady(true);
      setHeadlineVisible(true);
    }, 80);
    return () => window.clearTimeout(timer);
  }, []);

  function selectPanel(role: UserRole) {
    setPanel(role);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    setError(null);
    setSubmitting(true);

    try {
      const endpoint = panel === "owner" ? "/api/auth/owner-login" : "/api/auth/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password, panel }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Could not log in.");
        setSubmitting(false);
        return;
      }

      router.push(panel === "owner" ? "/owner" : next);
      router.refresh();
    } catch {
      setError("Could not reach DataMind.");
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <div className="login-grid" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>

      <div className={"section login-layout " + (ready ? "login-ready" : "")}>
        <section className="login-intro">
          <a href="/" className="login-brand">
            Data<span>Mind</span>
          </a>

          <div className="login-intro-copy">
            <p className="eyebrow">Database intelligence / 01</p>
            <h1 className={headlineVisible ? "headline-typed" : ""}>
              <span>Ask the data.</span>
              <br />
              <em>Not the model.</em>
            </h1>
            <p className="login-lead">
              Natural language in. Validated PostgreSQL out. Every answer
              remains grounded in the database you actually own.
            </p>
          </div>

          <div className="login-route">
            <span className="login-route-line" />
            <span>Secure workspace entry</span>
            <span className="login-route-status">Encrypted session</span>
          </div>
        </section>

        <section className="login-card" aria-label="DataMind sign in">
          <div className="login-card-top">
            <div>
              <p className="eyebrow">Workspace access</p>
              <h2>Sign in.</h2>
            </div>
            <span className="login-index">DM / 01</span>
          </div>

          <p className="login-subtitle">
            Choose the access layer for this session.
          </p>

          <div className="login-tabs login-tabs-hierarchy">
            <button
              type="button"
              onClick={() => selectPanel("owner")}
              className={"login-role-owner " + (panel === "owner" ? "active" : "")}
            >
              <span>01 / PLATFORM</span>
              <strong>OWNER</strong>
              <small>Full control plane</small>
            </button>

            <div className="login-role-lower">
              {(["member", "admin"] as UserRole[]).map((role, index) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => selectPanel(role)}
                  className={panel === role ? "active" : ""}
                >
                  <span>0{index + 2}</span>
                  <strong>{role}</strong>
                  <small>
                    {role === "admin" ? "Organizational access" : "Self-service access"}
                  </small>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <label>
              <span>Username</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={panel}
                autoComplete="username"
                required
              />
            </label>

            <label>
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </label>

            {error && (
              <div className="login-error" role="alert">
                <span>!</span>
                <p>{error}</p>
              </div>
            )}

            <button type="submit" className="login-submit" disabled={submitting}>
              <span>{submitting ? "Authenticating" : "Continue"}</span>
              <span aria-hidden="true">↗</span>
            </button>
          </form>

          <div className="login-card-foot">
            <span>
              {panel === "owner"
                ? "Platform control plane"
                : panel === "admin"
                  ? "Controlled organizational access"
                  : "Self-service and approved read-only access"}
            </span>
            <span>30 MIN SESSION</span>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
