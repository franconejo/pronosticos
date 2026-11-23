export type Outcome = 'H' | 'D' | 'A';

export function outcome(home: number, away: number): Outcome {
  if (home > away) return 'H';
  if (home < away) return 'A';
  return 'D';
}

/**
 * Puntos por pronóstico:
 * - 6: resultado exacto
 * - 3: acertó ganador/empate, pero no el marcador exacto
 * - 1: participó pero no acertó
 */
export function calcPoints(
  predHome: number,
  predAway: number,
  realHome: number,
  realAway: number,
): 6 | 3 | 1 {
  if (predHome === realHome && predAway === realAway) return 6;
  if (outcome(predHome, predAway) === outcome(realHome, realAway)) return 3;
  return 1;
}
