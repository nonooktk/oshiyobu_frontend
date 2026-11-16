// 新しい流れの層（骨組み）: 参加の前の確認・プランを上げるシート・特典の贈呈。
// 見た目は最小限（作り込みは、画面の担当者が行う）。状態と操作は、ストア（store.ts）が持つ。
import { useEffect, useRef, useState } from 'react';
import { artistView } from '../art/registry';
import { rewardMediaOf } from '../art/rewards';
import { ENTRY_PLAN, PLAN_NAMES, rewardOf, upgradesOf } from '../domain/plan';
import { courseOf } from '../domain/view';
import type { CourseId } from '../../core';
import { yen } from '../text/format';
import styles from '../fan.module.css';
import { useFan } from '../store/FanProvider';
import { WholeArt } from './Art';
import { SheetShell } from './Frame';

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
    <SheetShell title="参加しますか？" inert={inert} onClose={actions.closeJoinConfirm}>
      <div data-layer-body="confirm">
        <p className={styles.sheetLead}>
          {o.name}を{view.cond.city}に呼ぶプロジェクトに、{PLAN_NAMES[ENTRY_PLAN]}で参加します。
        </p>
        <dl className={styles.planFacts}>
          <dt>プラン</dt>
          <dd>{PLAN_NAMES[ENTRY_PLAN]}</dd>
          <dt>参加のときに確保する額</dt>
          <dd className={styles.num}>{yen(k.price)}</dd>
        </dl>
        <p className={styles.sheetNote}>
          確認のための表示です。デモのため、実際の決済・入出金は行われません。
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

/** プランを上げるシート。いまより上のプランを並べる。押すと、条件もまとめて満たして、プランが上がる（デモ用の擬似の操作）。 */
export function UpgradeSheet({ inert }: { inert: boolean }) {
  const { state, view, actions } = useFan();
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus({ preventScroll: true });
  }, []);
  const list = upgradesOf(state.course);
  return (
    <SheetShell title="プランを上げる" inert={inert} onClose={actions.closeUpgrade}>
      <div data-layer-body="upgrade">
        <p className={styles.sheetNote}>
          押すと、プランの条件（預金・メイン口座）もまとめてそろえます。デモ用の操作で、実際の入出金・手続きは行われません。
        </p>
        <ul className={styles.planList}>
          {list.map((id) => {
            const k = courseOf(view.cond, id);
            const r = rewardOf(id);
            return (
              <li key={id} className={styles.planItem} data-plan={id}>
                <p className={styles.planName}>{PLAN_NAMES[id]}</p>
                <dl className={styles.planFacts}>
                  <dt>確保する額</dt>
                  <dd className={styles.num}>{yen(k.price)}</dd>
                  <dt>条件</dt>
                  <dd className={styles.num}>
                    {k.mainAccount ? 'メイン口座にする ＋ ' : ''}預金 {yen(k.deposit)}以上
                  </dd>
                  {r ? (
                    <>
                      <dt>特典</dt>
                      <dd>{r.label}</dd>
                    </>
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
    <SheetShell title={`${PLAN_NAMES[plan]}の特典`} inert={inert} onClose={actions.closeReward}>
      <div data-layer-body="reward" data-reward={r.kind}>
        <p className={styles.sheetLead}>
          {o.name}から、{r.label}が届きました。
        </p>
        <div className={styles.rewardFrame}>
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
            <>
              <WholeArt
                src={o.art.imgs?.[0] ?? o.art.img ?? o.circle.src}
                alt={`${o.name}の絵（${r.label}の仮の表示）`}
                a={o}
              />
              <p className={styles.rewardWait}>{r.label}（準備中の仮の表示）</p>
            </>
          )}
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
