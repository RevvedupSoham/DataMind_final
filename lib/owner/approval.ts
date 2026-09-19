import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const APPROVAL_TTL_SECONDS = 10 * 60;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET is not configured.");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function createOwnerApprovalToken(
  username: string,
  sql: string,
  requiresConfirmation: boolean
): string {
  const payload = JSON.stringify({
    username,
    sql,
    requiresConfirmation,
    exp: Math.floor(Date.now() / 1000) + APPROVAL_TTL_SECONDS,
  });
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyOwnerApprovalToken(
  token: string,
  username: string,
  sql: string
): { valid: boolean; requiresConfirmation?: boolean; reason?: string } {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    return { valid: false, reason: "Invalid approval token." };
  }

  try {
    const expected = sign(encoded);
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      return { valid: false, reason: "Invalid approval token." };
    }

    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as {
      username?: string;
      sql?: string;
      requiresConfirmation?: boolean;
      exp?: number;
    };

    if (
      payload.username !== username ||
      payload.sql !== sql ||
      typeof payload.exp !== "number" ||
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      return { valid: false, reason: "Approval token is expired or does not match this operation." };
    }

    return {
      valid: true,
      requiresConfirmation: payload.requiresConfirmation === true,
    };
  } catch {
    return { valid: false, reason: "Invalid approval token." };
  }
}
