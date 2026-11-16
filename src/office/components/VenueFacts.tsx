// ③ 会場の候補に添える、実在の会場の情報（要件 R-05・R-16。仕様 4.3・4.4・4.5）。
// データ置き場（src/office/data/）を読む部品。表示だけを行い、core の計算の関数を呼ばない（core からは型だけを読む）。
// どの会場かは、core の会場の ID を props で受け取る。データの会場は、core の会場 ID（coreVenueId）で引く
import type { VenueId } from '../../core';
import { VENUE_RECORDS } from '../data';
import type { VenueRecord } from '../data';
import styles from '../office.module.css';
import { realText } from '../text/labels';

/** core の会場 ID に当たる、実在の会場のデータ（無ければ undefined） */
export function recordOf(venueId: VenueId): VenueRecord | undefined {
  return VENUE_RECORDS.find((record) => record.coreVenueId === venueId);
}

/** 出典のリンク。新しいタブで開く（画面は移らない。S-1） */
export function SourceLink({ href }: { readonly href: string }) {
  return (
    <a className={styles.srcLink} href={href} target="_blank" rel="noopener noreferrer">
      {realText.source}
      <span className="sr-only">{realText.newTab}</span>
    </a>
  );
}

/** 見出しの横の札「実在の公開情報（出典あり・確認日 …）」。確認日は、出しているデータのいちばん新しい日 */
export function RealChip({ dates }: { readonly dates: readonly string[] }) {
  if (dates.length === 0) return null;
  const latest = [...dates].sort().at(-1) ?? '';
  return (
    <span className={styles.realChip} data-testid="real-chip">
      {realText.chip(latest)}
    </span>
  );
}

/** ③ の見出しの横の札。この市の会場のうち、データのある会場の確認日から出す（データが 1 件も無い市は出さない） */
export function CityRealChip({ venueIds }: { readonly venueIds: readonly VenueId[] }) {
  const dates = venueIds.flatMap((id) => {
    const record = recordOf(id);
    return record === undefined ? [] : [record.checkedOn];
  });
  return <RealChip dates={dates} />;
}

/** 選んだ会場のカードの下に出す、詳しい欄（公式の名前・住所の市区・収容人数の根拠・出典・確認日） */
export function VenueFacts({ venueId }: { readonly venueId: VenueId }) {
  const record = recordOf(venueId);
  if (record === undefined) {
    return (
      <p className={styles.facts} data-testid="venue-facts">
        <span className={styles.factsNone}>{realText.noSource}</span>
      </p>
    );
  }
  return (
    <div className={styles.facts} data-testid="venue-facts">
      <p className={styles.factsName}>
        <span className={styles.factsK}>{realText.officialName}</span>
        <span data-testid="official-name">{record.name}</span>
        <span className={styles.factsSub}>{record.city}</span>
      </p>
      <p className={styles.factsBasis}>{record.capacityBasis}</p>
      <p className={styles.factsSrc}>
        <SourceLink href={record.sourceUrl} />
        <span>{realText.checkedOn(record.checkedOn)}</span>
      </p>
    </div>
  );
}
