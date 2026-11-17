// ④ これまでの公演（要件 R-07・R-16。受け入れ V-04。仕様 4.3〜4.5）。
// データ置き場（src/office/data/）を読む部品。表示だけを行い、core の計算の関数を呼ばない（core からは型だけを読む）。
// 並べ替え（日の新しいものから）は、表示の範囲（仕様 4.4）。どの会場かは、core の会場の ID を props で受け取る。
// 見出しは「これまでの公演」（「過去」の字は書体に無いので使わない）
import type { VenueId } from '../../core';
import { PAST_EVENTS } from '../data';
import type { PastEvent } from '../data';
import styles from '../office.module.css';
import { eventDate, realText } from '../text/labels';
import { RealChip, recordOf, SourceLink } from './VenueFacts';

/** その会場の公演を、日の新しいものから（同じ日は、アーティストの名前の順） */
export function eventsOf(venueId: VenueId): readonly PastEvent[] {
  const record = recordOf(venueId);
  if (record === undefined) return [];
  return PAST_EVENTS.filter((event) => event.venueId === record.id).sort(
    (a, b) => b.date.localeCompare(a.date) || a.artist.localeCompare(b.artist, 'ja'),
  );
}

export function PastEvents({ venueId }: { readonly venueId: VenueId | null }) {
  const events = venueId === null ? [] : eventsOf(venueId);
  return (
    <section className={styles.pastCol} aria-labelledby="past-h">
      <span className={styles.sideNum} aria-hidden="true">
        4
      </span>
      <h3 className={styles.sideH} id="past-h" data-testid="past-head">
        {realText.pastHead}
      </h3>
      <RealChip dates={events.map((event) => event.checkedOn)} />
      {venueId === null ? (
        <p className={styles.pastNone} data-testid="past-none">
          {realText.pickVenueFirst}
        </p>
      ) : events.length === 0 ? (
        <p className={styles.pastNone} data-testid="past-none">
          {realText.noEvents}
        </p>
      ) : (
        <ol className={styles.pastList} data-testid="past-list">
          {events.map((event) => (
            <li key={`${event.date}-${event.artist}`}>
              <span className={styles.pastDate}>{eventDate(event.date)}</span>
              <span className={styles.pastArtist}>{event.artist}</span>
              {event.title !== undefined && event.title !== '' && (
                <span className={styles.pastTitle}>{event.title}</span>
              )}
              <SourceLink href={event.sourceUrl} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
