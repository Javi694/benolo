import { describe, expect, it, beforeEach, vi } from "vitest";

import { hasLeagueStarted, type StartableLeague } from "@/lib/leagues/start";

describe("hasLeagueStarted", () => {
  const now = new Date("2025-03-10T10:00:00Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  it("returns true when league is already flagged active", () => {
    expect(hasLeagueStarted({ status: "active" })).toBe(true);
  });

  it("handles participant-based trigger", () => {
    const league: StartableLeague = {
      startCondition: "participants",
      startMinParticipants: 5,
      participants: 4,
    };
    expect(hasLeagueStarted(league)).toBe(false);

    expect(hasLeagueStarted({ ...league, participants: 5 })).toBe(true);
  });

  it("handles date-based trigger", () => {
    const future = new Date("2025-03-10T12:00:00Z").toISOString();
    const past = new Date("2025-03-10T08:00:00Z").toISOString();

    expect(hasLeagueStarted({ startCondition: "date", startAt: future })).toBe(false);
    expect(hasLeagueStarted({ startCondition: "date", startAt: past })).toBe(true);
  });

  it("falls back to signup deadline when startAt missing", () => {
    const deadline = new Date("2025-03-10T09:00:00Z").toISOString();
    expect(hasLeagueStarted({ signupDeadline: deadline })).toBe(true);
  });

  it("defaults to started when no condition provided", () => {
    expect(hasLeagueStarted({})).toBe(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});

