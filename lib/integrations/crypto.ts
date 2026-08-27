import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function keyFor(secret: string): Buffer {
  if (secret.trim().length < 32) throw new Error("Integration encryption is not configured.");
  return createHash("sha256").update(secret).digest();
}

function encode(value: Buffer): string {
  return value.toString("base64url");
}

function decode(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

export function encryptIntegrationValue(value: string, secret: string, additionalData: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, keyFor(secret), iv);
  cipher.setAAD(Buffer.from(additionalData));
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${encode(iv)}.${encode(tag)}.${encode(encrypted)}`;
}

export function decryptIntegrationValue(value: string, secret: string, additionalData: string): string {
  const [version, ivValue, tagValue, ciphertextValue] = value.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue) throw new Error("Integration credential is malformed.");
  const decipher = createDecipheriv(ALGORITHM, keyFor(secret), decode(ivValue));
  decipher.setAAD(Buffer.from(additionalData));
  decipher.setAuthTag(decode(tagValue));
  return Buffer.concat([decipher.update(decode(ciphertextValue)), decipher.final()]).toString("utf8");
}

export function secureEquals(left: string, right: string): boolean {
  const leftValue = Buffer.from(left);
  const rightValue = Buffer.from(right);
  return leftValue.length === rightValue.length && timingSafeEqual(leftValue, rightValue);
}

export function createOpaqueValue(): string {
  return randomBytes(32).toString("base64url");
}
