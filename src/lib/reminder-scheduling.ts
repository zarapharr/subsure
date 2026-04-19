export type ReminderCadence = "monthly" | "annual";
export type RenewalValueBand = "low" | "medium" | "high";

export type ReminderTimingRule = {
  valueBand: RenewalValueBand;
  leadDays: number;
};

export type ReminderTriggerWindow = {
  startExclusive: Date;
  endInclusive: Date;
};

const VALUE_BAND_THRESHOLDS = {
  mediumMinCents: 2_000,
  highMinCents: 10_000,
} as const;

const RENEWAL_REMINDER_RULES: Record<ReminderCadence, Record<RenewalValueBand, ReminderTimingRule>> = {
  monthly: {
    low: { valueBand: "low", leadDays: 2 },
    medium: { valueBand: "medium", leadDays: 5 },
    high: { valueBand: "high", leadDays: 7 },
  },
  annual: {
    low: { valueBand: "low", leadDays: 14 },
    medium: { valueBand: "medium", leadDays: 21 },
    high: { valueBand: "high", leadDays: 30 },
  },
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TRIGGER_LOOKBACK_HOURS = 26;

function daysInUtcMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function isLastUtcDayOfMonth(date: Date): boolean {
  return date.getUTCDate() === daysInUtcMonth(date.getUTCFullYear(), date.getUTCMonth());
}

function addMonthsClamped(date: Date, months: number): Date {
  const currentMonth = date.getUTCMonth();
  const targetMonth = currentMonth + months;
  const targetYear = date.getUTCFullYear() + Math.floor(targetMonth / 12);
  const normalizedTargetMonth = ((targetMonth % 12) + 12) % 12;
  const maxTargetDay = daysInUtcMonth(targetYear, normalizedTargetMonth);
  const targetDay = isLastUtcDayOfMonth(date) ? maxTargetDay : Math.min(date.getUTCDate(), maxTargetDay);

  return new Date(
    Date.UTC(
      targetYear,
      normalizedTargetMonth,
      targetDay,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

function addYearsClamped(date: Date, years: number): Date {
  const targetYear = date.getUTCFullYear() + years;
  const targetMonth = date.getUTCMonth();
  const maxTargetDay = daysInUtcMonth(targetYear, targetMonth);
  const targetDay = isLastUtcDayOfMonth(date) ? maxTargetDay : Math.min(date.getUTCDate(), maxTargetDay);

  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      targetDay,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

function addCadence(date: Date, cadence: ReminderCadence): Date {
  if (cadence === "monthly") return addMonthsClamped(date, 1);
  return addYearsClamped(date, 1);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isFiniteDate(value: Date): boolean {
  return Number.isFinite(value.getTime());
}

export function isReminderCadence(value: string): value is ReminderCadence {
  return value === "monthly" || value === "annual";
}

export function resolveRenewalValueBand(amountCents: number): RenewalValueBand {
  const normalized = Math.abs(Math.round(amountCents));
  if (!Number.isFinite(normalized)) return "low";

  if (normalized >= VALUE_BAND_THRESHOLDS.highMinCents) return "high";
  if (normalized >= VALUE_BAND_THRESHOLDS.mediumMinCents) return "medium";
  return "low";
}

export function getRenewalReminderTimingRule(cadence: ReminderCadence, amountCents: number): ReminderTimingRule {
  const valueBand = resolveRenewalValueBand(amountCents);
  return RENEWAL_REMINDER_RULES[cadence][valueBand];
}

export function resolveNextRenewalFromLastCharge(
  lastChargedAt: Date,
  cadence: ReminderCadence,
  asOf: Date,
): Date | null {
  if (!isFiniteDate(lastChargedAt) || !isFiniteDate(asOf)) return null;

  let renewal = new Date(lastChargedAt);
  let safetyCounter = 0;

  while (renewal <= asOf && safetyCounter < 600) {
    renewal = addCadence(renewal, cadence);
    if (!isFiniteDate(renewal)) return null;
    safetyCounter += 1;
  }

  return renewal;
}

export function resolveNextRenewalFromIsoDate(
  lastChargedAtIso: string,
  cadence: ReminderCadence,
  asOf: Date,
): Date | null {
  const lastChargedAt = new Date(`${lastChargedAtIso}T00:00:00.000Z`);
  return resolveNextRenewalFromLastCharge(lastChargedAt, cadence, asOf);
}

export function resolveRenewalReminderTriggerAt(
  nextRenewalAt: Date,
  cadence: ReminderCadence,
  amountCents: number,
): Date | null {
  if (!isFiniteDate(nextRenewalAt)) return null;

  const rule = getRenewalReminderTimingRule(cadence, amountCents);
  const triggerAtMs = nextRenewalAt.getTime() - rule.leadDays * DAY_MS;

  return startOfUtcDay(new Date(triggerAtMs));
}

export function buildReminderTriggerWindow(params?: {
  now?: Date;
  lastSweepCompletedAt?: Date | null;
  defaultLookbackHours?: number;
}): ReminderTriggerWindow {
  const now = params?.now ?? new Date();
  const fallbackHours = params?.defaultLookbackHours ?? DEFAULT_TRIGGER_LOOKBACK_HOURS;
  const fallbackStart = new Date(now.getTime() - Math.max(1, fallbackHours) * 60 * 60 * 1000);

  const start = params?.lastSweepCompletedAt ?? fallbackStart;
  const startExclusive = isFiniteDate(start) && start < now ? start : fallbackStart;

  return {
    startExclusive,
    endInclusive: now,
  };
}

export function isDateInTriggerWindow(date: Date, window: ReminderTriggerWindow): boolean {
  if (!isFiniteDate(date) || !isFiniteDate(window.startExclusive) || !isFiniteDate(window.endInclusive)) return false;
  return date > window.startExclusive && date <= window.endInclusive;
}

export function shouldFireRenewalReminder(params: {
  nextRenewalAt: Date;
  cadence: ReminderCadence;
  amountCents: number;
  window: ReminderTriggerWindow;
}): boolean {
  const triggerAt = resolveRenewalReminderTriggerAt(params.nextRenewalAt, params.cadence, params.amountCents);
  if (!triggerAt) return false;
  return isDateInTriggerWindow(triggerAt, params.window);
}
