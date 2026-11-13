import styles from './DemoBadge.module.css';

// 全画面に出す札の文言（N-12・SP-80）。画面を足したら、この部品を足す。消さない
const TEXT = 'デモ用の架空データ';

type Props = {
  /** 置き場所（右寄せ・余白など）を決めたいときだけ渡す。札そのものの見た目は変えない */
  className?: string;
};

export function DemoBadge({ className }: Props) {
  return <span className={className ? `${styles.badge} ${className}` : styles.badge}>{TEXT}</span>;
}
