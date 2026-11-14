// 重ねる層のうち、主な流れで使うもの: 80% の演出・ごほうびの演出（FxLayer）、条件の達成のエフェクト（AchLayer）、
// 特典の絵（GiftLayer）、感謝のメッセージ（ThanksLayer）、共有のシート（ShareSheet）。主な流れなので、最初に読む側に入れる（設計 D-40）。
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { DEMO_NOTICE_TEXT, DemoBadge } from '../../shared/components/DemoBadge';
import { artistView } from '../art/registry';
import { thanksOf } from '../text/thanks';
import { SHARE_NAMES, SHARE_ORDER, buildPostText } from '../domain/share';
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

/** FEVER の瞬間（派手）にだけ出す、画面を横切る帯。 */
const BAND_TEXT = 'FEVER FEVER FEVER FEVER FEVER FEVER FEVER FEVER ';
function Bands() {
  return (
    <div className={styles.fxBands} aria-hidden="true">
      {[0, 1, 2].map((n) => (
        <div key={n} className={styles.fxBand}>
          <span className={styles.ttlBand}>{BAND_TEXT + BAND_TEXT}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * 称賛の演出・ごほうびの演出。押す・Esc で飛ばせる。
 * 光 → 放射の光 → 大きい文字 → 紙ふぶき → 褒めことばのカード（あなたがしたこと → それで何が進んだか）→ 推しのひとこと。
 * ホームの上では、暗くするのをゲージの手前までにして、ゲージの伸びが見えるようにする。大きい文字は、画面の幅に収める。
 */
export function FxLayer({ fx, inert }: { fx: FxSpec; inert: boolean }) {
  const { state, actions } = useFan();
  const o = artistView(state.oshiId);
  const root = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLElement>(null);
  const [size, setSize] = useState(fx.size);
  const sizeNow = useRef(fx.size);
  useReturnFocus();
  useLayoutEffect(() => {
    const el = root.current;
    const shell = el?.parentElement;
    if (!el || !shell) return undefined;
    let alive = true;
    const fit = (): void => {
      if (!alive) return;
      const box = shell.getBoundingClientRect();
      if (box.height <= 0) return; // 測れない環境（試験の画面）では、何もしない
      // 暗くする範囲は、ゲージの手前まで（ホームの上の称賛だけ）
      const gauge = fx.overHome ? shell.querySelector('[data-heat]') : null;
      const cut = gauge ? gauge.getBoundingClientRect().top - box.top - 6 : box.height;
      el.style.setProperty('--fx-cut', `${Math.max(120, Math.round(cut))}px`);
      el.style.setProperty('--fx-cy', gauge ? `${Math.round(cut * 0.34)}px` : '42%');
      // 大きい文字は、画面の幅からはみ出さない（左右の余白と、縁取りの分を引いた幅に収める）
      const t = title.current;
      if (!t || t.offsetWidth <= 0) return;
      const natural = (t.offsetWidth * fx.size) / sizeNow.current; // 決めた大きさのときの幅
      const room = box.width - 32 - fx.stroke * 2;
      const next = natural > room ? Math.max(24, Math.floor((fx.size * room) / natural)) : fx.size;
      if (next !== sizeNow.current) {
        sizeNow.current = next;
        setSize(next);
      }
    };
    fit();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    ro?.observe(shell);
    // 書体が届いて、文字の幅が変わったときも、収め直す（最初に測った幅は、代わりの書体のことがある）
    if (title.current) ro?.observe(title.current);
    void document.fonts?.ready.then(fit);
    return () => {
      alive = false;
      ro?.disconnect();
    };
  }, [fx.overHome, fx.size, fx.stroke, fx.title]);
  const cls = fx.strong ? `${styles.fx} ${styles.fxStrong}` : styles.fx;
  return (
    <div
      ref={root}
      className={cls}
      data-layer="fx"
      data-kind={fx.kind}
      aria-hidden="true"
      inert={inert}
      style={vars({
        '--fx-size': `${size}px`,
        '--fx-stroke': `${Math.max(5, Math.round((fx.stroke * size) / fx.size))}px`,
        '--fx-sub': `${fx.subSize}px`,
      })}
      onClick={() => actions.hideFx(fx.id)}
    >
      <div className={styles.dim} />
      <div className={styles.lines} />
      <Confetti list={fx.confetti} />
      {fx.strong ? <Bands /> : null}
      <div className={styles.flash} />
      <div className={styles.fxStage}>
        <div className={styles.ttl}>
          <b ref={title}>{fx.title}</b>
        </div>
        <p className={styles.fxSub}>
          <span className={styles.fxSubA}>{fx.small}</span>
          <span className={styles.fxSubB}>{fx.sub}</span>
        </p>
        {fx.say ? (
          <div className={styles.fxSay}>
            <Av a={o} className={styles.sayAv} />
            <span>{fx.say}</span>
          </div>
        ) : null}
      </div>
      <span className={`${styles.chip} ${styles.fxNotice}`}>{DEMO_NOTICE_TEXT}</span>
      <span className={`${styles.chip} ${styles.fxChip}`}>デモ用の架空データ</span>
      <span className={styles.fxHint}>タップで閉じます</span>
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
      data-layer="ach"
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
      <span className={`${styles.chip} ${styles.fxNotice}`}>{DEMO_NOTICE_TEXT}</span>
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
      data-layer="gift"
      role="dialog"
      aria-modal="true"
      aria-label={`特典 ${k}/3`}
      inert={inert}
    >
      <div className={styles.gView} ref={ref}>
        <span className={`${styles.chip} ${styles.gNotice}`}>{DEMO_NOTICE_TEXT}</span>
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
  const { state, view, actions } = useFan();
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
      data-layer="thanks"
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
          <span className={styles.thanksText}>
            {thanksOf(state.oshiId, view.cond.city).join('')}
          </span>
          <span className={styles.thanksClose}>押すと閉じます</span>
        </span>
      </button>
      <span className={`${styles.chip} ${styles.fxNotice}`} style={{ zIndex: 49 }}>
        {DEMO_NOTICE_TEXT}
      </span>
      <span className={`${styles.chip} ${styles.fxChip}`} style={{ zIndex: 49 }}>
        デモ用の架空データ
      </span>
    </div>
  );
}

const SHARE_TITLE: Record<ShareMode, string> = {
  share: 'SNSに投稿する',
  friend: '仲間を呼ぶ',
};

/** 共有のシート（SP-52）。X・Instagram・Facebook のどれも、押すと投稿したことになる（外へは出ない。コピーもしない）。 */
export function ShareSheet({ mode, inert }: { mode: ShareMode; inert: boolean }) {
  const { state, view, actions } = useFan();
  const o = artistView(state.oshiId);
  const close = useRef<HTMLButtonElement>(null);
  useReturnFocus();
  useEffect(() => {
    close.current?.focus({ preventScroll: true });
  }, []);
  const { heat } = view;
  const big = view.status.established ? ['ライブの開催が', '決まりました'] : null;
  const plain = big ? big.join('') : `開催熱量は${heat.name}。${heat.distance}`;
  const text = buildPostText(view);
  return (
    <div
      className={styles.sheetBg}
      data-layer="share"
      inert={inert}
      onClick={(e) => e.target === e.currentTarget && actions.closeShare()}
      role="presentation"
    >
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={SHARE_TITLE[mode]}>
        {/* 札は、シートの見出しの行に置く（後ろの画面が下へスクロールされていても見える。P-01） */}
        <div className={styles.sheetHead}>
          <h2>{SHARE_TITLE[mode]}</h2>
          <DemoBadge />
        </div>
        <div
          className={styles.shareFrame}
          role="img"
          aria-label={`共有用の画像。${plain.replace(/\s+/g, '')}`}
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
                開催熱量
                <br />
                <b className={styles.num}>{heat.name}</b>
              </>
            )}
          </p>
          <p className={styles.shareSub}>
            {view.cond.city} ／ {view.cond.venue.day}
          </p>
          <div className={styles.shareMini}>
            <i style={{ '--g': Math.max(heat.fill, 0.02) } as CSSProperties} />
          </div>
        </div>
        <label className={styles.postLab} htmlFor="fan-post-text">
          投稿文（自動作成）
        </label>
        <textarea id="fan-post-text" className={styles.postText} readOnly value={text} />
        <p className={styles.shareNote}>
          押すと投稿したことになります（デモのため、実際には投稿されません）。
        </p>
        <div className={styles.shareBtns}>
          {SHARE_ORDER.map((ch) => (
            <button
              key={ch}
              type="button"
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={() => actions.shareTo(ch)}
            >
              {SHARE_NAMES[ch]}
            </button>
          ))}
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
