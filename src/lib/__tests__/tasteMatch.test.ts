import { splitPairsByDomain, tasteMatch } from '../tasteMatch';
import type { TastePair } from '../types';

function pair(id: string, mine: number, theirs: number, type: TastePair['media']['type'] = 'movie'): TastePair {
  return { media: { type, id, title: id }, mine, theirs };
}

describe('tasteMatch', () => {
  it('needs at least three titles in common', () => {
    const result = tasteMatch([pair('a', 5, 5), pair('b', 4, 4)]);
    expect(result.score).toBeNull();
    expect(result.common).toBe(2);
  });

  it('gives a high score to identical tastes', () => {
    const pairs = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5].map((r, i) => pair(String(i), r, r));
    const { score } = tasteMatch(pairs);
    expect(score).not.toBeNull();
    expect(score!).toBeGreaterThanOrEqual(90);
  });

  it('gives a low score to opposite tastes', () => {
    const pairs = [5, 4.5, 4, 1, 0.5, 1.5, 5, 0.5, 4, 1].map((r, i) => pair(String(i), r, 5.5 - r));
    const { score } = tasteMatch(pairs);
    expect(score!).toBeLessThan(25);
  });

  it('pulls small overlaps toward the middle', () => {
    const three = tasteMatch([pair('a', 5, 5), pair('b', 3, 3), pair('c', 1, 1)]).score!;
    const many = tasteMatch(
      [5, 3, 1, 4, 2, 5, 3, 1, 4, 2, 5, 3].map((r, i) => pair(String(i), r, r)),
    ).score!;
    expect(three).toBeLessThan(many);
    expect(three).toBeGreaterThan(50);
  });

  it('lists shared favourites and the biggest disagreements', () => {
    const result = tasteMatch([pair('loved', 5, 4.5), pair('meh', 3, 3), pair('fight', 5, 1), pair('small', 4, 2)]);
    expect(result.bothLoved.map((p) => p.media.id)).toEqual(['loved']);
    expect(result.disagreements.map((p) => p.media.id)).toEqual(['fight', 'small']);
  });

  it('splits pairs into film and music', () => {
    const split = splitPairsByDomain([pair('m', 4, 4), pair('t', 3, 3, 'tv'), pair('a', 5, 5, 'album')]);
    expect(split.film).toHaveLength(2);
    expect(split.music).toHaveLength(1);
  });
});
