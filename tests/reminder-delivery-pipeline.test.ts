import { describe, expect, it } from "vitest";
import {
  applyReminderDeliveryAttemptResult,
  buildReminderDeliveryIdempotencyKey,
  calculateReminderRetryDelayMs,
} from "@/lib/reminder-delivery-pipeline";

describe("reminder delivery idempotency", () => {
  it("returns a stable key for the same reminder material", () => {
    const input = {
      userId: "user-1",
      subscriptionCandidateId: "sub-1",
      channel: "email",
      templateId: "renewal-reminder-v1",
      triggerAt: new Date("2026-04-20T12:45:10.000Z"),
    };

    expect(buildReminderDeliveryIdempotencyKey(input)).toBe(buildReminderDeliveryIdempotencyKey(input));
  });

  it("changes key when trigger day changes", () => {
    const keyA = buildReminderDeliveryIdempotencyKey({
      userId: "user-1",
      subscriptionCandidateId: "sub-1",
      channel: "email",
      templateId: "renewal-reminder-v1",
      triggerAt: new Date("2026-04-20T02:00:00.000Z"),
    });

    const keyB = buildReminderDeliveryIdempotencyKey({
      userId: "user-1",
      subscriptionCandidateId: "sub-1",
      channel: "email",
      templateId: "renewal-reminder-v1",
      triggerAt: new Date("2026-04-21T02:00:00.000Z"),
    });

    expect(keyA).not.toBe(keyB);
  });

  it("normalizes channel/template casing and whitespace to prevent duplicates", () => {
    const keyA = buildReminderDeliveryIdempotencyKey({
      userId: "user-1",
      subscriptionCandidateId: "sub-1",
      channel: " Email ",
      templateId: " Renewal-Reminder-V1 ",
      triggerAt: new Date("2026-04-20T01:00:00.000Z"),
    });

    const keyB = buildReminderDeliveryIdempotencyKey({
      userId: "user-1",
      subscriptionCandidateId: "sub-1",
      channel: "email",
      templateId: "renewal-reminder-v1",
      triggerAt: new Date("2026-04-20T22:30:00.000Z"),
    });

    expect(keyA).toBe(keyB);
  });

  it("distinguishes null subscription candidate IDs from literal IDs", () => {
    const nullKey = buildReminderDeliveryIdempotencyKey({
      userId: "user-1",
      subscriptionCandidateId: null,
      channel: "email",
      templateId: "renewal-reminder-v1",
      triggerAt: new Date("2026-04-20T10:00:00.000Z"),
    });

    const literalKey = buildReminderDeliveryIdempotencyKey({
      userId: "user-1",
      subscriptionCandidateId: "__null_subscription_candidate__",
      channel: "email",
      templateId: "renewal-reminder-v1",
      triggerAt: new Date("2026-04-20T10:00:00.000Z"),
    });

    expect(nullKey).not.toBe(literalKey);
  });
});

describe("reminder retry delays", () => {
  it("uses exponential backoff with cap", () => {
    expect(calculateReminderRetryDelayMs(1)).toBe(60_000);
    expect(calculateReminderRetryDelayMs(2)).toBe(120_000);
    expect(calculateReminderRetryDelayMs(3)).toBe(240_000);
    expect(calculateReminderRetryDelayMs(20)).toBe(21_600_000);
  });
});

describe("attempt outcome transitions", () => {
  it("marks successful attempts as sent and clears retry fields", () => {
    const attemptedAt = new Date("2026-04-18T12:00:00.000Z");
    const outcome = applyReminderDeliveryAttemptResult({
      delivery: {
        status: "processing",
        attemptCount: 1,
        maxAttempts: 5,
        nextAttemptAt: attemptedAt,
      },
      attemptedAt,
      success: true,
    });

    expect(outcome.status).toBe("sent");
    expect(outcome.attemptCount).toBe(2);
    expect(outcome.sentAt?.toISOString()).toBe("2026-04-18T12:00:00.000Z");
    expect(outcome.nextAttemptAt).toBeNull();
    expect(outcome.lastErrorCode).toBeNull();
  });

  it("schedules retry for retryable failures before max attempts", () => {
    const attemptedAt = new Date("2026-04-18T12:00:00.000Z");
    const outcome = applyReminderDeliveryAttemptResult({
      delivery: {
        status: "processing",
        attemptCount: 1,
        maxAttempts: 5,
        nextAttemptAt: attemptedAt,
      },
      attemptedAt,
      success: false,
      failure: {
        code: "provider_unavailable",
        message: "Provider returned 503.",
      },
    });

    expect(outcome.status).toBe("pending");
    expect(outcome.attemptCount).toBe(2);
    expect(outcome.nextAttemptAt?.toISOString()).toBe("2026-04-18T12:02:00.000Z");
  });

  it("moves to dead letter for permanent failures", () => {
    const attemptedAt = new Date("2026-04-18T12:00:00.000Z");
    const outcome = applyReminderDeliveryAttemptResult({
      delivery: {
        status: "processing",
        attemptCount: 0,
        maxAttempts: 5,
        nextAttemptAt: attemptedAt,
      },
      attemptedAt,
      success: false,
      failure: {
        code: "invalid_recipient",
        message: "Recipient email failed validation.",
      },
    });

    expect(outcome.status).toBe("dead_letter");
    expect(outcome.nextAttemptAt).toBeNull();
    expect(outcome.lastErrorCode).toBe("invalid_recipient");
  });

  it("moves to dead letter when retries are exhausted", () => {
    const attemptedAt = new Date("2026-04-18T12:00:00.000Z");
    const outcome = applyReminderDeliveryAttemptResult({
      delivery: {
        status: "processing",
        attemptCount: 4,
        maxAttempts: 5,
        nextAttemptAt: attemptedAt,
      },
      attemptedAt,
      success: false,
      failure: {
        code: "timeout",
        message: "Provider timed out.",
      },
    });

    expect(outcome.status).toBe("dead_letter");
    expect(outcome.attemptCount).toBe(5);
    expect(outcome.nextAttemptAt).toBeNull();
  });
});
