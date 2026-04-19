import { describe, expect, it } from "vitest";
import { createUnsubscribeToken, verifyUnsubscribeToken } from "@/lib/unsubscribe-token";

describe("unsubscribe token", () => {
  it("round-trips valid tokens", () => {
    const now = new Date("2026-04-18T10:00:00.000Z");
    const token = createUnsubscribeToken({
      userId: "user-1",
      email: "User@Example.com",
      now,
      expiresInSeconds: 3600,
    });

    const verified = verifyUnsubscribeToken(token, new Date("2026-04-18T10:30:00.000Z"));

    expect(verified.valid).toBe(true);
    if (verified.valid) {
      expect(verified.payload.userId).toBe("user-1");
      expect(verified.payload.email).toBe("user@example.com");
    }
  });

  it("fails on tampered signature", () => {
    const token = createUnsubscribeToken({
      userId: "user-1",
      email: "user@example.com",
      now: new Date("2026-04-18T10:00:00.000Z"),
      expiresInSeconds: 3600,
    });

    const [payload] = token.split(".");
    const tampered = `${payload}.invalid-signature`;
    const verified = verifyUnsubscribeToken(tampered, new Date("2026-04-18T10:30:00.000Z"));

    expect(verified.valid).toBe(false);
    if (!verified.valid) {
      expect(verified.reason).toBe("invalid_signature");
    }
  });

  it("fails after expiry", () => {
    const token = createUnsubscribeToken({
      userId: "user-1",
      email: "user@example.com",
      now: new Date("2026-04-18T10:00:00.000Z"),
      expiresInSeconds: 60,
    });

    const verified = verifyUnsubscribeToken(token, new Date("2026-04-18T10:02:00.000Z"));

    expect(verified.valid).toBe(false);
    if (!verified.valid) {
      expect(verified.reason).toBe("expired");
    }
  });
});
