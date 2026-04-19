import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/env";

type UnsubscribePayload = {
  userId: string;
  email: string;
  exp: number;
};

const DEFAULT_EXPIRY_SECONDS = 60 * 60 * 24 * 30;

function getSecret(): string {
  return env.NEXTAUTH_SECRET ?? "dev-unsubscribe-secret";
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(encodedPayload: string): string {
  return createHmac("sha256", getSecret()).update(encodedPayload).digest("base64url");
}

export function createUnsubscribeToken(input: {
  userId: string;
  email: string;
  expiresInSeconds?: number;
  now?: Date;
}): string {
  const now = input.now ?? new Date();
  const expiresInSeconds = Math.max(60, Math.floor(input.expiresInSeconds ?? DEFAULT_EXPIRY_SECONDS));

  const payload: UnsubscribePayload = {
    userId: input.userId,
    email: input.email.toLowerCase(),
    exp: Math.floor(now.getTime() / 1000) + expiresInSeconds,
  };

  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyUnsubscribeToken(
  token: string,
  now: Date = new Date(),
):
  | {
      valid: true;
      payload: UnsubscribePayload;
    }
  | {
      valid: false;
      reason: "malformed" | "invalid_signature" | "invalid_payload" | "expired";
    } {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return { valid: false, reason: "malformed" };
  }

  const expectedSignature = signPayload(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return { valid: false, reason: "invalid_signature" };
  }

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return { valid: false, reason: "invalid_signature" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeBase64Url(encodedPayload));
  } catch {
    return { valid: false, reason: "invalid_payload" };
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("userId" in parsed) ||
    !("email" in parsed) ||
    !("exp" in parsed) ||
    typeof parsed.userId !== "string" ||
    typeof parsed.email !== "string" ||
    typeof parsed.exp !== "number"
  ) {
    return { valid: false, reason: "invalid_payload" };
  }

  if (parsed.exp < Math.floor(now.getTime() / 1000)) {
    return { valid: false, reason: "expired" };
  }

  return {
    valid: true,
    payload: {
      userId: parsed.userId,
      email: parsed.email,
      exp: parsed.exp,
    },
  };
}
