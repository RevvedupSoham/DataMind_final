import type { SessionPayload, UserRole } from "@/types/auth";

/**
 * Signed, stateless session cookie built on the Web Crypto API (not
 * Node's `crypto` module) specifically so this same code runs in both the
 * Node.js API route runtime AND the Edge runtime used by middleware.ts.
 * Web Crypto (`crypto.subtle`) is available in both.
 *
 * The cookie carries {username, role, employeeId, iat, exp} and an HMAC-SHA256
 * signature over that payload, keyed by SESSION_SECRET. Nothing about the
 * role or employeeId is ever trusted from anywhere else — every privileged 
 * action reads these back out of this verified token server-side.
 */

export const SESSION_COOKIE_NAME = "datamind_session";
export const SESSION_IDLE_TIMEOUT_SECONDS = 60 * 30; // 30 minutes of inactivity
const SESSION_TTL_SECONDS = SESSION_IDLE_TIMEOUT_SECONDS;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET is not configured (or is too short). Set a long random value in your environment."
    );
  }
  return secret;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    value.length + ((4 - (value.length % 4)) % 4),
    "="
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * TS 5.9's DOM lib types Uint8Array as generic over its backing buffer,
 * which no longer structurally matches BufferSource in strict mode even
 * though every JS engine (Node and Edge alike) accepts a plain Uint8Array
 * here at runtime. This narrows the type back for the Web Crypto calls
 * below without changing any runtime behavior.
 */
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
  employeeId: number
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

export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, signatureB64] = parts;
  if (!payloadB64 || !signatureB64) return null;

  try {
    const key = await getHmacKey();
    const signatureBytes = base64UrlDecode(signatureB64);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      toBufferSource(signatureBytes),
      toBufferSource(new TextEncoder().encode(payloadB64))
    );
    if (!valid) return null;

    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
    const payload = JSON.parse(payloadJson) as SessionPayload;

    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // expired
    }
    if (payload.role !== "admin" && payload.role !== "member") return null;
    if (typeof payload.employeeId !== "number" || payload.employeeId <= 0) return null;

    return payload;
  } catch {
    return null;
  }
}

// Intentionally no persistent maxAge is exported. The login cookie is a browser\n// session cookie, so closing the browser removes it. The signed token itself\n// expires after the inactivity window unless refreshed by the heartbeat route.
