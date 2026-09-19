import type { SessionPayload, UserRole } from "@/types/auth";

/**
 * Signed, stateless session cookie built on the Web Crypto API.
 *
 * The cookie carries:
 * {username, role, employeeId, iat, exp}
 *
 * OWNER sessions intentionally allow employeeId = null because owners
 * operate outside employee hierarchy constraints.
 */

export const SESSION_COOKIE_NAME = "datamind_session";
export const SESSION_IDLE_TIMEOUT_SECONDS = 60 * 30;
const SESSION_TTL_SECONDS = SESSION_IDLE_TIMEOUT_SECONDS;

const VALID_ROLES: UserRole[] = ["owner", "admin", "member"];

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET is not configured (or is too short)."
    );
  }

  return secret;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");

  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function toBufferSource(bytes: Uint8Array): BufferSource {
  return bytes as unknown as BufferSource;
}

async function getHmacKey(): Promise<CryptoKey> {
  const secret = getSecret();
  const keyData = new TextEncoder().encode(secret);

  return crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createSessionToken(
  username: string,
  role: UserRole,
  employeeId: number | null
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const payload: SessionPayload = {
    username,
    role,
    employeeId,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };

  const payloadJson = JSON.stringify(payload);
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(payloadJson));

  const key = await getHmacKey();

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    toBufferSource(new TextEncoder().encode(payloadB64))
  );

  const signatureB64 = base64UrlEncode(new Uint8Array(signature));

  return `${payloadB64}.${signatureB64}`;
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token) {
    return null;
  }

  const parts = token.split(".");

  if (parts.length !== 2) {
    return null;
  }

  const [payloadB64, signatureB64] = parts;

  if (!payloadB64 || !signatureB64) {
    return null;
  }

  try {
    const key = await getHmacKey();
    const signatureBytes = base64UrlDecode(signatureB64);

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      toBufferSource(signatureBytes),
      toBufferSource(new TextEncoder().encode(payloadB64))
    );

    if (!valid) {
      return null;
    }

    const payloadJson = new TextDecoder().decode(
      base64UrlDecode(payloadB64)
    );

    const payload = JSON.parse(payloadJson) as SessionPayload;

    if (
      typeof payload.exp !== "number" ||
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    if (!VALID_ROLES.includes(payload.role)) {
      return null;
    }

    if (
      payload.role !== "owner" &&
      (typeof payload.employeeId !== "number" || payload.employeeId <= 0)
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
