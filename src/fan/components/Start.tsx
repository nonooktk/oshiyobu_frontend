// はじめの画面（推し → コースの 2 ステップ。SP-40）。初めから選んであるので、「次へ」と「このコースを目指して始める」で、ホームへ進む。
// 呼ぶ市は、どの推しでも久留米市に固定（市を選ぶ画面は無い）。会場の説明は、コースを選ぶ画面に置く。
import { useEffect, useRef } from 'react';
import { ARTIST_IDS } from '../../core';
import { ARTISTS_VIEW, artistView } from '../art/registry';
import logoMark from '../../assets/img/logo-mark.webp';
import { ENTRY_PLAN, PLAN_NAMES, PLAN_ORDER, rewardOf } from '../domain/plan';
import { courseOf } from '../domain/view';
import { yen } from '../text/format';
import styles from '../fan.module.css';
import { useFan } from '../store/FanProvider';
import { Av, WholeArt } from './Art';
import { Strip } from './Frame';
import { LockIcon } from './LockIcon';
import { Wbr } from './text';

const TITLES = ['推しを選ぶ', '参加するプランを選ぶ'] as const;

export function Start() {
  const { state, view, actions } = useFan();
  const s = state.start;
  const heading = useRef<HTMLHeadingElement>(null);
  const step = s?.step ?? 0;
  // ステップが変わったら、見出しにフォーカスを移す（読み上げは、ストアの live が伝える）
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [step]);
  if (!s) return null;

  const o = artistView(s.oshiId);
  const c = view.cond; // 会場は、久留米の既定の会場に固定

  return (
    <div className={`${styles.page} ${step === 1 ? styles.step3 : ''}`}>
      <Strip />
      <div className={styles.stBar}>
        {step === 0 ? <img src={logoMark} alt="OSHIYOBU" width={32} height={32} /> : null}
        {step > 0 ? (
          <button type="button" className={styles.stBack} onClick={actions.startBack}>
            ‹ もどる
          </button>
        ) : null}
        <span className={`${styles.stCount} ${styles.num}`} aria-hidden="true">
          {step + 1} / 2
        </span>
        <div className={styles.stDots} role="img" aria-label={`2 つのうち ${step + 1} つ目`}>
          {[0, 1].map((i) => (
            <i key={i} className={i <= step ? styles.on : undefined} />
          ))}
        </div>
      </div>
      <div className={step === 1 ? `${styles.stMain} ${styles.stMainScroll}` : styles.stMain}>
        <h2 className={styles.stH} ref={heading} tabIndex={-1}>
          {TITLES[step]}
        </h2>
        {step === 0 ? (
          <>
            <section className={`${styles.hero} ${styles.stHero}`} aria-label="選んでいる推しの絵">
              <div className={styles.heroArt}>
                <WholeArt
                  src={o.art.imgs?.[0] ?? o.art.img ?? o.circle.src}
                  alt={`${o.name}の絵`}
                  a={o}
                />
              </div>
              <p className={styles.heroWho}>
                <span className={styles.nw}>{o.name}</span>
              </p>
            </section>
            <div className={styles.stArts} role="group" aria-label="推し">
              {ARTIST_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={styles.stArt}
                  aria-pressed={id === s.oshiId}
                  aria-label={ARTISTS_VIEW[id].name}
                  onClick={() => actions.startPick('oshi', id)}
                >
                  <Av a={ARTISTS_VIEW[id]} />
                  <span className={styles.stArtCk} aria-hidden="true">
                    ✓
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : null}
        {step === 1 ? (
          <>
            <p className={styles.stVenue}>
              会場: {c.venue.name}（{c.venue.cap}
              {c.venue.unit}）<br />
              熱量が満ちると、開催が決まります
            </p>
            <p className={styles.rcNote}>
              最初に選べるのは、{PLAN_NAMES[ENTRY_PLAN]}
              です。上のプランは、参加のあとに上げられます。
            </p>
            <ul className={styles.planList} aria-label="プラン">
              {PLAN_ORDER.map((id) => {
                const k = courseOf(c, id);
                const open = id === ENTRY_PLAN;
                const r = rewardOf(id);
                return (
                  <li
                    key={id}
                    className={styles.planItem}
                    data-plan={id}
                    data-selected={open ? 'true' : undefined}
                    data-locked={open ? undefined : 'true'}
                    aria-disabled={open ? undefined : 'true'}
                  >
                    <p className={styles.planName}>
                      {open ? null : <LockIcon className={styles.planLockIcon} />}
                      {PLAN_NAMES[id]}
                      {open ? '（✓ 選択中）' : ''}
                      {open ? null : <span className={styles.srOnly}>（ロック中）</span>}
                    </p>
                    <dl className={styles.planFacts}>
                      <dt>確保する額</dt>
                      <dd className={styles.num}>{yen(k.price)}</dd>
                      {r ? (
                        <>
                          <dt>特典</dt>
                          <dd>{r.label}</dd>
                        </>
                      ) : null}
                    </dl>
                    {open ? null : <p className={styles.planLock}>参加のあとに、上げられます</p>}
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
      </div>
      <div className={styles.stFoot}>
        {step === 1 ? (
          <p className={styles.stSel}>
            <Wbr
              parts={['押すと、参加の確認が出ます。', 'デモのため、', '実際の決済は行われません。']}
            />
          </p>
        ) : null}
        <button
          type="button"
          className={`${styles.btn} ${styles.btnFull}`}
          onClick={actions.startNext}
        >
          {step < 1 ? '次へ' : `${PLAN_NAMES[ENTRY_PLAN]}で参加する`}
        </button>
      </div>
    </div>
  );
}
