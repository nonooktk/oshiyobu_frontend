// コースのカードの中身（はじめの画面のステップ 3 と、応援コースの画面で同じ）。
// 絵 → 金額 → コース名 → 手に入るもの（全部・✓ つき）→ 小さな情報（枠・条件）→ 自分の状態の札。
import { canApply } from '../core';
import type { Condition, CourseOffer } from '../core';
import type { ArtistView } from '../art/registry';
import { yen } from '../text/format';
import { needTag, slotsText } from '../domain/view';
import styles from '../fan.module.css';
import { CardPic } from './Art';

type Props = {
  k: CourseOffer;
  cond: Condition;
  a: ArtistView;
  deposit: number;
  pay: boolean;
  /** 申し込み中のコースか。 */
  mine?: boolean;
  /** 名前の右の印。 */
  mark?: '選択中' | '目指すコース' | '';
  /** 選べる印の輪を出すか。 */
  ring?: boolean;
};

export function CourseFace({
  k,
  cond,
  a,
  deposit,
  pay,
  mine = false,
  mark = '',
  ring = false,
}: Props) {
  const ok = canApply(k, deposit, pay);
  return (
    <>
      <CardPic art={a.cards[k.id]} />
      <span className={styles.rcBody}>
        <span className={`${styles.rcPrice} ${styles.num}`}>
          {k.price.toLocaleString('ja-JP')}円
        </span>
        <span className={styles.rcName}>
          <span>{k.name}</span>
          {mark ? (
            <span className={`${styles.rcMark} ${styles.rcMarkOn}`}>
              {mark === '選択中' ? '✓ ' : ''}
              {mark}
            </span>
          ) : ring ? (
            <span className={styles.rcMark} aria-hidden="true" />
          ) : null}
        </span>
        <span className={styles.rcPerks} role="list" aria-label={`${k.name}の手に入るもの`}>
          {k.perks.map((x) => (
            <span key={x} className={styles.rcLi} role="listitem">
              {x}
            </span>
          ))}
        </span>
        <span className={styles.rcInfo}>
          <span>{slotsText(k, cond, mine)}</span>
          <span>
            条件{' '}
            {k.mainAccount ? (
              <>
                <span className={styles.nw}>メイン口座にする</span> ＋{' '}
              </>
            ) : null}
            <span className={styles.nw}>預金 {yen(k.deposit)}以上</span>
          </span>
        </span>
        {mine ? (
          <span className={`${styles.rcTag} ${styles.rcTagMe}`}>✓ 申し込み中</span>
        ) : ok ? (
          <span className={`${styles.rcTag} ${styles.rcTagOk}`}>✓ 申し込めます</span>
        ) : (
          <span className={`${styles.rcTag} ${styles.rcTagNg}`}>{needTag(k, deposit, pay)}</span>
        )}
      </span>
    </>
  );
}
