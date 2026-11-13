import { ARTIST_IDS, VENUE_IDS } from '../types';
import type { ArtistId, PerformanceId, VenueId } from '../types';

/** 公演 ID ＝ `<推しの id>:<会場の id>`。 */
export function performanceIdOf(artistId: ArtistId, venueId: VenueId): PerformanceId {
  return `${artistId}:${venueId}`;
}

/** 公演 ID の一覧（推し 5 × 会場 12 = 60 件）。API は、この一覧にある ID だけを受ける（設計 D-12）。 */
export const PERFORMANCE_IDS: readonly PerformanceId[] = ARTIST_IDS.flatMap((artistId) =>
  VENUE_IDS.map((venueId) => performanceIdOf(artistId, venueId)),
);

const KNOWN_PERFORMANCE_IDS: ReadonlySet<string> = new Set(PERFORMANCE_IDS);

/** 文字列が、一覧にある公演 ID か（完全一致。前後の空白・大文字小文字の違いは受けない）。 */
export function isPerformanceId(value: unknown): value is PerformanceId {
  return typeof value === 'string' && KNOWN_PERFORMANCE_IDS.has(value);
}
