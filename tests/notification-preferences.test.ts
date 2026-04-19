import { describe, expect, it } from "vitest";
import {
  canSendReminderAt,
  isReminderDeliveryEnabled,
  normalizeNotificationPreferences,
  resolveReminderThrottleDays,
} from "@/lib/notification-preferences";

describe("notification preferences", () => {
  it("normalizes defaults", () => {
    const defaults = normalizeNotificationPreferences();
    expect(defaults.reminderChannel).toBe("email");
    expect(defaults.reminderFrequency).toBe("weekly");
    expect(defaults.unsubscribedAtIso).toBeNull();
  });

  it("marks unsubscribed and channel-none users as delivery disabled", () => {
    expect(
      isReminderDeliveryEnabled(
        normalizeNotificationPreferences({
          reminderChannel: "none",
          reminderFrequency: "daily",
          unsubscribedAtIso: null,
        }),
      ),
    ).toBe(false);

    expect(
      isReminderDeliveryEnabled(
        normalizeNotificationPreferences({
          reminderChannel: "email",
          reminderFrequency: "daily",
          unsubscribedAtIso: "2026-04-18T00:00:00.000Z",
        }),
      ),
    ).toBe(false);
  });

  it("maps frequencies to expected throttles", () => {
    expect(resolveReminderThrottleDays("immediate")).toBe(0);
    expect(resolveReminderThrottleDays("daily")).toBe(1);
    expect(resolveReminderThrottleDays("weekly")).toBe(7);
  });

  it("enforces throttle windows when deciding reminder send", () => {
    const preferences = normalizeNotificationPreferences({
      reminderChannel: "email",
      reminderFrequency: "daily",
      unsubscribedAtIso: null,
    });

    const lastSentAt = new Date("2026-04-18T12:00:00.000Z");

    expect(
      canSendReminderAt({
        preferences,
        lastSentAt,
        candidateSendAt: new Date("2026-04-19T11:59:59.000Z"),
      }),
    ).toBe(false);

    expect(
      canSendReminderAt({
        preferences,
        lastSentAt,
        candidateSendAt: new Date("2026-04-19T12:00:00.000Z"),
      }),
    ).toBe(true);
  });
});
