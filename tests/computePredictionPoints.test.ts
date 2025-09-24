import { describe, expect, it } from "vitest";

import {
  computePredictionPoints,
  computePredictionPointsRounded,
} from "@/lib/scoring/points";

describe("computePredictionPoints", () => {
  it("returns zero when scores are missing", () => {
    expect(
      computePredictionPoints({
        predictedHome: null,
        predictedAway: 1,
        actualHome: 2,
        actualAway: 0,
      }),
    ).toBe(0);
  });

  it("awards 6 points for an exact scoreline", () => {
    expect(
      computePredictionPoints({
        predictedHome: 2,
        predictedAway: 1,
        actualHome: 2,
        actualAway: 1,
      }),
    ).toBe(6);
  });

  it("applies the confidence multiplier", () => {
    expect(
      computePredictionPointsRounded({
        predictedHome: 2,
        predictedAway: 0,
        actualHome: 1,
        actualAway: 0,
        confident: true,
      }),
    ).toBe(3.3);
  });

  it("awards points for correct outcome and goal difference", () => {
    expect(
      computePredictionPoints({
        predictedHome: 3,
        predictedAway: 1,
        actualHome: 2,
        actualAway: 0,
      }),
    ).toBe(3);
  });

  it("awards only outcome points when diff differs", () => {
    expect(
      computePredictionPoints({
        predictedHome: 3,
        predictedAway: 1,
        actualHome: 2,
        actualAway: 1,
      }),
    ).toBe(3);
  });

  it("returns zero when outcome is incorrect", () => {
    expect(
      computePredictionPoints({
        predictedHome: 0,
        predictedAway: 2,
        actualHome: 1,
        actualAway: 0,
      }),
    ).toBe(0);
  });

  it("preserves floating precision for the confidence boost", () => {
    expect(
      computePredictionPoints({
        predictedHome: 2,
        predictedAway: 0,
        actualHome: 1,
        actualAway: 0,
        confident: true,
      }),
    ).toBeCloseTo(3.3, 5);
  });
});
