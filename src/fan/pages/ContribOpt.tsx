// 貢献（SP-45）と、推し・条件の変更（SP-49。デモ用の操作）。メニュー配下の画面（あとから読む側）。
import { CITY_NAMES, ARTIST_IDS, areaFor, canApply, conditionOf } from '../../core';
import { ARTISTS_VIEW, artistView } from '../art/registry';
import { useLinkedOffice } from '../../shared/link';
import { Av, GiftArt } from '../components/Art';
import { ACT_IDS } from '../domain/state';
import { courseOf, nextViewOf, restText, slotsText } from '../domain/view';
import { THANKS } from '../text/thanks';
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
          <dt>呼んだ仲間の数</dt>
          <dd>{state.called}人</dd>
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
        <p className={fan.bigK}>全体の達成率と、成立までの不足</p>
        <p className={`${styles.aonBig} ${fan.num}`} style={{ marginTop: 'var(--s1)' }}>
          達成率 <b>{status.pct}%</b>
        </p>
        <div className={fan.barH} role="img" aria-label={`達成率 ${status.pct}%`}>
          <i style={{ width: `${status.fill.toFixed(1)}%` }} />
        </div>
        <dl className={styles.facts} style={{ marginTop: 'var(--s2)' }}>
          <dt>支援者</dt>
          <dd>
            {status.supporters}人／最低人数 {cond.min}人
          </dd>
          <dt>ライブ開催まで</dt>
          <dd>
            {status.established
              ? 'ライブの開催が決まりました'
              : status.gathered
                ? '人数は集まりました。あと少しの支援で、開催が決まります'
                : `あと${status.left}人`}
          </dd>
        </dl>
        <p className={styles.dSub}>
          達成率は、支援者 ÷ 最低人数（切り捨て）です。上位のコースに申し込んでも、人数は 1
          人ぶんです。成立には、支援の合計が目標の金額に届くことも要ります。
        </p>
      </div>
      <div className={fan.card}>
        <p className={fan.bigK}>周りの貢献</p>
        <table className={styles.area} style={{ marginTop: 'var(--s1)' }}>
          <thead className={fan.srOnly}>
            <tr>
              <th scope="col">市</th>
              <th scope="col">人数</th>
              <th scope="col">割合</th>
            </tr>
          </thead>
          <tbody>
            {cities.map((x) => (
              <tr key={x.name} className={x.isHome ? styles.me : undefined}>
                <td>
                  {x.name}
                  {x.isHome ? <span className={styles.meTag}>地元</span> : null}
                </td>
                <td className={fan.num} style={{ textAlign: 'right', fontWeight: 700 }}>
                  {x.n}人
                </td>
                <td style={{ width: '38%' }}>
                  <span className={styles.areaBar} style={{ width: `${(x.n / max) * 100}%` }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={styles.plain}>
          {state.called === 0
            ? '仲間はまだ呼んでいません'
            : `仲間を${state.called}人呼びました` +
              (state.friends < state.called
                ? '（引き継いだ記録です。新しい条件の人数には入っていません）'
                : '（申し込み済み）')}
        </p>
      </div>
      {k === 3 ? (
        <div className={fan.card}>
          <p className={fan.bigK}>推しからの感謝のメッセージ</p>
          <p className={styles.thanksBox}>{THANKS[state.oshiId].join('')}</p>
        </div>
      ) : null}
    </>
  );
}

/** 推し・条件の変更（デモ用の操作）。変えると、引き継ぎのシートが開く。 */
export function OptPage() {
  const { state, view, actions } = useFan();
  const office = useLinkedOffice();
  const pend = state.pend ?? { oshiId: state.oshiId, city: state.city, seat: state.seat };
  const pc = actions.pendCond();
  const { deposit, pay } = state.acct;
  const locked = pc.courses.filter((k) => !canApply(k, deposit, pay));
  const changed =
    pend.oshiId !== state.oshiId || pend.city !== view.cond.city || pend.seat !== state.seat;
  const nk = courseOf(pc, pend.seat);
  const held = view.my?.price ?? 0;
  const diff: string[] = [];
  if (pend.oshiId !== state.oshiId)
    diff.push(`推し ${artistView(state.oshiId).name} → ${artistView(pend.oshiId).name}`);
  if (pend.city !== view.cond.city)
    diff.push(`市・会場 ${view.cond.city} → ${pend.city}（${pc.venue.name}）`);
  if (pend.seat !== state.seat) diff.push(`希望のコース → ${nk.name}（${yen(nk.price)}）`);
  const syncVenue =
    office && state.custom && office.selection.venueId !== view.cond.venueId
      ? conditionOf(office.selection.venueId)
      : null;
  return (
    <>
      <div className={fan.card}>
        <p className={`${styles.demoLine} ${styles.solo}`}>
          <span className={styles.demoChip}>デモ用の操作</span>
          推し・市・コース（支払額）の変更は、デモ用です。実際は、決済が通った時点で確定します
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
        <p className={fan.bigK} id="fan-op-city-h">
          希望の市
        </p>
        <div className={styles.cityPick} role="group" aria-labelledby="fan-op-city-h">
          {CITY_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              className={styles.chip}
              aria-pressed={name === pend.city}
              onClick={() => actions.pickPend('city', name)}
            >
              {name}
            </button>
          ))}
        </div>
        <p className={styles.dSub}>
          {pend.city}の会場: {pc.venue.name}（{pc.venue.cap}
          {pc.venue.unit}）／ {pc.venue.day}（架空）／ 到達ライン {yen(pc.line)}（{pc.need}人 ×{' '}
          {yen(pc.price)}）／ 成立は、到達ライン以上、かつ、最低人数 {pc.min}人以上
        </p>
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
                特典 {view.giftCount}/3・達成 {view.doneCount}/{ACT_IDS.length}・呼んだ仲間{' '}
                {state.called}人
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
        {syncVenue ? (
          <button
            type="button"
            className={`${fan.btn} ${fan.btnText} ${fan.btnSm} ${fan.btnFull}`}
            onClick={() =>
              actions.applyChange({
                oshiId: state.oshiId,
                venueId: syncVenue.venueId,
                seat: 'normal',
              })
            }
          >
            事務所向けで選んだ条件に合わせる（{syncVenue.city}・{syncVenue.venue.name}）
          </button>
        ) : null}
      </div>
    </>
  );
}
