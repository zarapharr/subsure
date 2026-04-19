import { z } from "zod";

export const REMINDER_CHANNELS = ["email", "none"] as const;
export type ReminderChannel = (typeof REMINDER_CHANNELS)[number];

export const REMINDER_FREQUENCIES = ["immediate", "daily", "weekly"] as const;
export type ReminderFrequency = (typeof REMINDER_FREQUENCIES)[number];

export const notificationPreferencesSchema = z.object({
  reminderChannel: z.enum(REMINDER_CHANNELS).default("email"),
  reminderFrequency: z.enum(REMINDER_FREQUENCIES).default("weekly"),
  unsubscribedAtIso: z.string().datetime().nullable().default(null),
});

export const updateNotificationPreferencesSchema = z.object({
  reminderChannel: z.enum(REMINDER_CHANNELS),
  reminderFrequency: z.enum(REMINDER_FREQUENCIES),
});

export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

export function normalizeNotificationPreferences(input?: Partial<NotificationPreferences>): NotificationPreferences {
  return notificationPreferencesSchema.parse(input ?? {});
}

export function isReminderDeliveryEnabled(preferences: NotificationPreferences): boolean {
  return preferences.reminderChannel !== "none" && !preferences.unsubscribedAtIso;
}

export function resolveReminderThrottleDays(frequency: ReminderFrequency): number {
  if (frequency === "immediate") return 0;
  if (frequency === "daily") return 1;
  return 7;
}

export function canSendReminderAt(params: {
  preferences: NotificationPreferences;
  lastSentAt: Date | null;
  candidateSendAt: Date;
}): boolean {
  if (!isReminderDeliveryEnabled(params.preferences)) return false;

  if (!params.lastSentAt) return true;

  const throttleDays = resolveReminderThrottleDays(params.preferences.reminderFrequency);
  if (throttleDays === 0) return true;

  const nextAllowedAt = new Date(params.lastSentAt.getTime() + throttleDays * 24 * 60 * 60 * 1000);
  return params.candidateSendAt >= nextAllowedAt;
}
