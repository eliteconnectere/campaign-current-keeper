// Server-only — never import in the browser.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/** 32-byte AES key derived from the project's GMAIL_TOKEN_SECRET. */
function key(): Buffer {
  const raw = process.env["GMAIL_TOKEN_SECRET"];
  if (!raw) throw new Error("GMAIL_TOKEN_SECRET is not set");
  return createHash("sha256").update(raw).digest();
}

export function encryptConnectionKey(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decryptConnectionKey(stored: string): string {
  const buf = Buffer.from(stored, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
