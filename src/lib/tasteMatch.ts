import type { Domain, TastePair } from './types';
import { domainOf } from './types';

export interface TasteResult {
  /** 0..100, or null when there is not enough overlap yet. */
  score: number | null;
  common: number;
  /** Titles both people rated 4★ or higher, best first. */
  bothLoved: TastePair[];
  /** Titles with a gap of 2★ or more, biggest gap first. */
  disagreements: TastePair[];
}

export const MIN_COMMON_FOR_SCORE = 3;

function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

/**
 * Taste compatibility of two people from the titles both of them rated.
 *
 * Combines how close the ratings are (mean absolute difference) with whether
 * they rank titles the same way (Pearson correlation), then pulls the result
 * toward 50% when the overlap is small so a couple of shared films can't
 * produce a misleading 100%.
 */
export function tasteMatch(pairs: TastePair[], minCommon = MIN_COMMON_FOR_SCORE): TasteResult {
  const common = pairs.length;
  const bothLoved = pairs
    .filter((p) => p.mine >= 4 && p.theirs >= 4)
    .sort((a, b) => Math.min(b.mine, b.theirs) - Math.min(a.mine, a.theirs) || b.mine + b.theirs - (a.mine + a.theirs));
  const disagreements = pairs
    .filter((p) => Math.abs(p.mine - p.theirs) >= 2)
    .sort((a, b) => Math.abs(b.mine - b.theirs) - Math.abs(a.mine - a.theirs));

  if (common < minCommon) {
    return { score: null, common, bothLoved, disagreements };
  }

  const mad = pairs.reduce((sum, p) => sum + Math.abs(p.mine - p.theirs), 0) / common;
  const closeness = Math.max(0, Math.min(1, 1 - mad / 2.5));

  let raw = closeness;
  if (common >= 5) {
    const r = pearson(
      pairs.map((p) => p.mine),
      pairs.map((p) => p.theirs),
    );
    if (r != null) raw = 0.6 * closeness + 0.4 * ((r + 1) / 2);
  }

  const weight = common / (common + 2);
  const score = 0.5 + (raw - 0.5) * weight;
  return {
    score: Math.round(Math.max(0, Math.min(1, score)) * 100),
    common,
    bothLoved,
    disagreements,
  };
}

export function splitPairsByDomain(pairs: TastePair[]): Record<Domain, TastePair[]> {
  const out: Record<Domain, TastePair[]> = { film: [], music: [] };
  for (const p of pairs) out[domainOf(p.media.type)].push(p);
  return out;
}
