// プラン（SP-43）と、口座と預金（SP-44）。メニュー配下の画面（あとから読む側）。
import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import { TEIKI } from '../../core';
import {
  ENTRY_PLAN,
  PLAN_NAMES,
  PLAN_ORDER,
  depositTasksOf,
  homePhaseOf,
  isUpgrade,
  rewardOf,
  taskDepositOf,
  upgradesOf,
} from '../domain/plan';
import type { AcctId } from '../domain/state';
import { courseOf } from '../domain/view';
import { yen } from '../text/format';
import { PayNote } from '../text/pay';
import fan from '../fan.module.css';
import { useFan } from '../store/FanProvider';
import { LockIcon } from '../components/LockIcon';
import { DepositCard } from './DepositCard';
import styles from './pages.module.css';

/** プラン。4 つのプランが、確保する額・手に入るもの・特典・自分の状態つきで並ぶ（ここからは変えない）。 */
export function CoursesPage() {
  const { state, view, actions } = useFan();
  const { cond } = view;
  const ups = upgradesOf(state.course);
  // 鍵が外れるのは、預金でやることが済んで、ホームに「プランを上げる」が出てから（それまでは、上のプランに鍵）
  const unlocked = homePhaseOf(state, cond) === 'grow';
  return (
    <>
      <div className={`${fan.card} ${fan.cardNext}`}>
        <p className={fan.bigK}>いまのプラン</p>
        {view.my ? (
          <>
            <p className={styles.bigV}>
              {PLAN_NAMES[view.my.id]}（確保 {yen(view.my.price)}）
            </p>
            <p className={styles.dSub}>参加しています。やめるときは、メニューのいちばん下から。</p>
            <p className={styles.dSub}>
              {ups.length
                ? 'プランは、ホームの「プランを上げる」から上げます。'
                : 'いちばん上のプランです。'}
            </p>
          </>
        ) : (
          <>
            <p className={styles.bigV}>まだ参加していません</p>
            <p className={styles.dSub}>
              最初に選べるのは、{PLAN_NAMES[ENTRY_PLAN]}
              です。上のプランは、参加のあとに上げられます。
            </p>
            <button
              type="button"
              className={`${fan.btn} ${fan.btnFull}`}
              style={{ marginTop: 'var(--s3)' }}
              onClick={actions.rejoin}
            >
              参加するプランを選ぶ
            </button>
          </>
        )}
        <p className={styles.dSub}>
          <PayNote />
        </p>
      </div>
      <ul className={fan.planList} aria-label="プラン">
        {PLAN_ORDER.map((id) => {
          const k = courseOf(cond, id);
          const mine = state.course === id;
          const r = rewardOf(id);
          const locked =
            state.course === null ? id !== ENTRY_PLAN : isUpgrade(state.course, id) && !unlocked;
          return (
            <li
              key={id}
              className={fan.planItem}
              data-plan={id}
              data-mine={mine ? 'true' : undefined}
              data-locked={locked ? 'true' : undefined}
              id={`course-${id}`}
            >
              <p className={fan.planName}>
                {locked ? <LockIcon className={fan.planLockIcon} /> : null}
                {PLAN_NAMES[id]}
                {mine ? '（✓ 参加中）' : ''}
                {locked ? <span className={fan.srOnly}>（ロック中）</span> : null}
              </p>
              <dl className={fan.planFacts}>
                <dt>確保する額</dt>
                <dd className={fan.num}>{yen(k.price)}</dd>
                <dt>手に入るもの</dt>
                <dd>{k.perks.join('・')}</dd>
                {r ? (
                  <>
                    <dt>特典</dt>
                    <dd>{r.label}</dd>
                  </>
                ) : null}
              </dl>
              {mine ? (
                <p className={fan.planLock}>
                  <span className={fan.nw}>{yen(k.price)}</span>
                  は、成立まで口座の中で確保されています。
                </p>
              ) : isUpgrade(state.course, id) ? (
                <p className={fan.planLock}>ホームの「プランを上げる」から上げられます</p>
              ) : state.course === null && id !== ENTRY_PLAN ? (
                <p className={fan.planLock}>参加のあとに、上げられます</p>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className={fan.dNote}>擬似の動きです。実際の手続き・入出金は始まりません</p>
    </>
  );
}

const ACCT_DEF: Record<AcctId, { title?: string; btn: string; desc: string; tag?: string }> = {
  main: {
    title: 'メイン口座にする',
    btn: 'メイン口座にする',
    desc: '推し活の支払いに、この口座を使います。',
  },
  deposit: { btn: '預金を積み増す', desc: '預金を積み増すと、預金でやることが進みます。' },
  teiki: {
    title: '推し活定期をはじめる',
    btn: '推し活定期をはじめる',
    desc: '押すと、デモの中で、口座が使える状態になります。入力や本人確認は要りません。実際の手続きは行われません。毎月の積立で、推し活の資金をためていきます。',
    tag: '口座をお持ちでない方の入口',
  },
};

/** 口座と預金。参加のあとの「預金でやること」2 つ。押す前に、すると何が進むかを出す。 */
export function AcctPage() {
  const { state, view, actions } = useFan();
  const { cond } = view;
  const { deposit: d } = state.acct;
  const fresh = state.fresh;
  const delay = { '--ck-delay': `${state.ckDelay}s` } as CSSProperties;

  // 押したカードの見出しにフォーカスを置く（画面は動かない）。預金は、入力欄に残す（続けて入れられる）
  const nonce = fresh?.from === 'acct' ? fresh.nonce : null;
  const freshAct = fresh?.act ?? null;
  useEffect(() => {
    if (nonce === null || freshAct === null || freshAct === 'deposit') return;
    document.getElementById(`fan-ac-${freshAct}-h`)?.focus({ preventScroll: true });
  }, [nonce, freshAct]);

  const acctDone = (id: AcctId): boolean => actions.acctDone(id);
  // 流れは、推し活定期をはじめる → 預金を積み増す。口座を使う行動は、はじめたあとから
  const started = !!state.done.teiki;
  const primary = (['teiki', 'deposit'] as const).find((id) =>
    id === 'deposit' ? !state.done.deposit : !acctDone(id),
  );
  const teikiRows: [string, string][] = [
    ['口座', '使えない → 使える（デモ用）'],
    [
      '毎月の積立',
      `毎月${yen(TEIKI.monthlyYen)}、${TEIKI.months}か月で${yen(TEIKI.monthlyYen * TEIKI.months)}`,
    ],
  ];
  const tasks = depositTasksOf(state, cond);
  const allDone = tasks.every((t) => t.ok);
  // 参加の前は、行動を出さない（預金でやることは、参加のあとに行う）
  const ids = view.joined ? (['teiki', 'deposit'] as const) : ([] as const);
  return (
    <>
      {view.joined ? (
        <div className={fan.card} data-tasks={allDone ? 'done' : 'todo'}>
          <p className={fan.bigK}>預金でやること</p>
          <ul className={styles.taskList}>
            {tasks.map((t) => (
              <li key={t.id} data-task={t.id} data-ok={t.ok ? 'true' : 'false'}>
                <span aria-hidden="true">{t.ok ? '✓' : '・'}</span>
                {t.label}
                {t.id === 'deposit' ? `（${yen(taskDepositOf(cond))}以上）` : ''}
                <span className={fan.srOnly}>{t.ok ? '。済みました' : '。まだです'}</span>
              </li>
            ))}
          </ul>
          <p className={styles.actD}>いまの預金（仮）: {yen(d)}</p>
          {allDone ? (
            <>
              <p className={styles.actDone}>✓ すべて済みました</p>
              <button
                type="button"
                className={`${fan.btn} ${fan.btnFull}`}
                onClick={() => actions.go('home')}
              >
                ホームへもどる
              </button>
            </>
          ) : null}
        </div>
      ) : (
        <div className={fan.card} data-tasks="closed">
          <p className={fan.bigK}>預金でやること</p>
          <p className={styles.actD}>参加すると、預金でやることがここに出ます。</p>
          <p className={styles.actD}>いまの預金（仮）: {yen(d)}</p>
          <button type="button" className={`${fan.btn} ${fan.btnFull}`} onClick={actions.rejoin}>
            参加するプランを選ぶ
          </button>
        </div>
      )}
      <div className={styles.stack}>
        {ids.map((id) => {
          const def = ACCT_DEF[id];
          // 口座を使う行動は、推し活定期をはじめたあとから
          if (id !== 'teiki' && !started)
            return (
              <div key={id} className={fan.card} id={`ac-${id}`}>
                <h3 className={styles.actH} id={`fan-ac-${id}-h`}>
                  {def.title ?? def.btn}
                </h3>
                <p className={styles.actD}>
                  先に、推し活定期をはじめます。そのあと、できるようになります。
                </p>
              </div>
            );
          // 預金は、決まった額でなく、利用者が入れた額を足す（入力欄・足すボタン・よく使う額のボタン）
          if (id === 'deposit')
            return (
              <DepositCard key={id} title={def.btn} desc={def.desc} primary={primary === id} />
            );
          const done = acctDone(id);
          const got = fresh?.act === id;
          return (
            <div key={id} className={fan.card} id={`ac-${id}`}>
              {def.tag ? <span className={styles.actTag}>{def.tag}</span> : null}
              <h3 className={styles.actH} id={`fan-ac-${id}-h`} tabIndex={-1}>
                {def.title ?? ''}
              </h3>
              <p className={styles.actD}>{def.desc}</p>
              {done ? null : (
                <>
                  <p className={styles.before}>押すと、こうなります</p>
                  <dl className={styles.rows}>
                    {teikiRows.map(([k, v]) => (
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
                  ✓ 達成しました
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
                  {def.btn}
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
