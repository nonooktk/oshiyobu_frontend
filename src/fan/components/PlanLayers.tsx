// 新しい流れの層（骨組み）: 参加の前の確認・プランを上げるシート・特典の贈呈。
// 見た目は最小限（作り込みは、画面の担当者が行う）。状態と操作は、ストア（store.ts）が持つ。
import { useEffect, useRef, useState } from 'react';
import { artistView } from '../art/registry';
import { rewardMediaOf } from '../art/rewards';
import { ENTRY_PLAN, PLAN_NAMES, planRank, rewardOf, upgradesOf } from '../domain/plan';
import { courseOf } from '../domain/view';
import type { CourseId } from '../../core';
import { yen } from '../text/format';
import styles from '../fan.module.css';
import { useFan } from '../store/FanProvider';
import { Av, WholeArt } from './Art';
import { SheetShell } from './Frame';
import { Wbr } from './text';

/** 参加の前の確認（表示だけ。実際の決済は無い）。 */
export function ConfirmSheet({ inert }: { inert: boolean }) {
  const { state, view, actions } = useFan();
  const yes = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    yes.current?.focus({ preventScroll: true });
  }, []);
  const k = courseOf(view.cond, ENTRY_PLAN);
  const o = artistView(state.oshiId);
  return (
    <SheetShell title="参加しますか？" inert={inert} onClose={actions.closeJoinConfirm} look="plan">
      <div data-layer-body="confirm">
        {/* 推しの小さな絵と、ひとことの説明。言葉の途中で切れないよう、切ってよい所にだけ <wbr> を入れる */}
        <div className={styles.cfHead}>
          <Av a={o} className={styles.cfAv} />
          <p className={`${styles.sheetLead} ${styles.cfLead}`}>
            <Wbr
              parts={[
                `${o.name}を`,
                `${view.cond.city}に呼ぶ`,
                'プロジェクトに、',
                `${PLAN_NAMES[ENTRY_PLAN]}で`,
                '参加します。',
              ]}
            />
          </p>
        </div>
        {/* プランの名前の札と、確保する額を大きく見せるカード */}
        <dl className={styles.cfCard}>
          <div className={styles.cfRow}>
            <dt className={styles.cfLabel}>プラン</dt>
            <dd className={styles.cfPlan}>
              <span className={`${styles.planChip} ${styles.cfChip}`}>
                {PLAN_NAMES[ENTRY_PLAN]}
              </span>
            </dd>
          </div>
          <div className={styles.cfRow}>
            <dt className={styles.cfLabel}>参加のときに確保する額</dt>
            <dd className={`${styles.num} ${styles.cfYen}`}>{yen(k.price)}</dd>
          </div>
        </dl>
        <p className={`${styles.sheetNote} ${styles.cfNote}`}>
          <Wbr
            parts={[
              '確認のための表示です。',
              'デモのため、',
              '実際の決済・',
              '入出金は',
              '行われません。',
            ]}
          />
        </p>
        <div className={styles.sheetBtns}>
          <button
            ref={yes}
            type="button"
            className={`${styles.btn} ${styles.btnFull}`}
            onClick={actions.joinPlan}
          >
            参加する
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary} ${styles.btnFull}`}
            onClick={actions.closeJoinConfirm}
          >
            もどる
          </button>
        </div>
      </div>
    </SheetShell>
  );
}

/**
 * プランの名前の前の飾り（ひし形の宝石の印）。上のプランほど数が増える（ゴールド 1・プラチナ 2・ダイヤモンド 3）。
 * 飾りだけ（読み上げない）。色は、カードの線の色（--plan-line）を引く。
 */
function GemMarks({ plan }: { plan: CourseId }) {
  const n = Math.max(1, planRank(plan));
  return (
    <span className={styles.upGems} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 14 14">
          <path d="M7 1 13 7 7 13 1 7Z" fill="currentColor" />
          <path className={styles.upGemShine} d="M7 3.5 10.5 7 7 10.5 3.5 7Z" />
        </svg>
      ))}
    </span>
  );
}

/** 特典の行の印（リボンをかけた箱）。飾りだけ（読み上げない）。 */
function GiftIcon() {
  return (
    <svg
      className={styles.upGift}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="9" width="18" height="12" rx="2" />
      <path d="M2 9h20M12 9v12M12 9c-2-4-6-5-6-2s4 2 6 2c2 0 6 1 6-2s-4-2-6 2" />
    </svg>
  );
}

/** プランを上げるシート。いまより上のプランを並べる。押すと、条件もまとめて満たして、プランが上がる（デモ用の擬似の操作）。 */
export function UpgradeSheet({ inert }: { inert: boolean }) {
  const { state, view, actions } = useFan();
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus({ preventScroll: true });
  }, []);
  const list = upgradesOf(state.course);
  return (
    <SheetShell title="プランを上げる" inert={inert} onClose={actions.closeUpgrade} look="plan">
      <div data-layer-body="upgrade">
        <p className={styles.sheetNote}>
          押すと、プランの条件（預金・メイン口座）もまとめてそろえます。デモ用の操作で、実際の入出金・手続きは行われません。
        </p>
        <ul className={`${styles.planList} ${styles.upList}`}>
          {list.map((id) => {
            const k = courseOf(view.cond, id);
            const r = rewardOf(id);
            return (
              <li key={id} className={`${styles.planItem} ${styles.upItem}`} data-plan={id}>
                <p className={`${styles.planName} ${styles.upName}`}>
                  <GemMarks plan={id} />
                  {PLAN_NAMES[id]}
                </p>
                <dl className={styles.upFacts}>
                  <div className={styles.upRow}>
                    <dt>確保する額</dt>
                    <dd className={styles.num}>{yen(k.price)}</dd>
                  </div>
                  <div className={styles.upRow}>
                    <dt>条件</dt>
                    <dd className={styles.num}>
                      {k.mainAccount ? 'メイン口座にする ＋ ' : ''}預金 {yen(k.deposit)}以上
                    </dd>
                  </div>
                  {r ? (
                    <div className={`${styles.upRow} ${styles.upReward}`}>
                      <dt>
                        <GiftIcon />
                        特典
                      </dt>
                      <dd>{r.label}</dd>
                    </div>
                  ) : null}
                </dl>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnFull}`}
                  onClick={() => actions.upgradePlan(id)}
                >
                  {PLAN_NAMES[id]}に上げる
                </button>
              </li>
            );
          })}
        </ul>
        <div className={styles.sheetBtns}>
          <button
            ref={close}
            type="button"
            className={`${styles.btn} ${styles.btnSecondary} ${styles.btnFull}`}
            onClick={actions.closeUpgrade}
          >
            閉じる
          </button>
        </div>
      </div>
    </SheetShell>
  );
}

/** 額縁の上の真ん中に結ぶリボン（飾りだけ。読み上げない）。色は、額縁のプランの色を引く。 */
function RibbonBow() {
  return (
    <svg
      className={styles.rfBow}
      width="64"
      height="36"
      viewBox="0 0 64 36"
      strokeWidth="2"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M32 18C24 4 8 2 6 10s10 14 26 8Z" />
      <path d="M32 18c8-14 24-16 26-8s-10 14-26 8Z" />
      <path d="M30 19 22 34h7l3-6 3 6h7l-8-15Z" />
      <circle cx="32" cy="18" r="5" />
    </svg>
  );
}

/** 特典の贈呈（プランを上げた直後と、ホームの「特典を見る」）。素材が無い間は、仮の表示。 */
export function RewardSheet({ plan, inert }: { plan: CourseId; inert: boolean }) {
  const { state, actions } = useFan();
  const close = useRef<HTMLButtonElement>(null);
  // 開く前にいた要素（「特典を見る」など）。プランを上げた直後は、演出をはさむので残っていない
  const [from] = useState(() => (typeof document === 'undefined' ? null : document.activeElement));
  useEffect(() => {
    close.current?.focus({ preventScroll: true });
    // 閉じたら、開く前の要素へ。戻せないときは、ホームの主のボタンへフォーカスを戻す
    return () => {
      const usable = (el: Element | null): el is HTMLElement =>
        el instanceof HTMLElement &&
        el !== document.body &&
        el.isConnected &&
        !el.closest('[inert]');
      const to = usable(from)
        ? from
        : (document.querySelector('button[data-act="upgrade"]') ??
          document.querySelector('button[data-act="share"]'));
      if (usable(to)) to.focus({ preventScroll: true });
    };
  }, [from]);
  const r = rewardOf(plan);
  const o = artistView(state.oshiId);
  const media = rewardMediaOf(state.oshiId, plan);
  if (!r) return null;
  return (
    <SheetShell
      title={`${PLAN_NAMES[plan]}の特典`}
      inert={inert}
      onClose={actions.closeReward}
      look="plan"
    >
      <div data-layer-body="reward" data-reward={r.kind}>
        <p className={`${styles.sheetLead} ${styles.rfLead}`}>
          <Wbr parts={[`${o.name}から、`, `${r.label}が`, '届きました。']} />
        </p>
        {/*
          プレゼントの額縁。縁と敷きの色は、プランごと（data-reward-plan）。
          中の窓は縦横比を決めてあり、仮の推しの絵・画像・動画のどれも、窓いっぱいに縦横比を保って収める（素材の形が違っても、枠は崩れない）。
        */}
        <div className={styles.rewardFrame} data-reward-plan={plan}>
          <div className={styles.rfBox}>
            <RibbonBow />
            <div className={styles.rfWindow}>
              {media && r.kind === 'video' ? (
                <video
                  src={media.src}
                  aria-label={media.alt}
                  muted
                  playsInline
                  autoPlay
                  loop
                  controls
                />
              ) : media ? (
                <img src={media.src} alt={media.alt} />
              ) : (
                <WholeArt
                  src={o.art.imgs?.[0] ?? o.art.img ?? o.circle.src}
                  alt={`${o.name}の絵（${r.label}の仮の表示）`}
                  a={o}
                />
              )}
            </div>
          </div>
          {media ? null : <p className={styles.rewardWait}>{r.label}（準備中の仮の表示）</p>}
        </div>
        <div className={styles.sheetBtns}>
          <button
            ref={close}
            type="button"
            className={`${styles.btn} ${styles.btnFull}`}
            onClick={actions.closeReward}
          >
            閉じる
          </button>
        </div>
      </div>
    </SheetShell>
  );
}
