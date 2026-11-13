// メニュー配下の画面（あとから読む側。設計 D-40 の fan-pages）。枠（札の帯・戻る）は、読み込み前から出ている。
import type { ReactNode } from 'react';
import { RECRUITMENT_DEADLINE, areaFor } from '../core';
import { artistView } from '../art/registry';
import { PAGE_TITLES } from '../text/ui';
import { ACT_IDS } from '../domain/state';
import type { Page } from '../domain/state';
import { courseOf } from '../domain/view';
import { yen } from '../text/format';
import fan from '../fan.module.css';
import { useFan } from '../store/FanProvider';
import { MyState } from '../text/pay';
import { AcctPage, CoursesPage } from './CoursesAcct';
import { ContribPage, OptPage } from './ContribOpt';
import styles from './pages.module.css';

type Props = { page: Exclude<Page, 'start' | 'home' | 'next'> };

export default function PageBody({ page }: Props) {
  switch (page) {
    case 'more':
      return <MorePage />;
    case 'menu':
      return <CoursesPage />;
    case 'acct':
      return <AcctPage />;
    case 'contrib':
      return <ContribPage />;
    case 'area':
      return <AreaPage />;
    case 'how':
      return <HowPage />;
    case 'opt':
      return <OptPage />;
    case 'priv':
      return <PrivPage />;
  }
}

const icon = (d: ReactNode) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {d}
  </svg>
);

const TILES: { page: Page; label: string; demo?: boolean; icon: ReactNode }[] = [
  {
    page: 'contrib',
    label: PAGE_TITLES.contrib,
    icon: icon(<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />),
  },
  {
    page: 'acct',
    label: PAGE_TITLES.acct,
    icon: icon(
      <>
        <ellipse cx="12" cy="7" rx="7" ry="3" />
        <path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
      </>,
    ),
  },
  {
    page: 'menu',
    label: PAGE_TITLES.menu,
    icon: icon(
      <>
        <rect x="3" y="6" width="18" height="12" rx="3" />
        <path d="M15 6v12" />
      </>,
    ),
  },
  {
    page: 'area',
    label: PAGE_TITLES.area,
    icon: icon(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />),
  },
  {
    page: 'how',
    label: PAGE_TITLES.how,
    icon: icon(
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7.5v.5" />
      </>,
    ),
  },
  {
    page: 'opt',
    label: PAGE_TITLES.opt,
    demo: true,
    icon: icon(<path d="M4 8h13l-3-3M20 16H7l3 3" />),
  },
  {
    page: 'priv',
    label: PAGE_TITLES.priv,
    icon: icon(
      <>
        <rect x="7" y="3" width="10" height="18" rx="2" />
        <path d="M11 18h2" />
      </>,
    ),
  },
];

const PROCS: { name: string; label: string[]; icon: ReactNode }[] = [
  {
    name: '残高の確認',
    label: ['残高の', '確認'],
    icon: icon(
      <>
        <rect x="3" y="6" width="18" height="13" rx="2" />
        <path d="M16 12h3" />
      </>,
    ),
  },
  { name: '振込', label: ['振込'], icon: icon(<path d="M4 9h14l-3-3M20 15H6l3 3" />) },
  {
    name: 'チケット',
    label: ['チケット'],
    icon: icon(<path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z" />),
  },
  {
    name: 'グッズ',
    label: ['グッズ'],
    icon: icon(
      <>
        <path d="M5 8h14l-1 12H6z" />
        <path d="M9 8a3 3 0 0 1 6 0" />
      </>,
    ),
  },
];

/** メニュー（SP-48）。「くわしく」の 7 つのタイルと、「手続き」の 4 ボタン。一番下に「申し込みをやめる」。 */
function MorePage() {
  const { actions } = useFan();
  return (
    <>
      <h3 className={styles.homeH} style={{ margin: 0 }}>
        くわしく
      </h3>
      <nav className={styles.homeMenu} aria-label="くわしく" style={{ padding: 0 }}>
        {TILES.map((t) => (
          <button
            key={t.page}
            type="button"
            className={styles.tile}
            onClick={() => actions.go(t.page)}
          >
            {t.icon}
            {t.demo ? (
              <span className={styles.tileT}>
                {t.label}
                <span className={styles.demoChip}>デモ用の操作</span>
              </span>
            ) : (
              t.label
            )}
          </button>
        ))}
      </nav>
      <h3 className={styles.homeH} id="fan-proc-h" style={{ margin: 0 }}>
        手続き <small>デモでは始まりません</small>
      </h3>
      <div
        className={styles.procRow}
        role="group"
        aria-labelledby="fan-proc-h"
        style={{ padding: 0 }}
      >
        {PROCS.map((p) => (
          <button
            key={p.name}
            type="button"
            className={styles.procBtn}
            onClick={() =>
              actions.toast(`「${p.name}」は、今後の対応範囲です。手続きは始まりません`)
            }
          >
            {p.icon}
            <span>
              {p.label.map((x, i) => (
                <span key={i}>
                  {i > 0 ? <wbr /> : null}
                  {x}
                </span>
              ))}
            </span>
          </button>
        ))}
      </div>
      <div className={styles.menuFoot} style={{ margin: 0 }}>
        <button type="button" className={styles.quitLink} onClick={actions.openCancel}>
          申し込みをやめる
        </button>
      </div>
    </>
  );
}

type AreaPref = ReturnType<typeof areaFor>[number];

/** 支援の状況（SP-46）。達成率・横棒・県別・市別の表。 */
function AreaPage() {
  const { view, actions } = useFan();
  const { status, cond } = view;
  const rows = areaFor(cond.start, cond.city, status.supporters - cond.start);
  const max = Math.max(...rows.map((p) => p.n));
  return (
    <>
      <div className={fan.card}>
        <p className={`${styles.aonBig} ${fan.num}`}>
          達成率 <b>{status.pct}%</b>
        </p>
        <div className={fan.barH} role="img" aria-label={`達成率 ${status.pct}%`}>
          <i style={{ width: `${status.fill.toFixed(1)}%` }} />
        </div>
        <p className={`${styles.plain} ${fan.num}`}>
          支援者 <b>{status.supporters}人</b>／最低人数 {cond.min}人
          {status.established
            ? '（成立しました）'
            : status.gathered
              ? '（人数は集まりました）'
              : `（あと${status.left}人）`}
        </p>
        <table className={styles.area} style={{ marginTop: 'var(--s2)' }}>
          <thead className={fan.srOnly}>
            <tr>
              <th scope="col">地域</th>
              <th scope="col">人数</th>
              <th scope="col">割合</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <AreaRows key={p.pref} pref={p} max={max} />
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className={`${fan.btn} ${fan.btnFull}`}
        onClick={() => actions.go(view.joined ? 'next' : 'menu')}
      >
        {view.joined ? '次のアクション' : 'コースを選ぶ'}
      </button>
    </>
  );
}

function AreaRows({ pref, max }: { pref: AreaPref; max: number }) {
  return (
    <>
      <tr className={styles.prefRow}>
        <th scope="row">{pref.pref}</th>
        <td className={fan.num} style={{ textAlign: 'right', fontWeight: 700 }}>
          {pref.n}人
        </td>
        <td style={{ width: '38%' }}>
          <span className={styles.areaBar} style={{ width: `${(pref.n / max) * 100}%` }} />
        </td>
      </tr>
      {pref.cities.map((c) => (
        <tr key={c.name} className={c.isHome ? styles.me : undefined}>
          <td style={{ paddingLeft: 'var(--s3)' }}>
            {c.name}
            {c.isHome ? <span className={styles.meTag}>地元</span> : null}
          </td>
          <td className={fan.num} style={{ textAlign: 'right', fontWeight: 700 }}>
            {c.n}人
          </td>
          <td>
            <span className={styles.areaBar} style={{ width: `${(c.n / max) * 100}%` }} />
          </td>
        </tr>
      ))}
    </>
  );
}

/** しくみ（SP-47）。お金の動き 4 手順・期限・会場・候補日。 */
function HowPage() {
  const { view, actions } = useFan();
  const { cond } = view;
  return (
    <>
      <div className={fan.card}>
        <p className={styles.aonBig}>
          <b>支援者 {cond.min}人</b>以上、かつ、支援の合計が目標の金額以上で開催。
          <br />
          届かなければ、お金は動かない。
        </p>
        <p className={styles.plain}>
          選んだコースの金額は、成立するまで自分の口座の中で確保されます。
        </p>
      </div>
      <div className={fan.card}>
        <p className={fan.bigK}>お金の動き</p>
        <ol className={styles.flow}>
          <li>
            <i>1</i>
            <span>
              コースを選んで、申し込む
              <small>
                申し込むと確定します。選んだコースの金額を、成立するまで自分の口座の中で確保（コースごとに条件あり。前方の席・特別コース・最上位コースは、メイン口座にすることと、預金の額）
              </small>
            </span>
          </li>
          <li>
            <i>2</i>
            <span>
              期限まで、仲間を集める<small>期限 {RECRUITMENT_DEADLINE}</small>
            </span>
          </li>
          <li>
            <i>3</i>
            <span>
              支援の合計が目標の金額に届き、支援者が最低人数に届いたら、開催が決まる
              <small>
                数えるのは、資金を確保できた支援者だけ（1人1回）。上位のコースでも、人数は 1
                人ぶん。金額は、そのコースの金額で数えます
              </small>
            </span>
          </li>
          <li>
            <i>4</i>
            <span>
              届かなければ、お金は動かない<small>確保は解除される</small>
            </span>
          </li>
        </ol>
      </div>
      <div className={fan.card}>
        <dl className={styles.facts}>
          <dt>期限</dt>
          <dd>{RECRUITMENT_DEADLINE}</dd>
          <dt>会場</dt>
          <dd>{cond.venue.name}</dd>
          <dt>候補日</dt>
          <dd>{cond.venue.day}（架空）</dd>
        </dl>
      </div>
      <p className={fan.dNote}>空き日は架空です。料金は目安です（2026-11-12 時点）。</p>
      <button
        type="button"
        className={`${fan.btn} ${fan.btnFull}`}
        onClick={() => actions.go(view.joined ? 'next' : 'menu')}
      >
        {view.joined ? '次のアクション' : 'コースを選ぶ'}
      </button>
    </>
  );
}

/**
 * 情報の扱い（SP-50。決定 17・6）。送るのは、申し込みの合図（公演の指定を含む）と端末の番号だけ。
 * 端末の中に残るのは、端末の番号だけで、再読み込みでほかは初めに戻る。
 */
function PrivPage() {
  const { state, view } = useFan();
  const o = artistView(state.oshiId);
  const { cond } = view;
  const sk = courseOf(cond, state.seat);
  const rows: [string, ReactNode][] = [
    ['推し', o.name],
    ['希望の市・会場', `${cond.city}・${cond.venue.name}`],
    ['希望のコース', `${sk.name} ${yen(sk.price)}`],
    [
      '申し込みの状態',
      view.my ? `申し込み中（${view.my.name}。確保 ${yen(view.my.price)}）` : '未申し込み',
    ],
    ['目指すコース', view.target ? view.target.name : 'なし（申し込み済み）'],
    ['呼んだ仲間の数', `${state.called}人`],
    ['達成した行動', `${view.doneCount} / ${ACT_IDS.length}`],
    ['開いた特典', `${view.giftCount} / 3`],
    [
      '預金額・メイン口座（擬似）',
      <MyState key="my" deposit={state.acct.deposit} pay={state.acct.pay} />,
    ],
    ['端末の番号', 'この端末に残ります（個人を特定しない乱数）'],
  ];
  return (
    <>
      <div className={fan.card}>
        <svg
          className={styles.privFig}
          viewBox="0 0 300 120"
          role="img"
          aria-label="図: 選んだ内容はこの端末の中に置き、共有のメーターへは、申し込みの合図と端末の番号だけを送る"
        >
          <rect
            x="6"
            y="6"
            width="288"
            height="108"
            rx="8"
            fill="none"
            stroke="var(--ink-soft)"
            strokeWidth="1.5"
            strokeDasharray="5 4"
          />
          <rect
            x="22"
            y="26"
            width="120"
            height="68"
            rx="8"
            fill="var(--bg-c)"
            stroke="var(--primary)"
            strokeWidth="2"
          />
          <text x="82" y="56" textAnchor="middle">
            この端末
          </text>
          <text
            x="82"
            y="78"
            textAnchor="middle"
            style={{ fill: 'var(--ink-soft)', fontWeight: 400 }}
          >
            選んだ内容
          </text>
          <line x1="150" y1="60" x2="196" y2="60" stroke="var(--ink)" strokeWidth="2" />
          <text x="246" y="50" textAnchor="middle">
            申し込みの合図と
          </text>
          <text x="246" y="72" textAnchor="middle">
            端末の番号だけ
          </text>
        </svg>
      </div>
      <div className={fan.card}>
        <p className={fan.bigK}>保存している項目（いまの内容）</p>
        <dl className={`${styles.facts} ${styles.factsV}`} style={{ marginTop: 'var(--s2)' }}>
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: 'contents' }}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className={fan.card}>
        <p className={fan.bigK}>保存先</p>
        <p className={styles.plain}>
          送るのは、申し込みの合図（公演の指定を含む）と端末の番号だけです。個人の情報は送りません。
        </p>
        <p className={styles.plain}>
          端末の中に残るのは、端末の番号だけです。選んだ内容や達成の記録は、画面を開いているあいだだけ覚えていて、再読み込みで初めに戻ります。
        </p>
        <p className={styles.plain}>
          共有ボタンを押したときだけ、投稿文を各社の画面へ渡します。投稿文には、人物の番号も個人の情報も入れていません。
        </p>
        <p className={styles.plain}>
          氏名・口座番号・ログイン情報・位置情報は、入力欄も保存場所もありません。
        </p>
      </div>
      <div className={fan.card}>
        <p className={fan.bigK}>最初の状態に戻す方法</p>
        <p className={styles.plain}>
          「リセット（デモ用）」を押すと、この端末の記録（選んだ内容・達成の記録）がすべて初めに戻り、はじめの画面から始められます。画面を閉じたり再読み込みしたりしても、初めに戻ります。
        </p>
      </div>
    </>
  );
}
