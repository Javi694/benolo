import { describe, expect, it } from "vitest";

import {
  mapProviderStatus,
  normalizeFixture,
  hasMatchChanged,
  type ExistingMatchSnapshot,
} from "../supabase/functions/_shared/match-sync";

describe("mapProviderStatus", () => {
  const now = new Date("2025-03-10T12:00:00Z");

  it("returns upcoming for future fixtures", () => {
    const start = new Date("2025-03-11T12:00:00Z").toISOString();
    expect(mapProviderStatus("NS", start, null, null, now)).toBe("upcoming");
  });

  it("returns live when start time has passed without final score", () => {
    const start = new Date("2025-03-10T10:00:00Z").toISOString();
    expect(mapProviderStatus(undefined, start, null, null, now)).toBe("live");
  });

  it("returns completed for finished marker", () => {
    const start = new Date("2025-03-10T10:00:00Z").toISOString();
    expect(mapProviderStatus("FT", start, 2, 1, now)).toBe("completed");
  });

  it("returns completed when final score detected without explicit marker", () => {
    const start = new Date("2025-03-10T10:00:00Z").toISOString();
    expect(mapProviderStatus(undefined, start, 1, 0, now)).toBe("completed");
  });
});

describe("normalizeFixture", () => {
  it("normalizes inputs into internal shape", () => {
    const normalized = normalizeFixture(
      {
        id: "fixture-1",
        homeTeam: "Team A",
        awayTeam: "Team B",
        startTime: "2025-03-12T18:00:00Z",
        status: "NS",
      },
      new Date("2025-03-10T12:00:00Z"),
    );

    expect(normalized.externalRef).toBe("fixture-1");
    expect(normalized.startAt).toBe("2025-03-12T18:00:00.000Z");
    expect(normalized.status).toBe("upcoming");
  });
});

describe("hasMatchChanged", () => {
  it("detects no changes when values match", () => {
    const existing: ExistingMatchSnapshot = {
      start_at: "2025-03-12T18:00:00Z",
      status: "upcoming",
      home_score: null,
      away_score: null,
    };

    const normalized = normalizeFixture(
      {
        id: "fixture-1",
        homeTeam: "Team A",
        awayTeam: "Team B",
        startTime: "2025-03-12T18:00:00Z",
        status: "scheduled",
      },
      new Date("2025-03-10T12:00:00Z"),
    );

    expect(hasMatchChanged(existing, normalized)).toBe(false);
  });

  it("flags updates when score changes", () => {
    const existing: ExistingMatchSnapshot = {
      start_at: "2025-03-10T10:00:00Z",
      status: "live",
      home_score: 1,
      away_score: 0,
    };

    const normalized = normalizeFixture(
      {
        id: "fixture-1",
        homeTeam: "Team A",
        awayTeam: "Team B",
        startTime: "2025-03-10T10:00:00Z",
        status: "FT",
        homeScore: 2,
        awayScore: 0,
      },
      new Date("2025-03-10T12:00:00Z"),
    );

    expect(hasMatchChanged(existing, normalized)).toBe(true);
  });
});
