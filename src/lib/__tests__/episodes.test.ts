import {
  airedEpisodes,
  episodeAfter,
  episodesUpTo,
  furthestEpisode,
  nextEpisode,
  seenRegularCount,
  totalEpisodes,
} from '../episodes';

const seasons = [
  { season: 0, episodeCount: 3 },
  { season: 1, episodeCount: 3 },
  { season: 2, episodeCount: 2 },
];

describe('episodes', () => {
  it('starts from S1E1 when nothing is seen', () => {
    expect(episodeAfter(null, seasons)).toEqual({ season: 1, episode: 1 });
  });

  it('ignores specials when looking for the furthest episode', () => {
    expect(furthestEpisode([{ season: 0, episode: 3 }, { season: 1, episode: 2 }])).toEqual({ season: 1, episode: 2 });
  });

  it('moves to the next season after the last episode', () => {
    expect(nextEpisode([{ season: 1, episode: 3 }], seasons, null)).toEqual({ season: 2, episode: 1 });
  });

  it('returns null when everything is seen', () => {
    expect(nextEpisode([{ season: 2, episode: 2 }], seasons, null)).toBeNull();
  });

  it('returns null when the next episode has not aired yet', () => {
    expect(nextEpisode([{ season: 2, episode: 1 }], seasons, { season: 2, episode: 1 })).toBeNull();
    expect(nextEpisode([{ season: 1, episode: 3 }], seasons, { season: 2, episode: 1 })).toEqual({
      season: 2,
      episode: 1,
    });
  });

  it('counts episodes without specials', () => {
    expect(totalEpisodes(seasons)).toBe(5);
    expect(airedEpisodes(seasons, { season: 2, episode: 1 })).toBe(4);
    expect(seenRegularCount([{ season: 0, episode: 1 }, { season: 1, episode: 1 }, { season: 1, episode: 1 }])).toBe(1);
  });

  it('lists every episode up to a target', () => {
    expect(episodesUpTo({ season: 2, episode: 1 }, seasons)).toEqual([
      { season: 1, episode: 1 },
      { season: 1, episode: 2 },
      { season: 1, episode: 3 },
      { season: 2, episode: 1 },
    ]);
  });
});
