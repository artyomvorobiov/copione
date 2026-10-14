import { csvObjects, parseCsv, toCsv } from '../csv';
import { detectLetterboxdKind, parseLetterboxdCsv } from '../letterboxd';

describe('csv', () => {
  it('parses quotes, commas and line breaks inside fields', () => {
    const text = '﻿a,b,c\r\n1,"two, three","say ""hi""\nbye"\n';
    expect(parseCsv(text)).toEqual([
      ['a', 'b', 'c'],
      ['1', 'two, three', 'say "hi"\nbye'],
    ]);
  });

  it('round-trips through toCsv', () => {
    const rows = [
      ['Name', 'Review'],
      ['Dune, Part Two', 'He said "wow"\nTwice'],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });

  it('builds objects keyed by header', () => {
    const { records } = csvObjects('Name,Year\nAlien,1979\n');
    expect(records).toEqual([{ Name: 'Alien', Year: '1979' }]);
  });
});

describe('letterboxd import', () => {
  it('detects export files', () => {
    expect(detectLetterboxdKind(['Date', 'Name', 'Year', 'Letterboxd URI', 'Rating', 'Rewatch', 'Review', 'Tags', 'Watched Date'], 'reviews.csv')).toBe('reviews');
    expect(detectLetterboxdKind(['Date', 'Name', 'Year', 'Letterboxd URI', 'Rating', 'Rewatch', 'Tags', 'Watched Date'], 'diary.csv')).toBe('diary');
    expect(detectLetterboxdKind(['Date', 'Name', 'Year', 'Letterboxd URI', 'Rating'], 'ratings.csv')).toBe('ratings');
    expect(detectLetterboxdKind(['Date', 'Name', 'Year', 'Letterboxd URI'], 'watchlist.csv')).toBe('watchlist');
    expect(detectLetterboxdKind(['Date', 'Name', 'Year', 'Letterboxd URI'], 'watched.csv')).toBe('watched');
    expect(detectLetterboxdKind(['foo'], 'x.csv')).toBeNull();
  });

  it('parses diary rows', () => {
    const csv = [
      'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date',
      '2024-03-02,Dune: Part Two,2024,https://boxd.it/x,4.5,,,2024-03-01',
      '2024-03-05,"Paris, Texas",1984,https://boxd.it/y,,Yes,,2024-03-04',
    ].join('\n');
    const file = parseLetterboxdCsv(csv, 'diary.csv');
    expect(file?.kind).toBe('diary');
    expect(file?.rows).toEqual([
      { name: 'Dune: Part Two', year: 2024, rating: 4.5, watchedOn: '2024-03-01', rewatch: false, review: null },
      { name: 'Paris, Texas', year: 1984, rating: null, watchedOn: '2024-03-04', rewatch: true, review: null },
    ]);
  });
});
