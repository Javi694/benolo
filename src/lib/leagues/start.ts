export interface StartableLeague {
  startCondition?: string | null;
  startMinParticipants?: number | null;
  startAt?: string | null;
  signupDeadline?: string | null;
  participants?: number | null;
  status?: string | null;
}

export const hasLeagueStarted = (league?: StartableLeague | null): boolean => {
  if (!league) {
    return true;
  }

  const currentParticipants = Number(league.participants ?? 0);
  const condition = league.startCondition ?? "date";

  if (league.status === "active" || league.status === "completed") {
    return true;
  }

  if (condition === "participants") {
    const minParticipants = league.startMinParticipants ?? null;
    return minParticipants != null && currentParticipants >= minParticipants;
  }

  const startSource = league.startAt ?? league.signupDeadline ?? null;
  if (!startSource) {
    return true;
  }

  return new Date(startSource).getTime() <= Date.now();
};

