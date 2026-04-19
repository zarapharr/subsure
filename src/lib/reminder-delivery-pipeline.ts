import { createHash } from "node:crypto";

export type ReminderDeliveryStatus = "pending" | "processing" | "sent" | "dead_letter";

export type ReminderDeliveryErrorCode =
  | "provider_unavailable"
  | "timeout"
  | "network_error"
  | "rate_limited"
  | "invalid_recipient"
  | "unsubscribed"
  | "template_not_found"
  | "unknown";

export type ReminderDeliveryRecord = {
  status: ReminderDeliveryStatus;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: Date;
};

export type ReminderDeliveryFailure = {
  code: ReminderDeliveryErrorCode;
  message: string;
};

export type ReminderDeliveryAttemptOutcome =
  | {
      status: "sent";
      attemptCount: number;
      sentAt: Date;
      lastAttemptAt: Date;
      nextAttemptAt: null;
      lastErrorCode: null;
      lastErrorMessage: null;
    }
  | {
      status: "pending";
      attemptCount: number;
      sentAt: null;
      lastAttemptAt: Date;
      nextAttemptAt: Date;
      lastErrorCode: ReminderDeliveryErrorCode;
      lastErrorMessage: string;
    }
  | {
      status: "dead_letter";
      attemptCount: number;
      sentAt: null;
      lastAttemptAt: Date;
      nextAttemptAt: null;
      lastErrorCode: ReminderDeliveryErrorCode;
      lastErrorMessage: string;
    };

const RETRYABLE_ERROR_CODES = new Set<ReminderDeliveryErrorCode>([
  "provider_unavailable",
  "timeout",
  "network_error",
  "rate_limited",
  "unknown",
]);

export const DEFAULT_RETRY_CONFIG = {
  baseDelayMs: 60_000,
  maxDelayMs: 6 * 60 * 60 * 1_000,
} as const;

function clampAttempts(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function normalizeDate(value: Date): Date {
  return Number.isFinite(value.getTime()) ? value : new Date();
}

export function buildReminderDeliveryIdempotencyKey(input: {
  userId: string;
  subscriptionCandidateId: string | null;
  channel: string;
  templateId: string;
  triggerAt: Date;
}): string {
  const triggerDay = input.triggerAt.toISOString().slice(0, 10);
  const normalizedSubscriptionCandidateId =
    input.subscriptionCandidateId === null ? "subscription_candidate:null" : `subscription_candidate:${input.subscriptionCandidateId}`;
  const raw = [
    input.userId,
    normalizedSubscriptionCandidateId,
    input.channel.trim().toLowerCase(),
    input.templateId.trim().toLowerCase(),
    triggerDay,
  ].join("|");

  const hash = createHash("sha256").update(raw).digest("hex").slice(0, 24);
  return `reminder:${hash}`;
}

export function isRetryableReminderDeliveryError(code: ReminderDeliveryErrorCode): boolean {
  return RETRYABLE_ERROR_CODES.has(code);
}

export function calculateReminderRetryDelayMs(
  attemptCount: number,
  config?: { baseDelayMs?: number; maxDelayMs?: number },
): number {
  const baseDelayMs = Math.max(1_000, Math.floor(config?.baseDelayMs ?? DEFAULT_RETRY_CONFIG.baseDelayMs));
  const maxDelayMs = Math.max(baseDelayMs, Math.floor(config?.maxDelayMs ?? DEFAULT_RETRY_CONFIG.maxDelayMs));

  const normalizedAttemptCount = Math.max(1, clampAttempts(attemptCount));
  const delay = baseDelayMs * 2 ** (normalizedAttemptCount - 1);

  return Math.min(delay, maxDelayMs);
}

export function applyReminderDeliveryAttemptResult(params: {
  delivery: ReminderDeliveryRecord;
  attemptedAt?: Date;
  success: boolean;
  failure?: ReminderDeliveryFailure;
  retryConfig?: { baseDelayMs?: number; maxDelayMs?: number };
}): ReminderDeliveryAttemptOutcome {
  const attemptedAt = normalizeDate(params.attemptedAt ?? new Date());
  const previousAttemptCount = clampAttempts(params.delivery.attemptCount);
  const maxAttempts = Math.max(1, clampAttempts(params.delivery.maxAttempts));
  const attemptCount = previousAttemptCount + 1;

  if (params.success) {
    return {
      status: "sent",
      attemptCount,
      sentAt: attemptedAt,
      lastAttemptAt: attemptedAt,
      nextAttemptAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    };
  }

  const failure: ReminderDeliveryFailure = params.failure ?? {
    code: "unknown",
    message: "Reminder delivery failed for an unknown reason.",
  };

  const exhausted = attemptCount >= maxAttempts;
  const retryable = isRetryableReminderDeliveryError(failure.code);

  if (!retryable || exhausted) {
    return {
      status: "dead_letter",
      attemptCount,
      sentAt: null,
      lastAttemptAt: attemptedAt,
      nextAttemptAt: null,
      lastErrorCode: failure.code,
      lastErrorMessage: failure.message,
    };
  }

  const retryDelayMs = calculateReminderRetryDelayMs(attemptCount, params.retryConfig);

  return {
    status: "pending",
    attemptCount,
    sentAt: null,
    lastAttemptAt: attemptedAt,
    nextAttemptAt: new Date(attemptedAt.getTime() + retryDelayMs),
    lastErrorCode: failure.code,
    lastErrorMessage: failure.message,
  };
}
