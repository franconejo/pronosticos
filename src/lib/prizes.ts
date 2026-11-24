export interface MatchPrediction {
  userId: string;
  points: number;
  prizeEligible?: boolean;
}

export interface MatchPrizeResult extends MatchPrediction {
  prize: number;
}

/**
 * Premio por partido:
 * - Solo cobran resultado exacto elegible a premio (points==6 y prizeEligible!=false).
 * - Si hay un solo ganador elegible: basePrize * 2.
 * - Si hay varios ganadores elegibles: basePrize para cada uno.
 */
export function calcMatchPrizes(
  preds: MatchPrediction[],
  basePrize: number,
): MatchPrizeResult[] {
  const eligibleWinners = preds.filter((p) => p.points === 6 && p.prizeEligible !== false);
  const singleWinnerPrize = basePrize * 2;

  return preds.map((p) => {
    const winsMoney = p.points === 6 && p.prizeEligible !== false;
    return {
      ...p,
      prize: winsMoney ? (eligibleWinners.length === 1 ? singleWinnerPrize : basePrize) : 0,
    };
  });
}

export interface RankedGroup {
  points: number;
  userIds: string[];
}

export interface MonthlyPayoutSuggestion {
  userId: string;
  suggestedPrize: number;
  needsReview: boolean;
  reason: string;
}

export interface MonthlySuggestion {
  payouts: MonthlyPayoutSuggestion[];
  needsReview: boolean;
}

/**
 * Sugerencia de premios mensuales por bolsas ocupadas.
 * slots: [1er, 2do, 3er], ej. [80000, 50000, 30000]
 * groups: ordenados por puntos desc; cada grupo son usuarios empatados.
 */
export function suggestMonthlyPayouts(
  slots: number[],
  groups: RankedGroup[],
): MonthlySuggestion {
  let slotIndex = 0;
  let needsReview = false;
  const payouts: MonthlyPayoutSuggestion[] = [];

  for (const group of groups) {
    if (slotIndex >= slots.length) break;

    const k = group.userIds.length;
    const available = slots.slice(slotIndex, slotIndex + k);
    const overflow = available.length < k;
    const manyTied = k > 3;
    const groupNeedsReview = overflow || manyTied;
    if (groupNeedsReview) needsReview = true;

    const sum = available.reduce((a, b) => a + b, 0);
    const base = Math.floor(sum / k);
    const remainder = sum - base * k;

    const reason = overflow
      ? 'No alcanzan bolsas definidas para este empate'
      : manyTied
        ? 'Más de 3 empatados en el mismo puesto; revisar'
        : '';

    group.userIds.forEach((userId, idx) => {
      payouts.push({
        userId,
        suggestedPrize: base + (idx < remainder ? 1 : 0),
        needsReview: groupNeedsReview,
        reason,
      });
    });

    slotIndex += k;
  }

  return { payouts, needsReview };
}
