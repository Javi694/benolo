export interface PredictionInput {
  predictedHome: number | null | undefined;
  predictedAway: number | null | undefined;
  actualHome: number | null | undefined;
  actualAway: number | null | undefined;
  confident?: boolean | null;
}

const normalizeScore = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const outcomeFromScores = (home: number, away: number) => {
  const diff = home - away;
  if (diff === 0) {
    return 0;
  }
  return diff > 0 ? 1 : -1;
};

/**
 * Mirror of the Supabase `compute_prediction_points` SQL function.
 */
export const computePredictionPoints = ({
  predictedHome,
  predictedAway,
  actualHome,
  actualAway,
  confident,
}: PredictionInput): number => {
  const homePred = normalizeScore(predictedHome);
  const awayPred = normalizeScore(predictedAway);
  const homeActual = normalizeScore(actualHome);
  const awayActual = normalizeScore(actualAway);

  if (homePred === null || awayPred === null || homeActual === null || awayActual === null) {
    return 0;
  }

  let points = 0;

  const predictedOutcome = outcomeFromScores(homePred, awayPred);
  const actualOutcome = outcomeFromScores(homeActual, awayActual);

  if (homePred === homeActual && awayPred === awayActual) {
    points = 6;
  } else if (predictedOutcome === actualOutcome) {
    points = 3;
  }

  if (confident && points > 0) {
    points *= 1.1;
  }

  return points;
};

export const computePredictionPointsRounded = (input: PredictionInput) =>
  Number(computePredictionPoints(input).toFixed(2));
