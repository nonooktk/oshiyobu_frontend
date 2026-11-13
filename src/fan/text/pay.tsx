// お支払いの説明と、自分の状態の一行（はじめの画面のステップ 3 と、応援コースの画面で同じ言い方）。
import { Wbr } from '../components/text';
import styles from '../fan.module.css';
import { yen } from './format';

/** お支払いの説明（1 か所だけ。カードごとには繰り返さない）。 */
export function PayNote() {
  return (
    <>
      <b>お支払い</b>{' '}
      <Wbr
        parts={[
          '申し込むと確定します。',
          '金額は、',
          '成立まで',
          '口座の中で',
          '確保されます。',
          'ライブの開催が',
          '決まらなければ、',
          'お金は動きません。',
        ]}
      />
    </>
  );
}

/** 自分の状態: 預金（仮）とメイン口座。 */
export function MyState({ deposit, pay }: { deposit: number; pay: boolean }) {
  return (
    <>
      いまの預金（仮）<b className={`${styles.num} ${styles.nw}`}>{yen(deposit)}</b>・<wbr />
      <span className={styles.nw}>
        メイン口座 <b>{pay ? 'はい' : 'いいえ'}</b>
      </span>
    </>
  );
}
