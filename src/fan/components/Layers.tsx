// 重ねる層のうち、主な流れで使うもの: 80% の演出・ごほうびの演出（FxLayer）、条件の達成のエフェクト（AchLayer）、
// 特典の絵（GiftLayer）、感謝のメッセージ（ThanksLayer）、共有のシート（ShareSheet）。主な流れなので、最初に読む側に入れる（設計 D-40）。
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { artistView } from '../art/registry';
import { THANKS } from '../text/thanks';
import { buildPostText } from '../domain/share';
import type { AchSpec, FxSpec, ShareMode } from '../domain/state';
import { VOICES } from '../text/voices';
import styles from '../fan.module.css';
import { useFan } from '../store/FanProvider';
import { Av, GiftArt } from './Art';
import { useReturnFocus } from './Frame';

const vars = (o: Record<string, string>): CSSProperties => o as CSSProperties;

function Confetti({ list }: { list: FxSpec['confetti'] }) {
  return (
    <div className={styles.conf} aria-hidden="true">
      {list.map((c, i) => (
        <i
          key={i}
          style={{
            left: `${c.left}%`,
            background: c.color,
            animationDuration: `${c.dur}s`,
            animationDelay: `${c.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

/** 80% の演出・ごほうびの演出。押す・Esc で飛ばせる。 */
export function FxLayer({ fx, inert }: { fx: FxSpec; inert: boolean }) {
  const { state, actions } = useFan();
  const o = artistView(state.oshiId);
  useReturnFocus();
  return (
    <div
      className={styles.fx}
      aria-hidden="true"
      inert={inert}
      style={vars({
        '--fx-size': `${fx.size}px`,
        '--fx-stroke': `${fx.stroke}px`,
        '--fx-sub': `${fx.subSize}px`,
      })}
      onClick={() => actions.hideFx(fx.id)}
    >
      <div className={styles.dim} />
      <div className={styles.lines} />
      <Confetti list={fx.confetti} />
      <div className={styles.flash} />
      <div className={styles.ttl}>
        <b>{fx.title}</b>
        <small>{fx.small}</small>
      </div>
      <div className={styles.fxSub}>
        <span>{fx.sub}</span>
      </div>
      {fx.say ? (
        <div className={styles.fxSay}>
          <Av a={o} className={styles.sayAv} />
          <span>{fx.say}</span>
        </div>
      ) : null}
      <span className={`${styles.chip} ${styles.fxChip}`}>デモ用の架空データ</span>
    </div>
  );
}

/** 条件の達成のエフェクト（画面いっぱい。操作は止めない。押す・キーを押すと消える）。 */
export function AchLayer({ ach }: { ach: AchSpec }) {
  const { state } = useFan();
  const all = ach.kind === 'all';
  const o = artistView(state.oshiId);
  return (
    <div
      className={all ? `${styles.ach} ${styles.achAll}` : styles.ach}
      aria-hidden="true"
      style={vars({ '--ach-ms': `${ach.ms}ms`, '--ach-size': `${all ? 100 : 104}px` })}
    >
      <div className={styles.dim} />
      <div className={styles.lines} />
      <Confetti list={ach.confetti} />
      <div className={styles.achC}>
        <b className={styles.achT}>{ach.title}</b>
        {ach.title2 ? <b className={`${styles.achT} ${styles.l2}`}>{ach.title2}</b> : null}
        {ach.small ? <span className={styles.achS}>{ach.small}</span> : null}
        {all ? <Av a={o} className={styles.achAv} /> : null}
        <span className={styles.achP}>{ach.sub}</span>
      </div>
      {ach.flash ? <div className={styles.flash} /> : null}
      <span className={`${styles.chip} ${styles.fxChip}`}>デモ用の架空データ</span>
    </div>
  );
}

/** 枠の縦横比（横 ÷ 縦）。特典の絵の切り抜きの広げ方を決める。 */
function useAspect(): [(el: HTMLElement | null) => void, number] {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [q, setQ] = useState(1.2);
  useEffect(() => {
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (r.height > 0) setQ(r.width / r.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, q];
}

/** 特典の絵（開いた数が 1・2・3 の段階）。 */
export function GiftLayer({ replay, inert }: { replay: boolean; inert: boolean }) {
  const { state, view, actions } = useFan();
  const o = artistView(state.oshiId);
  const close = useRef<HTMLButtonElement>(null);
  const [ref, q] = useAspect();
  useReturnFocus();
  useEffect(() => {
    close.current?.focus({ preventScroll: true });
  }, []);
  const k = view.giftCount;
  const voice = VOICES[state.oshiId].say;
  const say =
    state.lastGift === 'share'
      ? voice.share()
      : state.lastGift === 'friend'
        ? voice.friend()
        : voice.join(view.cond.city);
  return (
    <div
      className={replay ? styles.gift : `${styles.gift} ${styles.giftReveal}`}
      role="dialog"
      aria-modal="true"
      aria-label={`特典 ${k}/3`}
      inert={inert}
    >
      <div className={styles.gView} ref={ref}>
        <span className={`${styles.chip} ${styles.gChip}`}>デモ用の架空データ</span>
        <GiftArt a={o} idx={Math.max(0, k - 1)} ratio={q} alt={`${o.name}の特典の絵 ${k}/3`} />
      </div>
      <div className={styles.gPanel}>
        <h2 className={styles.gStep}>
          {replay ? `特典 ${k}/3（開いています）` : `特典 ${k}/3 が開きました`}
        </h2>
        <p className={styles.gSay}>
          <Av a={o} className={styles.sayAv} />
          <span>{say}</span>
        </p>
        <button
          ref={close}
          type="button"
          className={`${styles.btn} ${styles.btnAccent} ${styles.btnFull}`}
          onClick={actions.closeGift}
        >
          閉じる
        </button>
      </div>
    </div>
  );
}

/** 感謝のメッセージ（3 つ目の特典の絵を閉じた直後に 1 回）。押す・Esc で閉じる。 */
export function ThanksLayer({ inert }: { inert: boolean }) {
  const { state, actions } = useFan();
  const o = artistView(state.oshiId);
  const voice = VOICES[state.oshiId];
  const btn = useRef<HTMLButtonElement>(null);
  useReturnFocus();
  useEffect(() => {
    btn.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div
      className={styles.fx}
      role="dialog"
      aria-modal="true"
      aria-label={`${o.name}からの感謝のメッセージ`}
      inert={inert}
    >
      <div className={styles.dim} />
      <div className={styles.lines} />
      <button ref={btn} type="button" className={styles.thanks} onClick={actions.closeThanks}>
        <span className={styles.thanksCard}>
          <Av a={o} className={styles.achAv} />
          <span className={styles.thanksName}>
            {voice.who ? `${o.name}・${voice.who}より` : `${o.name}より`}
          </span>
          <span className={styles.thanksText}>{THANKS[state.oshiId].join('')}</span>
          <span className={styles.thanksClose}>押すと閉じます</span>
        </span>
      </button>
      <span className={`${styles.chip} ${styles.fxChip}`} style={{ zIndex: 49 }}>
        デモ用の架空データ
      </span>
    </div>
  );
}

const SHARE_TITLE: Record<ShareMode, string> = {
  share: 'SNSで広める',
  notice: '仲間に知らせる',
  friend: '仲間を呼ぶ',
};

/** 共有のシート（SP-52）。X・Instagram・Facebook。ボタンを押したときだけ、外へ出る。 */
export function ShareSheet({ mode, inert }: { mode: ShareMode; inert: boolean }) {
  const { state, view, actions } = useFan();
  const o = artistView(state.oshiId);
  const close = useRef<HTMLButtonElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  useReturnFocus();
  useEffect(() => {
    close.current?.focus({ preventScroll: true });
  }, []);
  const s = view.status;
  const big = s.established
    ? ['ライブの開催が', '決まりました']
    : s.gathered
      ? ['人数は', '集まりました']
      : null;
  const plain = big ? big.join('') : `ライブ開催まで あと${s.left}人`;
  const text = buildPostText(view);
  const ig = async (): Promise<void> => {
    await actions.shareTo('ig');
  };
  return (
    <div
      className={styles.sheetBg}
      inert={inert}
      onClick={(e) => e.target === e.currentTarget && actions.closeShare()}
      role="presentation"
    >
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={SHARE_TITLE[mode]}>
        <h2>{SHARE_TITLE[mode]}</h2>
        <div
          className={styles.shareFrame}
          role="img"
          aria-label={`共有用の画像。達成率${s.pct}%。${plain.replace(/\s+/g, '')}`}
        >
          <span className={styles.shareTag}>#OSHIYOBU</span>
          <span className={styles.shareOm}>
            <Av a={o} />
          </span>
          <p className={styles.shareBig}>
            {big ? (
              <>
                {big[0]}
                <br />
                {big[1]}
              </>
            ) : (
              <>
                ライブ開催まで
                <br />
                あと<b className={styles.num}>{s.left}</b>人
              </>
            )}
          </p>
          <p className={styles.shareSub}>
            {view.cond.city} ／ {view.cond.venue.day}
          </p>
          <div className={styles.shareMini}>
            <i style={{ width: `${s.fill.toFixed(1)}%` }} />
          </div>
        </div>
        <label className={styles.postLab} htmlFor="fan-post-text">
          投稿文（自動作成）
        </label>
        <textarea id="fan-post-text" ref={area} className={styles.postText} readOnly value={text} />
        <p className={styles.shareNote}>
          ボタンを押したときだけ、投稿画面を開きます（X・Facebook）。Instagramでは、文面をコピーします。
        </p>
        <div className={styles.shareBtns}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={() => void actions.shareTo('x')}
          >
            X
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={() => void ig()}
          >
            Instagram
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={() => void actions.shareTo('fb')}
          >
            Facebook
          </button>
        </div>
        <div className={styles.sheetBtns}>
          <button
            ref={close}
            type="button"
            className={`${styles.btn} ${styles.btnFull}`}
            onClick={actions.closeShare}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
