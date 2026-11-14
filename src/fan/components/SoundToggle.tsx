// 称賛の音のオン・オフのボタン（統括の決定）。全画面の上の帯に、常に置く。既定はオン。押せる大きさ（44px 以上）。読み上げの名前つき。
// 演出・シートなどの層が出ているあいだは、下の画面（帯を含む）が押せなくなる。そのため、層ごとに、押せる音のボタンをもう 1 つ出す。
// 驚いた人が、演出の最中でも音を止められる（QA G2-13）。置き場所は、層の札（「デモ用の架空データ」など）を隠さない所:
//   strip ＝ 全画面の上の帯の左（ふだん）／fx ＝ ホームの上の称賛の演出の、暗くした範囲の下の端（「タップで閉じます」の右）／
//   float ＝ 特典・感謝・ほかの演出の上の、札の行の下／sheet ＝ 下から出るシートの見出しの行
import styles from '../fan.module.css';
import { useFan } from '../store/FanProvider';

export type SoundPlace = 'strip' | 'fx' | 'float' | 'sheet';
/** 置き場所ごとの、追加のクラス名（帯は、なし）。 */
const PLACE_CLASSES: Record<SoundPlace, readonly string[]> = {
  strip: [],
  fx: ['soundFloat', 'soundFx'],
  float: ['soundFloat'],
  sheet: ['soundSheet'],
};

export function SoundToggle({ place = 'strip' }: { place?: SoundPlace }) {
  const { state, actions } = useFan();
  const on = state.soundOn;
  return (
    <button
      type="button"
      className={[styles.soundBtn, ...PLACE_CLASSES[place].map((name) => styles[name])].join(' ')}
      aria-label="称賛の音"
      aria-pressed={on}
      onClick={actions.toggleSound}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
        {on ? (
          <>
            <path d="M16.5 8.5a5 5 0 0 1 0 7" />
            <path d="M19 6a8.5 8.5 0 0 1 0 12" />
          </>
        ) : (
          <path d="M17 9l5 6M22 9l-5 6" />
        )}
      </svg>
    </button>
  );
}
