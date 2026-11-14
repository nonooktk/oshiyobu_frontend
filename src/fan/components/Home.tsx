// ホーム（SP-41）。上の帯 → 推しの絵と名札 → 推しのコメント → メーター → 〔申し込む前だけ〕知らせ → 主のボタン → 副のボタン（SNS への投稿）。
// 主のボタンは、ゲージを進めるために、いま何をすればよいかを示す行動そのもの（申し込む／仲間を呼ぶ／仲間に知らせる／預金を積み増す）。押すと、その場で進む。
// 幅 320〜390px・高さ 640〜844px で、スクロールなしに全部が見える。
import { useEffect, useRef, useState } from 'react';
import { artistView } from '../art/registry';
import logoMark from '../../assets/img/logo-mark.webp';
import { homeActionOf, homeKeyOf } from '../domain/view';
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
  const act = homeActionOf(view);
  const key = homeKeyOf(view);
  const lines = voice.home[key](view.heat.stage, view.cond.city);
  const src = o.art.imgs ? (o.art.imgs[Math.max(0, state.homeIdx)] ?? o.art.imgs[0]) : o.art.img;
  const nextBtn = useRef<HTMLButtonElement>(null);
  // ホームに着いたら、主のボタンにフォーカスを置く
  useEffect(() => {
    nextBtn.current?.focus({ preventScroll: true });
  }, []);
  // 行動が変わったとき（2 行目の 1 行が変わったとき）だけ、ボタンがはずむ
  const hint = `${act.label}${act.sub}`;
  const [prevHint, setPrevHint] = useState(hint);
  const [popKey, setPopKey] = useState(0);
  if (prevHint !== hint) {
    setPrevHint(hint);
    setPopKey(popKey + 1);
  }
  // 副のボタン（SNS への投稿）は、申し込んだあとから。まだ投稿していない間だけ。主のボタンが投稿のときは、重ねない
  const showShare = view.joined && !state.done.share && act.id !== 'share';
  const note = !view.joined
    ? act.id === 'apply'
      ? '押すと、その場で完了します。擬似の動きで、実際の手続きは始まりません。'
      : act.id === 'deposit'
        ? '積み増す額は、次の画面で決めます。仮の預金で、実際の入金は始まりません。'
        : '押すと、その場で完了します。擬似の動きで、実際の入出金は始まりません。'
    : view.status.established
      ? '開催が決まったことを、仲間にも伝えられます。'
      : '投稿してくれてありがとう。';
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

      <Meter view={view} run={state.gaugeRun} />

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
        data-act={act.id}
        className={
          popKey === 0
            ? styles.homeNext
            : `${styles.homeNext} ${popKey % 2 ? styles.btnPopA : styles.btnPopB}`
        }
        aria-label={`${act.label}。${act.hint}`}
        onClick={actions.homePrimary}
      >
        <span className={styles.nxL}>
          {act.label}
          <i className={styles.chev} aria-hidden="true">
            ›
          </i>
        </span>
        <span className={styles.nxW}>{act.sub}</span>
      </button>
      <div className={styles.slot}>
        {showShare ? (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm} ${styles.shareBtn}`}
            onClick={() => actions.openShare('share')}
          >
            SNSに投稿する（任意）
          </button>
        ) : (
          <p className={styles.slotNote}>{note}</p>
        )}
      </div>
    </div>
  );
}
