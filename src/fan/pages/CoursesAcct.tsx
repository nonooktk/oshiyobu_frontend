// 応援コース（SP-43）と、口座と預金（SP-44）。メニュー配下の画面（あとから読む側）。
import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import { TEIKI, achievementPct, canApply, nextDepositTarget } from '../../core';
import { artistView } from '../art/registry';
import { CourseFace } from '../components/CourseFace';
import type { AcctId } from '../domain/state';
import { nextLocked, opensText, restText } from '../domain/view';
import { manYen, yen } from '../text/format';
import { MyState, PayNote } from '../text/pay';
import fan from '../fan.module.css';
import { useFan } from '../store/FanProvider';
import styles from './pages.module.css';

/** 応援コース。4 枚のカードが、金額・手に入るもの・枠・条件・自分の状態つきで並ぶ。 */
export function CoursesPage() {
  const { state, view, actions } = useFan();
  const { cond, status } = view;
  const o = artistView(state.oshiId);
  const { deposit, pay } = state.acct;
  const nextN = status.supporters + (view.joined ? 0 : 1);
  return (
    <>
      <div className={`${fan.card} ${fan.cardNext}`}>
        <p className={fan.bigK}>いまの申し込み</p>
        {view.my ? (
          <>
            <p className={styles.bigV}>
              {view.my.name}（確保 {yen(view.my.price)}）
            </p>
            <p className={styles.dSub}>
              申し込み済みです。やめるときは、メニューのいちばん下から。
            </p>
            <p className={styles.demoLine}>
              <span className={styles.demoChip}>デモ用の操作</span>
              下の「このコースに変える」は、デモ用です。実際は、決済が通った時点で確定します
            </p>
          </>
        ) : (
          <>
            <p className={styles.bigV}>まだ申し込んでいません</p>
            <p className={styles.dSub}>
              条件がそろったコースで「申し込む」と、支援者として数えます（どのコースでも 1
              人。支援者{' '}
              <span className={fan.nw}>
                {status.supporters}人 → {nextN}人
              </span>
              、達成率{' '}
              <span className={fan.nw}>
                {status.pct}% → {achievementPct(nextN, cond.min)}%
              </span>
              ）。
            </p>
            {view.target ? (
              <p className={styles.dSub}>
                目指すコース: <b>{view.target.name}</b>
              </p>
            ) : null}
          </>
        )}
        <p className={styles.dSub}>
          <MyState deposit={deposit} pay={pay} />
        </p>
        <p className={styles.dSub}>
          <PayNote />
        </p>
      </div>
      <div className={styles.stack}>
        {cond.courses.map((k) => {
          const mine = state.course === k.id;
          const ok = canApply(k, deposit, pay);
          const demoChange = view.joined && !mine && ok;
          const isAim = view.target?.id === k.id;
          return (
            <div
              key={k.id}
              className={mine ? `${fan.rcard} ${fan.sel}` : fan.rcard}
              id={`course-${k.id}`}
            >
              <CourseFace
                k={k}
                cond={cond}
                a={o}
                deposit={deposit}
                pay={pay}
                mine={mine}
                mark={isAim && !mine ? '目指すコース' : ''}
              />
              <div className={styles.rcAct}>
                {mine ? (
                  <p>
                    申し込み済みです。<span className={fan.nw}>{yen(k.price)}</span>
                    は、成立まで口座の中で確保されています。
                  </p>
                ) : null}
                {demoChange ? (
                  <p>
                    変えると、確保は <span className={fan.nw}>{yen(k.price)}</span>になります。
                  </p>
                ) : null}
                {!view.joined && !ok ? (
                  <div className={styles.enter}>
                    <button
                      type="button"
                      className={`${fan.btn} ${fan.btnSecondary} ${fan.btnSm}`}
                      onClick={() => actions.go('acct')}
                    >
                      口座と預金へ
                    </button>
                  </div>
                ) : null}
                {demoChange ? (
                  <p className={`${styles.demoLine} ${styles.solo}`}>
                    <span className={styles.demoChip}>デモ用の操作</span>
                    実際は、決済が通った時点で確定します
                  </p>
                ) : null}
                {mine ? (
                  <button type="button" className={`${fan.btn} ${fan.btnFull}`} disabled>
                    このコースで申し込み中
                  </button>
                ) : ok ? (
                  <button
                    type="button"
                    className={`${fan.btn} ${fan.btnFull}`}
                    onClick={() => actions.applyCourse(k.id)}
                  >
                    {view.joined ? 'このコースに変える（デモ用）' : '申し込む'}
                  </button>
                ) : view.joined ? (
                  <button type="button" className={`${fan.btn} ${fan.btnFull}`} disabled>
                    条件がそろうと申し込めます
                  </button>
                ) : isAim ? (
                  <button type="button" className={`${fan.btn} ${fan.btnFull}`} disabled>
                    目指すコースにしています
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`${fan.btn} ${fan.btnSecondary} ${fan.btnFull}`}
                    onClick={() => actions.aimCourse(k.id)}
                  >
                    目指すコースにする
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className={fan.dNote}>擬似の動きです。実際のお申し込み・入出金は始まりません</p>
    </>
  );
}

const ACCT_DEF: Record<AcctId, { title?: string; btn: string; desc: string; tag?: string }> = {
  main: {
    title: 'メイン口座にする',
    btn: 'メイン口座にする',
    desc: '推し活の支払いに、この口座を使います。前方の席・特別コース・最上位コースの条件の 1 つです。',
  },
  deposit: { btn: '預金を積み増す', desc: '預金が増えると、各コースの預金の条件がそろいます。' },
  teiki: {
    title: '推し活定期をはじめる',
    btn: '推し活定期をはじめる',
    desc: '毎月の積立で、推し活の資金をためていきます。預金が増えます。',
    tag: '口座をお持ちでない方の入口',
  },
};

/** 口座と預金。3 つの行動。押す前に、すると何が開く・何が進むかを数字で出す。 */
export function AcctPage() {
  const { state, view, actions } = useFan();
  const { cond } = view;
  const { deposit: d, pay: p } = state.acct;
  const open = cond.courses.filter((k) => canApply(k, d, p));
  const nx = nextLocked(cond, d, p);
  const to = nextDepositTarget(d);
  const fresh = state.fresh;
  const delay = { '--ck-delay': `${state.ckDelay}s` } as CSSProperties;

  // 押したカードの見出しにフォーカスを置く（画面は動かない）
  const nonce = fresh?.from === 'acct' ? fresh.nonce : null;
  const freshAct = fresh?.act ?? null;
  useEffect(() => {
    if (nonce === null || freshAct === null) return;
    document.getElementById(`fan-ac-${freshAct}-h`)?.focus({ preventScroll: true });
  }, [nonce, freshAct]);

  // 目盛りは 4 コースの預金。間隔をそろえて、区間ごとに直線でつなぐ（0〜2万円が 0〜20%）
  const ths = [0, ...cond.courses.map((k) => k.deposit)];
  const POS = [0, 20, 45, 70, 100];
  const SHORT = ['通常', '前方', '特別', '最上位'];
  const pos = (x: number): number => {
    for (let i = 1; i < ths.length; i++) {
      const lo = ths[i - 1] ?? 0;
      const hi = ths[i] ?? 1;
      if (x <= hi)
        return (POS[i - 1] ?? 0) + (((POS[i] ?? 100) - (POS[i - 1] ?? 0)) * (x - lo)) / (hi - lo);
    }
    return 100;
  };
  const acctDone = (id: AcctId): boolean => actions.acctDone(id);
  const primary = (['main', 'deposit', 'teiki'] as const).find((id) =>
    id === 'deposit' ? !state.done.deposit : !acctDone(id),
  );
  const rowsOf = (id: AcctId): [string, string][] => {
    if (id === 'main')
      return [
        ['メイン口座', 'いいえ → はい'],
        ['開くコース', opensText(cond, d, d, p, true)],
      ];
    if (id === 'deposit') {
      const t = to ?? d;
      return [
        ['預金', `${yen(d)} → ${yen(t)}`],
        ['開くコース', opensText(cond, d, t, p, p)],
      ];
    }
    return [
      [
        '毎月の積立',
        `毎月${yen(TEIKI.monthlyYen)}、${TEIKI.months}か月で${yen(TEIKI.monthlyYen * TEIKI.months)}`,
      ],
      ['預金（最初の積立）', `${yen(d)} → ${yen(d + TEIKI.monthlyYen)}`],
      ['開くコース', opensText(cond, d, d + TEIKI.monthlyYen, p, p)],
    ];
  };
  return (
    <>
      <div className={fan.card}>
        <p className={fan.bigK}>いまの預金（仮）</p>
        <p className={`${styles.bigV} ${fan.num}`}>{yen(d)}</p>
        <div
          className={styles.gauge}
          role="img"
          aria-label={
            `預金 ${yen(d)}。` +
            cond.courses
              .map(
                (k) => `${k.name}は預金${yen(k.deposit)}以上${k.mainAccount ? 'とメイン口座' : ''}`,
              )
              .join('、')
          }
        >
          <div className={styles.track}>
            <i style={{ width: `${pos(d).toFixed(1)}%` }} />
          </div>
          {cond.courses.map((k, i) => (
            <span
              key={k.id}
              className={i === 3 ? `${styles.tick} ${styles.tickEnd}` : styles.tick}
              style={{ left: `${POS[i + 1]}%` }}
            >
              <span>
                {SHORT[i]}
                <br />
                {manYen(k.deposit)}
              </span>
            </span>
          ))}
        </div>
        <dl className={styles.facts} style={{ marginTop: 'var(--s2)' }}>
          <dt>メイン口座</dt>
          <dd>{p ? 'はい' : 'いいえ'}</dd>
          <dt>申し込めるコース</dt>
          <dd>{open.length ? open.map((k) => k.name).join('・') : 'なし'}</dd>
          <dt>次に開くコース</dt>
          <dd>{nx ? `${nx.name}（残りは ${restText(nx, d, p)}）` : 'すべて開いています'}</dd>
        </dl>
      </div>
      <div className={styles.stack}>
        {(['main', 'deposit', 'teiki'] as const).map((id) => {
          const def = ACCT_DEF[id];
          const done = acctDone(id);
          const once = id === 'deposit' && !!state.done.deposit && !done;
          const title =
            id === 'deposit'
              ? to
                ? `預金を積み増す（+${yen(to - d)}）`
                : '預金を積み増す'
              : (def.title ?? '');
          const got = fresh?.act === id;
          return (
            <div key={id} className={fan.card} id={`ac-${id}`}>
              {def.tag ? <span className={styles.actTag}>{def.tag}</span> : null}
              <h3 className={styles.actH} id={`fan-ac-${id}-h`} tabIndex={-1}>
                {title}
              </h3>
              <p className={styles.actD}>
                {def.desc}
                {id === 'teiki'
                  ? 'このデモの登場人物は、すでに口座を持っています。入口の流れだけ、擬似的に体験できます。'
                  : ''}
              </p>
              {id === 'deposit' && state.acct.times > 0 && !done ? (
                <p className={styles.actDone}>✓ {state.acct.times}回積み増しました</p>
              ) : null}
              {done ? null : (
                <>
                  <p className={styles.before}>押すと、こうなります</p>
                  <dl className={styles.rows}>
                    {rowsOf(id).map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd className={fan.num}>{v}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              )}
              {done ? (
                <p
                  key={`done-${fresh?.nonce ?? 0}`}
                  className={got ? `${styles.actDone} ${styles.got}` : styles.actDone}
                  style={delay}
                >
                  ✓ {id === 'deposit' ? 'デモでは、これ以上積み増せません' : '達成しました'}
                </p>
              ) : (
                <button
                  type="button"
                  className={
                    id === primary
                      ? `${fan.btn} ${fan.btnFull}`
                      : `${fan.btn} ${fan.btnSecondary} ${fan.btnFull}`
                  }
                  onClick={() => actions.runAcct(id, 'acct')}
                >
                  {once ? 'さらに積み増す' : def.btn}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className={fan.dNote}>擬似の動きです。実際の入出金・手続きは始まりません</p>
    </>
  );
}
