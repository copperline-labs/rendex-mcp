// ─── AES-256-GCM helpers (managed-key encryption at rest) ────────────
// The managed rdx_ key is stored encrypted in public.mcp_credentials because
// Unkey only returns the plaintext once, at creation. We encrypt with a
// Worker secret (MCP_KEY_ENCRYPTION_KEY, base64 32 bytes) using AES-GCM with a
// fresh random 96-bit IV per record. Stored form: base64(iv).base64(ciphertext).

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// Web Crypto's BufferSource wants an ArrayBuffer-backed view; cast our byte
// arrays through this helper (Workers never use SharedArrayBuffer).
function asBuffer(bytes: Uint8Array): BufferSource {
  return bytes as unknown as BufferSource;
}

async function importKey(base64Key: string): Promise<CryptoKey> {
  const raw = base64ToBytes(base64Key);
  if (raw.length !== 32) {
    throw new Error("MCP_KEY_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }
  return crypto.subtle.importKey("raw", asBuffer(raw), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** Encrypt plaintext → "base64(iv).base64(ciphertext)". */
export async function encryptSecret(plaintext: string, base64Key: string): Promise<string> {
  const key = await importKey(base64Key);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: asBuffer(iv) },
    key,
    asBuffer(new TextEncoder().encode(plaintext))
  );
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(ct))}`;
}

/** Decrypt "base64(iv).base64(ciphertext)" → plaintext. Throws on tamper/wrong key. */
export async function decryptSecret(stored: string, base64Key: string): Promise<string> {
  const [ivB64, ctB64] = stored.split(".");
  if (!ivB64 || !ctB64) throw new Error("Malformed encrypted secret");
  const key = await importKey(base64Key);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: asBuffer(base64ToBytes(ivB64)) },
    key,
    asBuffer(base64ToBytes(ctB64))
  );
  return new TextDecoder().decode(pt);
}

/** A URL-safe random token (for CSRF + login-state ids). */
export function randomToken(bytes = 32): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return bytesToBase64(buf).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Constant-time string compare (CSRF token check). */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
