/** Lowercase, strip accents and punctuation, collapse whitespace. */
export function normalizeTitle(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const SOUNDTRACK_MARKERS = [
  'soundtrack',
  'original motion picture',
  'music from',
  'original score',
  'score from',
  'ost',
  'original series',
  'саундтрек',
  'музыка из',
];

export function looksLikeSoundtrack(albumTitle: string): boolean {
  const t = normalizeTitle(albumTitle);
  return SOUNDTRACK_MARKERS.some((m) => (m === 'ost' ? /\bost\b/.test(t) : t.includes(m)));
}

/** Does an album title mention the film title (ignoring case and punctuation)? */
export function mentionsTitle(albumTitle: string, filmTitle: string): boolean {
  const album = ` ${normalizeTitle(albumTitle)} `;
  const film = normalizeTitle(filmTitle);
  return film.length > 0 && album.includes(` ${film} `);
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = Array.from(parts[0])[0] ?? '';
  const second = parts.length > 1 ? Array.from(parts[1])[0] ?? '' : '';
  return (first + second).toUpperCase();
}
