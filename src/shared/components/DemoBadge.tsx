import styles from './DemoBadge.module.css';

// 全画面に出す札の文言（N-12・SP-80）。画面を足したら、この部品を足す。消さない
const TEXT = 'デモ用の架空データ';
/** 動作確認用の画面であることを、いまの札の隣に出す文（統括の指示）。ファン向けの層の札も、この文を使う */
export const DEMO_NOTICE_TEXT = '動作確認用のデモ画面です';

type Props = {
  /** 置き場所（右寄せ・余白など）を決めたいときだけ渡す。札そのものの見た目は変えない */
  className?: string;
};

export function DemoBadge({ className }: Props) {
  const place = className ? ` ${className}` : '';
  return (
    <span className={`${styles.pair}${place}`}>
      <span className={styles.badge}>{DEMO_NOTICE_TEXT}</span>
      <span className={`${styles.badge}${place}`}>{TEXT}</span>
    </span>
  );
}
