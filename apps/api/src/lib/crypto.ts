const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function deriveAesKey(masterSecret: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(masterSecret),
  );
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export interface EncryptedPayload {
  encryptedApiKey: string;
  iv: string;
  authTag: string;
}

/**
 * Encrypts a Workspace BYOK API key using Web Crypto AES-256-GCM.
 * Works identically on Node.js 24 and Cloudflare Workers Free.
 */
export async function encryptSecret(
  plaintext: string,
  masterSecret: string,
): Promise<EncryptedPayload> {
  const key = await deriveAesKey(masterSecret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    key,
    encoder.encode(plaintext),
  );
  const full = new Uint8Array(encryptedBuf);
  const ciphertext = full.slice(0, full.length - 16);
  const authTag = full.slice(full.length - 16);

  return {
    encryptedApiKey: toBase64(ciphertext),
    iv: toBase64(iv),
    authTag: toBase64(authTag),
  };
}

/**
 * Decrypts a previously encrypted AES-256-GCM BYOK secret into memory.
 */
export async function decryptSecret(
  payload: EncryptedPayload,
  masterSecret: string,
): Promise<string> {
  const key = await deriveAesKey(masterSecret);
  const ciphertext = fromBase64(payload.encryptedApiKey);
  const iv = fromBase64(payload.iv);
  const authTag = fromBase64(payload.authTag);

  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext, 0);
  combined.set(authTag, ciphertext.length);

  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: new Uint8Array(iv),
      tagLength: 128,
    },
    key,
    combined,
  );
  return decoder.decode(decrypted);
}

/**
 * Computes GitHub-compatible HMAC-SHA256 signature (`sha256=<hex>`).
 */
export async function signGitHubWebhookPayload(
  rawBody: string,
  secret: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  return `sha256=${toHex(new Uint8Array(sigBuf))}`;
}

/**
 * Verifies GitHub `X-Hub-Signature-256` using Web Crypto HMAC-SHA256 + constant-time comparison.
 */
export async function verifyGitHubWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=") || !secret) {
    return false;
  }
  const expected = await signGitHubWebhookPayload(rawBody, secret);
  return constantTimeEqual(expected.toLowerCase(), signatureHeader.toLowerCase());
}
