import { describe, expect, it } from "vitest";
import { buildDashboardListModules } from "@/lib/dashboard-list-modules";
import { MOCK_VALIDATION_CARDS } from "@/lib/validation-queue";
import { TIMELINE_EDGE_CASE_FIXTURES } from "./fixtures/timeline-fixtures";

describe("buildDashboardListModules", () => {
  it("returns at-risk subscriptions sorted by amount desc", () => {
    const modules = buildDashboardListModules(MOCK_VALIDATION_CARDS, {
      asOf: new Date("2026-04-18T00:00:00.000Z"),
      atRiskLimit: 10,
    });

    expect(modules.atRiskSubscriptions).toHaveLength(2);
    expect(modules.atRiskSubscriptions.map((item) => item.merchant)).toEqual(["Adobe Creative Cloud", "Netflix"]);
    expect(modules.atRiskSubscriptions.every((item) => ["cancel", "downgrade"].includes(item.recommendation))).toBe(
      true,
    );
  });

  it("returns upcoming renewals sorted by nearest date", () => {
    const modules = buildDashboardListModules(MOCK_VALIDATION_CARDS, {
      asOf: new Date("2026-04-18T00:00:00.000Z"),
      renewalWindowDays: 30,
      renewalLimit: 10,
    });

    expect(modules.renewalTimeline.map((item) => item.merchant)).toEqual([
      "Adobe Creative Cloud",
      "Netflix",
    ]);
    expect(modules.renewalTimeline[0]).toMatchObject({
      suggestedActionId: "cancel",
      suggestedActionLabel: "Cancel",
      confidenceBand: "high",
    });
    expect(modules.renewalTimeline[1]).toMatchObject({
      suggestedActionId: "downgrade",
      suggestedActionLabel: "Downgrade",
      confidenceBand: "high",
    });
  });

  it("applies list limits", () => {
    const modules = buildDashboardListModules(MOCK_VALIDATION_CARDS, {
      asOf: new Date("2026-04-18T00:00:00.000Z"),
      atRiskLimit: 1,
      renewalLimit: 2,
    });

    expect(modules.atRiskSubscriptions).toHaveLength(1);
    expect(modules.renewalTimeline).toHaveLength(2);
  });

  it("supports sorting renewals by amount descending", () => {
    const modules = buildDashboardListModules(MOCK_VALIDATION_CARDS, {
      asOf: new Date("2026-04-18T00:00:00.000Z"),
      renewalWindowDays: 30,
      renewalSort: "amount_desc",
      renewalLimit: 10,
    });

    expect(modules.renewalTimeline.map((item) => item.merchant)).toEqual([
      "Adobe Creative Cloud",
      "Netflix",
    ]);
  });

  it("supports sorting renewals by latest date first", () => {
    const modules = buildDashboardListModules(MOCK_VALIDATION_CARDS, {
      asOf: new Date("2026-04-18T00:00:00.000Z"),
      renewalWindowDays: 30,
      renewalSort: "latest",
      renewalLimit: 10,
    });

    expect(modules.renewalTimeline.map((item) => item.merchant)).toEqual([
      "Netflix",
      "Adobe Creative Cloud",
    ]);
  });

  it("handles month-end renewals without skipping into the following month", () => {
    const modules = buildDashboardListModules([TIMELINE_EDGE_CASE_FIXTURES[0]!], {
      asOf: new Date("2026-02-27T18:00:00.000-05:00"),
      renewalWindowDays: 10,
      renewalLimit: 10,
    });

    expect(modules.renewalTimeline).toHaveLength(1);
    expect(modules.renewalTimeline[0]?.nextRenewalIso).toBe("2026-02-28T00:00:00.000Z");
  });

  it("clamps annual leap-day renewals to Feb 28 in non-leap years", () => {
    const modules = buildDashboardListModules([TIMELINE_EDGE_CASE_FIXTURES[2]!], {
      asOf: new Date("2025-02-27T00:00:00.000Z"),
      renewalWindowDays: 10,
      renewalLimit: 10,
    });

    expect(modules.renewalTimeline).toHaveLength(1);
    expect(modules.renewalTimeline[0]?.nextRenewalIso).toBe("2025-02-28T00:00:00.000Z");
  });

  it("filters duplicate recommendations out of the renewal timeline", () => {
    const modules = buildDashboardListModules(
      [TIMELINE_EDGE_CASE_FIXTURES[0]!, TIMELINE_EDGE_CASE_FIXTURES[1]!, TIMELINE_EDGE_CASE_FIXTURES[2]!],
      {
        asOf: new Date("2026-04-11T00:00:00.000Z"),
        renewalWindowDays: 365,
        renewalLimit: 10,
      },
    );

    expect(modules.renewalTimeline.some((item) => item.cardId === "card-duplicate")).toBe(false);
  });

  it("ignores unsupported cadence values from runtime data", () => {
    const irregularFixture = {
      ...TIMELINE_EDGE_CASE_FIXTURES[3],
      cadence: "irregular",
    } as unknown as (typeof TIMELINE_EDGE_CASE_FIXTURES)[number];

    const modules = buildDashboardListModules([irregularFixture], {
      asOf: new Date("2026-04-18T00:00:00.000Z"),
      renewalWindowDays: 365,
      renewalLimit: 10,
    });

    expect(modules.renewalTimeline).toHaveLength(0);
  });
});
