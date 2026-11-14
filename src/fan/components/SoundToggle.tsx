// 称賛の音のオン・オフのボタン（統括の決定）。全画面の上の帯に、常に置く。既定はオン。押せる大きさ（44px 以上）。読み上げの名前つき。
import styles from '../fan.module.css';
import { useFan } from '../store/FanProvider';

export function SoundToggle() {
  const { state, actions } = useFan();
  const on = state.soundOn;
  return (
    <button
      type="button"
      className={styles.soundBtn}
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
