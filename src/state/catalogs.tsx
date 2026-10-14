import { createContext, type ReactNode, useContext, useMemo } from 'react';

import { createFilmCatalog, createMusicCatalog } from '@/catalog';
import type { CatalogContext, FilmCatalog, MusicCatalog } from '@/catalog/types';

import { useSettings } from './settings';

interface CatalogsValue {
  film: FilmCatalog;
  music: MusicCatalog;
  ctx: CatalogContext;
}

const film = createFilmCatalog();
const music = createMusicCatalog();

const CatalogsContext = createContext<CatalogsValue | null>(null);

export function CatalogsProvider({ children }: { children: ReactNode }) {
  const { lang, region } = useSettings();
  const value = useMemo(() => ({ film, music, ctx: { lang, region } }), [lang, region]);
  return <CatalogsContext.Provider value={value}>{children}</CatalogsContext.Provider>;
}

export function useCatalogs(): CatalogsValue {
  const ctx = useContext(CatalogsContext);
  if (!ctx) throw new Error('useCatalogs must be used inside CatalogsProvider');
  return ctx;
}
