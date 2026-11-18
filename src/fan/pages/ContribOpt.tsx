// 貢献（SP-45）と、推し・条件の変更（SP-49。デモ用の操作）。メニュー配下の画面（あとから読む側）。
import type { CSSProperties } from 'react';
import { ARTIST_IDS, areaFor } from '../../core';
import { ARTISTS_VIEW, artistView } from '../art/registry';
import { Av } from '../components/Art';
import {
  ENTRY_PLAN,
  PLAN_NAMES,
  PLAN_ORDER,
  SHOWN_ACTS,
  planRank,
  rewardOf,
  shownDoneOf,
} from '../domain/plan';
import { courseOf, nextViewOf } from '../domain/view';
import { thanksOf } from '../text/thanks';
import { ACT_NAMES } from '../text/ui';
import { yen } from '../text/format';
import fan from '../fan.module.css';
import { useFan } from '../store/FanProvider';
import styles from './pages.module.css';

/** 貢献。自分・特典・全体・周り・感謝・次のアクション。 */
export function ContribPage() {
  const { state, view, actions } = useFan();
  const { cond, status } = view;
  const done = shownDoneOf(state.done);
  const rewards = PLAN_ORDER.map(rewardOf).filter((r) => r !== null);
  const got = (plan: (typeof PLAN_ORDER)[number]): boolean =>
    state.course !== null && planRank(plan) <= planRank(state.course);
  const rows = areaFor(cond.start, cond.city, status.supporters - cond.start);
  const cities = rows[0]?.cities ?? [];
  const max = Math.max(1, ...cities.map((x) => x.n));
  return (
    <>
      <div className={`${fan.card} ${fan.cardNext}`}>
        <p className={fan.bigK}>次のアクション</p>
        <p className={styles.bigV}>{nextViewOf(view).hint}</p>
        <button
          type="button"
          className={`${fan.btn} ${fan.btnFull}`}
          style={{ marginTop: 'var(--s3)' }}
          onClick={() => actions.go('next')}
        >
          次のアクション ›
        </button>
      </div>
      <div className={fan.card}>
        <p className={fan.bigK}>自分の貢献</p>
        <dl className={styles.facts} style={{ marginTop: 'var(--s2)' }}>
          <dt>確保額</dt>
          <dd>
            {view.my
              ? `${yen(view.my.price)}（${PLAN_NAMES[view.my.id]}。成立するまで確保）`
              : '0円（まだ参加していません）'}
          </dd>
          <dt>達成した行動</dt>
          <dd>
            {done.length} / {SHOWN_ACTS.length}
          </dd>
        </dl>
        <ul className={fan.acts} aria-label="達成した行動">
          {SHOWN_ACTS.map((id) => (
            <li key={id} className={state.done[id] ? fan.on : undefined}>
              {ACT_NAMES[id]}
            </li>
          ))}
        </ul>
      </div>
      <div className={fan.card}>
        <p className={fan.bigK}>推しからの特典</p>
        <p className={styles.dSub}>プランを上げると、推しから特典が届きます。</p>
        <ul className={fan.acts} aria-label="プランごとの特典">
          {rewards.map((r) => (
            <li key={r.plan} className={got(r.plan) ? fan.on : undefined} data-reward-row={r.plan}>
              {PLAN_NAMES[r.plan]}: {r.label}
              <span className={fan.srOnly}>{got(r.plan) ? '（受け取りました）' : '（まだ）'}</span>
            </li>
          ))}
        </ul>
        {state.course !== null && rewardOf(state.course) ? (
          <button
            type="button"
            className={`${fan.btn} ${fan.btnSecondary} ${fan.btnFull}`}
            style={{ marginTop: 'var(--s3)' }}
            onClick={actions.showReward}
          >
            いまのプランの特典を見る
          </button>
        ) : null}
      </div>
      <div className={fan.card}>
        <p className={fan.bigK}>みんなの開催熱量</p>
        <p className={styles.aonBig} style={{ marginTop: 'var(--s1)' }}>
          開催熱量 <b>{view.heat.name}</b>
        </p>
        <div className={fan.barH} role="img" aria-label={`開催熱量。${view.heat.name}`}>
          <i style={{ '--g': Math.max(view.heat.fill, 0.02) } as CSSProperties} />
        </div>
        <dl className={styles.facts} style={{ marginTop: 'var(--s2)' }}>
          <dt>ライブ開催まで</dt>
          <dd>{view.heat.distance}</dd>
        </dl>
        <p className={styles.dSub}>
          熱量は、みんなの参加で高まります。上のプランに上げても、高まり方は同じです。開催が決まると、FEVER
          になります。
        </p>
      </div>
      <div className={fan.card}>
        <p className={fan.bigK}>周りの貢献</p>
        <table className={styles.area} style={{ marginTop: 'var(--s1)' }}>
          <thead className={fan.srOnly}>
            <tr>
              <th scope="col">市</th>
              <th scope="col">広がり</th>
            </tr>
          </thead>
          <tbody>
            {cities.map((x) => (
              <tr key={x.name} className={x.isHome ? styles.me : undefined}>
                <td>
                  {x.name}
                  {x.isHome ? <span className={styles.meTag}>地元</span> : null}
                </td>
                <td style={{ width: '55%' }}>
                  <span className={styles.areaBar} style={{ width: `${(x.n / max) * 100}%` }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {state.course === 'top' ? (
        <div className={fan.card}>
          <p className={fan.bigK}>推しからの感謝のメッセージ</p>
          <p className={styles.thanksBox}>{thanksOf(state.oshiId, cond.city).join('')}</p>
        </div>
      ) : null}
    </>
  );
}

/** 推し・条件の変更（デモ用の操作）。変えると、引き継ぎのシートが開く。 */
export function OptPage() {
  const { state, view, actions } = useFan();
  const pend = state.pend ?? { oshiId: state.oshiId, seat: state.seat };
  const pc = actions.pendCond();
  const changed = pend.oshiId !== state.oshiId;
  const nk = courseOf(pc, ENTRY_PLAN);
  const held = view.my?.price ?? 0;
  const done = shownDoneOf(state.done);
  return (
    <>
      <div className={fan.card}>
        <p className={`${styles.demoLine} ${styles.solo}`}>
          <span className={styles.demoChip}>デモ用の操作</span>
          推しの変更は、デモ用です。実際は、決済が通った時点で確定します
        </p>
      </div>
      <div className={fan.card}>
        <p className={fan.bigK} id="fan-op-oshi-h">
          推し
        </p>
        <div className={styles.oshiPick} role="group" aria-labelledby="fan-op-oshi-h">
          {ARTIST_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={styles.apill}
              aria-pressed={id === pend.oshiId}
              onClick={() => actions.pickPend('oshi', id)}
            >
              <Av a={ARTISTS_VIEW[id]} />
              {ARTISTS_VIEW[id].name}
            </button>
          ))}
        </div>
      </div>
      <div className={`${fan.card} ${fan.cardNext}`}>
        <p className={fan.bigK}>変えると</p>
        <dl
          className={`${styles.facts} ${styles.factsV}`}
          style={{ margin: 'var(--s2) 0 var(--s3)' }}
        >
          {changed ? (
            <>
              <dt>変わるもの</dt>
              <dd>
                推し {artistView(state.oshiId).name} → {artistView(pend.oshiId).name}
              </dd>
              <dt>取り直すもの</dt>
              <dd>
                確保額 {yen(held)} → 0円（{PLAN_NAMES[ENTRY_PLAN]}
                で参加し直すと、{yen(nk.price)}で取り直します）
              </dd>
              <dt>残るもの</dt>
              <dd>
                達成した行動 {done.length}/{SHOWN_ACTS.length}・預金と推し活定期（擬似）
              </dd>
            </>
          ) : (
            <>
              <dt>変わるもの</dt>
              <dd>まだ変えていません</dd>
            </>
          )}
        </dl>
        <button
          type="button"
          className={`${fan.btn} ${fan.btnFull}`}
          disabled={!changed}
          onClick={() => actions.applyChange()}
        >
          この条件に変える（デモ用）
        </button>
      </div>
    </>
  );
}
