// ホーム（SP-41）。上の帯 → 推しの絵と名札 → 推しのコメント → メーター → 〔申し込む前だけ〕知らせ → 「次のアクション」。
// 幅 375px・高さ 667px と 812px の両方で、スクロールなしに全部が見える。ボタンは「次のアクション」1 つだけ（帯の「メニュー」「リセット」を除く）。
import { useEffect, useRef, useState } from 'react';
import { artistView } from '../art/registry';
import logoMark from '../../assets/img/logo-mark.webp';
import { homeKeyOf, nextViewOf } from '../domain/view';
import { VOICES } from '../text/voices';
import styles from '../fan.module.css';
import { useFan } from '../store/FanProvider';
import { WholeArt } from './Art';
import { Meter } from './Meter';
import { Strip } from './Frame';
import { Wbr } from './text';

export function Home() {
  const { state, view, actions } = useFan();
  const o = artistView(state.oshiId);
  const voice = VOICES[o.id];
  const next = nextViewOf(view);
  const key = homeKeyOf(view);
  const lines = voice.home[key](view.status.left, view.cond.city);
  const src = o.art.imgs ? (o.art.imgs[Math.max(0, state.homeIdx)] ?? o.art.imgs[0]) : o.art.img;
  const nextBtn = useRef<HTMLButtonElement>(null);
  // ホームに着いたら、「次のアクション」にフォーカスを置く
  useEffect(() => {
    nextBtn.current?.focus({ preventScroll: true });
  }, []);
  // 2 行目の 1 行が変わったときだけ、ボタンがはずむ
  const [prevHint, setPrevHint] = useState(next.hint);
  const [popKey, setPopKey] = useState(0);
  if (prevHint !== next.hint) {
    setPrevHint(next.hint);
    setPopKey(popKey + 1);
  }

  return (
    <div className={`${styles.page} ${styles.home}`}>
      <Strip />
      <div className={styles.homeBar}>
        <img src={logoMark} alt="OSHIYOBU" width={32} height={32} />
        <span className={styles.homeBarName} aria-hidden="true">
          OSHIYOBU
        </span>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnText} ${styles.btnSm} ${styles.menuBtn}`}
          onClick={() => actions.go('more')}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          メニュー
        </button>
        <button
          type="button"
          className={styles.resetBtn}
          aria-label="リセット（デモ用）。ファン向けを、はじめの画面に戻す"
          onClick={actions.resetFan}
        >
          <span aria-hidden="true">リセット</span>
          <span className={styles.resetSub} aria-hidden="true">
            （デモ用）
          </span>
        </button>
      </div>

      <section className={styles.hero} aria-label="推しの絵と呼びたい市">
        <div className={styles.heroArt}>
          <WholeArt src={src ?? o.circle.src} alt={`${o.name}の絵`} a={o} />
        </div>
        <p className={styles.heroWho}>
          <span className={styles.nw}>{o.name}を</span>
          <wbr />
          <span className={styles.nw}>
            <b>{view.cond.city}</b>に呼ぶ
          </span>
        </p>
      </section>

      <p className={styles.bubble}>
        {voice.who ? (
          <span className={styles.who} aria-hidden="true">
            {voice.who}
          </span>
        ) : null}
        <span className={styles.srOnly}>
          {o.name}
          {voice.who ? `の${voice.who}` : ''}からのひとこと。
        </span>
        <Wbr parts={lines} />
      </p>

      <Meter view={view} />

      {view.joined ? null : (
        <p className={styles.warn}>
          <span className={styles.warnIcon} aria-hidden="true">
            !
          </span>
          <span className={styles.warnText}>
            <Wbr parts={['まだチケットと特典は', '入手できていません！']} />
          </span>
        </p>
      )}

      <button
        ref={nextBtn}
        type="button"
        className={
          popKey === 0
            ? styles.homeNext
            : `${styles.homeNext} ${popKey % 2 ? styles.btnPopA : styles.btnPopB}`
        }
        onClick={() => actions.go('next')}
      >
        <span className={styles.nxL}>
          次のアクション
          <i className={styles.chev} aria-hidden="true">
            ›
          </i>
        </span>
        <span className={styles.nxW}>{next.hint}</span>
      </button>
    </div>
  );
}
