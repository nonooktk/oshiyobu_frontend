// 貢献（SP-45）と、推し・条件の変更（SP-49。デモ用の操作）。メニュー配下の画面（あとから読む側）。
import type { CSSProperties } from 'react';
import { ARTIST_IDS, areaFor, canApply } from '../../core';
import { ARTISTS_VIEW, artistView } from '../art/registry';
import { Av, GiftArt } from '../components/Art';
import { ACT_IDS } from '../domain/state';
import { courseOf, nextViewOf, restText, slotsText } from '../domain/view';
import { thanksOf } from '../text/thanks';
import { ACT_NAMES, GIFT_LABELS } from '../text/ui';
import { yen } from '../text/format';
import fan from '../fan.module.css';
import { useFan } from '../store/FanProvider';
import styles from './pages.module.css';

const LOCK = (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

/** 貢献。自分・特典・全体・周り・感謝・次のアクション。 */
export function ContribPage() {
  const { state, view, actions } = useFan();
  const { cond, status } = view;
  const o = artistView(state.oshiId);
  const k = view.giftCount;
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
              ? `${yen(view.my.price)}（${view.my.name}。成立するまで確保）`
              : '0円（まだ申し込んでいません）'}
          </dd>
          <dt>仲間を呼んだか</dt>
          <dd>{state.called > 0 ? '呼びました' : 'まだです'}</dd>
          <dt>達成した行動</dt>
          <dd>
            {view.doneCount} / {ACT_IDS.length}
          </dd>
        </dl>
        <ul className={fan.acts} aria-label="達成した行動">
          {ACT_IDS.map((id) => (
            <li key={id} className={state.done[id] ? fan.on : undefined}>
              {ACT_NAMES[id]}
            </li>
          ))}
        </ul>
      </div>
      <div className={fan.card}>
        <p className={fan.bigK}>推しからの特典</p>
        <div style={{ marginTop: 'var(--s2)' }}>
          {k === 0 ? (
            <div className={styles.art32}>
              <div className={styles.locked}>
                <GiftArt a={o} idx={0} ratio={1.5} alt="" />
              </div>
              <div className={styles.lockOv}>
                {LOCK}
                <span>
                  特典の絵は、まだ閉じています
                  <br />
                  申し込むと 1/3 が開きます
                </span>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={styles.artBtn}
              aria-label={`特典の絵をもう一度見る（${k}/3）`}
              onClick={() => actions.showGift(true)}
            >
              <div className={styles.art32}>
                <GiftArt a={o} idx={k - 1} ratio={1.5} alt={`${o.name}の特典の絵 ${k}/3`} />
              </div>
            </button>
          )}
          <p className={styles.artCap}>
            <b>特典 {k}/3</b>
            <span>{k === 3 ? '全体が開きました' : k === 0 ? '' : '押すと、大きく見られます'}</span>
          </p>
          <ul className={fan.acts} aria-label="特典を開く行動">
            {GIFT_LABELS.map((label, i) => (
              <li key={label} className={state.gifts[i] ? fan.on : undefined}>
                {label}
              </li>
            ))}
          </ul>
        </div>
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
          熱量は、みんなの申し込みで高まります。上位のコースに申し込んでも、高まり方は同じです。開催が決まると、FEVER
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
        <p className={styles.plain}>
          {state.called === 0
            ? '仲間はまだ呼んでいません'
            : '仲間を呼びました' +
              (state.friends < state.called
                ? '（引き継いだ記録です。新しい条件の熱量には入っていません）'
                : '（申し込み済み）')}
        </p>
      </div>
      {k === 3 ? (
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
  const { deposit, pay } = state.acct;
  const locked = pc.courses.filter((k) => !canApply(k, deposit, pay));
  const changed = pend.oshiId !== state.oshiId || pend.seat !== state.seat;
  const nk = courseOf(pc, pend.seat);
  const held = view.my?.price ?? 0;
  const diff: string[] = [];
  if (pend.oshiId !== state.oshiId)
    diff.push(`推し ${artistView(state.oshiId).name} → ${artistView(pend.oshiId).name}`);
  if (pend.seat !== state.seat) diff.push(`希望のコース → ${nk.name}（${yen(nk.price)}）`);
  return (
    <>
      <div className={fan.card}>
        <p className={`${styles.demoLine} ${styles.solo}`}>
          <span className={styles.demoChip}>デモ用の操作</span>
          推し・コース（支払額）の変更は、デモ用です。実際は、決済が通った時点で確定します
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
      <div className={fan.card}>
        <p className={fan.bigK} id="fan-op-seat-h">
          希望のコース
        </p>
        <div className={styles.seatPick} role="group" aria-labelledby="fan-op-seat-h">
          {pc.courses.map((k) => (
            <button
              key={k.id}
              type="button"
              className={styles.seatOpt}
              aria-pressed={pend.seat === k.id}
              disabled={!canApply(k, deposit, pay)}
              onClick={() => actions.pickPend('seat', k.id)}
            >
              <span>
                {k.name}
                <small>{slotsText(k, pc, false)}</small>
              </span>
              <span className={`${fan.num} ${styles.p}`}>{k.price.toLocaleString('ja-JP')}円</span>
            </button>
          ))}
        </div>
        <p className={styles.dSub}>
          {locked.length
            ? `選べないコース: ${locked.map((k) => `${k.name}（${restText(k, deposit, pay)}が必要）`).join('、')}。「口座と預金」から進められます`
            : '4 つのコースを選べます（条件がそろっています）'}
        </p>
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
              <dd>{diff.join('、')}</dd>
              <dt>取り直すもの</dt>
              <dd>
                確保額 {yen(held)} → 0円（申し込み直すと、新しい条件の{yen(nk.price)}
                で取り直します）
              </dd>
              <dt>残るもの</dt>
              <dd>
                特典 {view.giftCount}/3・達成 {view.doneCount}/{ACT_IDS.length}・仲間を呼んだか{' '}
                {state.called > 0 ? 'はい' : 'いいえ'}
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
