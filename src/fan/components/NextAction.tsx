// 次のアクション（SP-42）。頭の枠（残り必要なもの）→ いまできる行動の一覧 → 済んだこと。押すと、その場で完了する。
import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { ACT_NAMES } from '../text/ui';
import { nextViewOf } from '../domain/view';
import type { NextRow } from '../domain/view';
import styles from '../fan.module.css';
import { useFan } from '../store/FanProvider';
import { DetailPage } from './Frame';
import { Rich } from './text';

export function NextAction() {
  const { state, view, actions } = useFan();
  const next = nextViewOf(view);
  const fresh = state.fresh;
  const delay = { '--ck-delay': `${state.ckDelay}s` } as CSSProperties;
  const first = useRef<HTMLButtonElement>(null);
  const head = useRef<HTMLDivElement>(null);
  // 押した行は消えることがあるので、フォーカスは一覧の先頭へ
  const nonce = fresh?.from === 'next' ? fresh.nonce : null;
  useEffect(() => {
    if (nonce === null) return;
    (first.current ?? head.current)?.focus({ preventScroll: true });
  }, [nonce]);
  // 条件がそろったエフェクトを押して飛ばしたとき（nonce が変わる）、待たせていたポップの動きを頭から始め直す。
  // 先頭の行（「申し込む」）は作り直さない。押した瞬間（pointerdown）に入れ替わると、離したとき（pointerup）に
  // 押した先の要素が無く、マウスのクリックが届かない（C-04）。作り直す代わりに、動きだけ巻き戻す
  const popNonce = fresh?.all ? fresh.nonce : 0;
  useEffect(() => {
    first.current?.getAnimations?.().forEach((animation) => {
      if (animation instanceof CSSAnimation) {
        animation.cancel();
        animation.play();
      }
    });
  }, [popNonce]);

  const run = (row: NextRow): void => {
    if (row.id === 'apply' && view.target) actions.applyCourse(view.target.id);
    else if (row.id === 'main' || row.id === 'deposit' || row.id === 'teiki')
      actions.runAcct(row.id, 'next');
    else if (row.id === 'friend') actions.callFriends();
    else if (row.id === 'notice') actions.notifyFriends();
    else actions.openShare(row.id === 'share' ? 'share' : 'friend');
  };
  const doneIds = (
    view.joined ? (['friend', 'share'] as const) : (['deposit', 'teiki', 'main'] as const)
  ).filter((k) => view.fan.done[k]);
  const h = next.head;
  return (
    <DetailPage title="次のアクション">
      <div className={`${styles.card} ${styles.cardNext}`} ref={head} tabIndex={-1}>
        {h.kind === 'pre' ? (
          <>
            <p className={styles.nxK}>
              {h.course.name}（{h.course.price.toLocaleString('ja-JP')}円）{h.ok ? '' : 'まで'}
            </p>
            {h.ok ? (
              <p
                className={`${styles.nxMet} ${fresh?.all ? styles.fresh : ''}`}
                key={`met-${fresh?.nonce ?? 0}`}
                style={delay}
              >
                <span className={styles.metI} aria-hidden="true">
                  ✓
                </span>
                <span>
                  <span className={styles.metA}>条件がそろいました。</span>
                  <span className={styles.metB}>{h.course.name}に申し込めます</span>
                </span>
              </p>
            ) : null}
            <ul className={styles.ck} aria-label="条件" key={`ck-${fresh?.nonce ?? 0}`}>
              {h.items.map((it) => (
                <li
                  key={it.id}
                  className={[it.ok ? styles.ok : '', fresh?.ids.includes(it.id) ? styles.got : '']
                    .filter(Boolean)
                    .join(' ')}
                  style={delay}
                >
                  <span className={styles.ckB} aria-hidden="true">
                    {it.ok ? '✓' : ''}
                  </span>
                  <span>
                    {it.text}
                    <span className={styles.srOnly}>{it.ok ? '（達成）' : '（まだ）'}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : h.kind === 'est' ? (
          <>
            <p className={`${styles.nxV} ${styles.nxVsm}`}>ライブの開催が決まりました</p>
            <p className={styles.nxSub}>仲間に、開催が決まったことを知らせましょう</p>
          </>
        ) : (
          <>
            <p className={styles.nxK}>開催熱量</p>
            <p className={`${styles.nxV} ${styles.nxVsm}`}>{h.heat.name}</p>
            <p className={styles.nxSub}>{h.heat.distance}</p>
            <div className={styles.barH} role="img" aria-label={`開催熱量。${h.heat.name}`}>
              <i style={{ '--g': Math.max(h.heat.fill, 0.02) } as CSSProperties} />
            </div>
          </>
        )}
      </div>
      <div className={styles.card}>
        <p className={styles.bigK}>いまできること</p>
        <div className={styles.nxList}>
          {next.rows.map((row, i) => (
            <button
              key={row.id}
              ref={i === 0 ? first : undefined}
              type="button"
              className={[
                styles.nxRow,
                i === 0 ? styles.nxFirst : '',
                i === 0 && fresh?.all ? styles.rowPop : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={delay}
              onClick={() => run(row)}
            >
              <b>{row.label}</b>
              <small>
                <Rich segs={row.why} />
              </small>
            </button>
          ))}
        </div>
        <p className={styles.dNote}>
          {view.joined
            ? '押すと、その場で進みます。SNS への投稿は、ホームの「SNSに投稿する（任意）」からできます。'
            : '押すと、その場で完了します。擬似の動きで、実際の入出金は始まりません。'}
        </p>
      </div>
      {doneIds.length ? (
        <div className={styles.card}>
          <p className={styles.bigK}>済んだこと</p>
          <ul className={styles.acts}>
            {doneIds.map((k) => (
              <li key={k} className={styles.on}>
                {ACT_NAMES[k]}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </DetailPage>
  );
}
