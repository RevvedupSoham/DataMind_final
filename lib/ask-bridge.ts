"use client";

export const ASK_EVENT = "datamind:ask";

/**
 * Lets sections outside QueryInterface trigger a database question without
 * introducing prop drilling or coupling the landing-page components together.
 */
export function askDatabase(question: string): void {
  if (typeof window === "undefined") return;

  const trimmed = question.trim();
  if (!trimmed) return;

  window.dispatchEvent(new CustomEvent<string>(ASK_EVENT, { detail: trimmed }));
}
