// ホーム（SP-41）。上の帯 → 推しの絵と名札 → 推しのコメント → メーター → 〔申し込む前だけ〕知らせ → 主のボタン → 副のボタン（SNS への投稿）。
// 主のボタンは、ゲージを進めるために、いま何をすればよいかを示す行動そのもの（申し込む／仲間を呼ぶ／仲間に知らせる／預金を積み増す）。押すと、その場で進む。
// 幅 320〜390px・高さ 640〜844px で、スクロールなしに全部が見える。
import { useEffect, useRef, useState } from 'react';
import { artistView } from '../art/registry';
import logoMark from '../../assets/img/logo-mark.webp';
import { PLAN_NAMES, backdropOf, homePhaseOf, rewardOf, upgradesOf } from '../domain/plan';
import { homeKeyOf } from '../domain/view';
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
  const phase = homePhaseOf(state, view.cond);
  const canUp = upgradesOf(state.course).length > 0;
  // 主のボタン（預金でやることが済むまでは 1 つ。済んだあとは「SNSで広める」と「プランを上げる」の 2 つ）
  const act =
    phase === 'start'
      ? {
          id: 'rejoin',
          label: '参加するプランを選ぶ',
          sub: '→ プランの一覧へ',
          hint: '押すと、プランを選ぶ画面に戻ります',
          run: actions.rejoin,
        }
      : phase === 'tasks'
        ? {
            id: 'tasks',
            label: '預金でやることへ',
            sub: '→ 推し活定期と預金の準備',
            hint: '押すと、預金でやることのページへ移ります',
            run: actions.goTasks,
          }
        : {
            id: 'share',
            label: 'SNSで広める',
            sub: '→ 応援が広がります',
            hint: '押すと、投稿のシートが開きます',
            run: () => actions.openShare('share'),
          };
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
  const planName = state.course ? PLAN_NAMES[state.course] : '';
  const hasReward = state.course !== null && rewardOf(state.course) !== null;
  const note =
    phase === 'start'
      ? 'いまは、参加していません。'
      : phase === 'tasks'
        ? '預金でやることが済むと、SNSで広める・プランを上げる、に進めます。'
        : canUp
          ? '擬似の動きです。実際の投稿・入出金は始まりません。'
          : 'いちばん上のプランです。応援ありがとう。';
  return (
    <div className={`${styles.page} ${styles.home}`} data-plan-tier={backdropOf(state.course)}>
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

      {planName ? (
        <p className={styles.planLine}>
          <span className={styles.planChip}>{planName}</span>
          {hasReward ? (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnText} ${styles.btnSm}`}
              onClick={() => actions.press(actions.showReward)}
            >
              特典を見る
            </button>
          ) : null}
        </p>
      ) : null}

      <div className={phase === 'grow' && canUp ? styles.homePair : undefined}>
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
          aria-busy={state.held}
          onClick={() => actions.press(act.run)}
        >
          <span className={styles.nxL}>
            {act.label}
            <i className={styles.chev} aria-hidden="true">
              ›
            </i>
          </span>
          <span className={styles.nxW}>{act.sub}</span>
        </button>
        {phase === 'grow' && canUp ? (
          <button
            type="button"
            data-act="upgrade"
            className={styles.homeNext}
            aria-label="プランを上げる。押すと、上のプランの一覧が開きます"
            aria-busy={state.held}
            onClick={() => actions.press(actions.openUpgrade)}
          >
            <span className={styles.nxL}>
              プランを上げる
              <i className={styles.chev} aria-hidden="true">
                ›
              </i>
            </span>
            <span className={styles.nxW}>→ 特典が届きます</span>
          </button>
        ) : null}
      </div>
      <div className={styles.slot}>
        <p className={styles.slotNote}>{note}</p>
      </div>
    </div>
  );
}
