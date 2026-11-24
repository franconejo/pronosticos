export type Outcome = 'H' | 'D' | 'A';

export function outcome(home: number, away: number): Outcome {
  if (home > away) return 'H';
  if (home < away) return 'A';
  return 'D';
}

export interface MatchContext {
  realHome: number;
  realAway: number;
  isKnockout: boolean;
  realPenaltyWinner: 'home' | 'away' | null;
}

export interface PredInput {
  userId: string;
  predHome: number;
  predAway: number;
  predPenaltyWinner: 'home' | 'away' | null;
}

export interface ScoredPred {
  userId: string;
  points: 6 | 3 | 1;
  prizeEligible: boolean;
}

function isDraw(h: number, a: number) {
  return h === a;
}

/**
 * Calcula puntos para todos los pronósticos de un partido.
 *
 * Reglas normales:
 * - 6: resultado exacto
 * - 3: acertó ganador/empate
 * - 1: participó
 *
 * Reglas eliminatoria con empate real:
 * - Exacto + penal correcto = 6, elegible a premio
 * - Exacto + penal incorrecto = 3; pero si NADIE acertó exacto+penal correcto,
 *   pasa a 6 puntos sin premio
 * - Empate no exacto + penal correcto = 3
 * - Empate no exacto + penal incorrecto = 3 (acertó empate)
 * - Predijo ganador (no empate) = 1
 */
export function calcMatchResults(ctx: MatchContext, preds: PredInput[]): ScoredPred[] {
  const realDraw = isDraw(ctx.realHome, ctx.realAway);
  const knockoutDraw = ctx.isKnockout && realDraw;

  if (!knockoutDraw) {
    return preds.map((p) => {
      const exact = p.predHome === ctx.realHome && p.predAway === ctx.realAway;
      if (exact) return { userId: p.userId, points: 6, prizeEligible: true };
      const sameOutcome = outcome(p.predHome, p.predAway) === outcome(ctx.realHome, ctx.realAway);
      return { userId: p.userId, points: sameOutcome ? 3 : 1, prizeEligible: false };
    });
  }

  const fullExact = (p: PredInput) =>
    p.predHome === ctx.realHome &&
    p.predAway === ctx.realAway &&
    p.predPenaltyWinner === ctx.realPenaltyWinner;

  const anyFullExact = preds.some(fullExact);

  return preds.map((p) => {
    const predDraw = isDraw(p.predHome, p.predAway);
    if (!predDraw) {
      return { userId: p.userId, points: 1, prizeEligible: false };
    }

    const exactScore = p.predHome === ctx.realHome && p.predAway === ctx.realAway;
    const correctPenalty = p.predPenaltyWinner === ctx.realPenaltyWinner;

    if (exactScore && correctPenalty) {
      return { userId: p.userId, points: 6, prizeEligible: true };
    }

    if (exactScore && !correctPenalty) {
      if (anyFullExact) {
        return { userId: p.userId, points: 3, prizeEligible: false };
      }
      return { userId: p.userId, points: 6, prizeEligible: false };
    }

    // empate no exacto
    if (correctPenalty) {
      return { userId: p.userId, points: 3, prizeEligible: false };
    }
    return { userId: p.userId, points: 3, prizeEligible: false };
  });
}
