import { cityIndex, demandOf, metricValues } from '../../core';
import { simulatorHref } from '../adjust';
import type { AdjustId } from '../adjust';
import styles from '../office.module.css';
import {
  quadDots,
  quadOfDot,
  quadPeopleAt,
  QUAD_BOX,
  QUAD_MID,
  xOfDeposit,
  yOfHeat,
} from '../scatter';
import { useOffice } from '../store';
import { ARTIST_TEXT } from '../text/artists';
import {
  ADJUST_LABELS,
  capChip,
  demandSource,
  depositText,
  heatText,
  quadLineText,
  quadLineValues,
  minHelp,
  minResetLabel,
  QUAD_NAMES,
  QUAD_STACK,
  ruleText,
  shortText,
  text,
  verdictText,
  warnText,
  yen,
  realText,
} from '../text/labels';
import type { OfficeView } from '../view';
import { Changed } from './Changed';
import { QuadReset } from './QuadControls';

/** 4 象限の名前 → 強調の対象の数字の名前（view.ts の CHANGE_KEYS） */
const QUAD_CHANGE_KEY = {
  hotRich: 'quadHotRich',
  hotPoor: 'quadHotPoor',
  coolRich: 'quadCoolRich',
  coolPoor: 'quadCoolPoor',
} as const;

export function UpRows({ view }: { readonly view: OfficeView }) {
  const { condition, uplift } = view;
  return (
    <ul className={styles.upRows}>
      {uplift.rows.map((row) => {
        const course = condition.courses.find((c) => c.id === row.courseId);
        return (
          <li key={row.courseId}>
            <span className={styles.n}>{course?.name}</span>
            <span className={styles.f}>
              （{yen(row.price)} − {yen(condition.price)}）× {row.slots}
              {row.unit}
            </span>
            <span className={styles.p}>+{yen(row.plus)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Scatter({ view }: { readonly view: OfficeView }) {
  const artistId = useOffice((s) => s.artistId);
  const city = useOffice((s) => s.city);
  const line = useOffice((s) => s.quadLine);
  if (city === null) return null;
  const demand = demandOf(artistId, city);
  const dots = quadDots(artistId, city);
  const { people, estimate } = quadPeopleAt(artistId, city, line);
  const { x0, x1, y0, y1 } = QUAD_BOX;
  const { x: xm, y: ym } = QUAD_MID;
  const lx = xOfDeposit(line.deposit);
  const ly = yOfHeat(line.heat);
  const about = estimate ? '約' : '';
  const label =
    `${ARTIST_TEXT[artistId].name}の、${city}のファンの散布図。横軸が預金額、縦軸が熱量。1点は約${demand.perDot}人。` +
    (estimate ? `${quadLineValues(line.deposit, line.heat)}（${quadLineText.estimate}）。` : '') +
    `熱量が高く資金もあるファンは${about}${estimate ? people.hotRich : view.expected}人、熱量は高いが資金が少ないのは${about}${people.hotPoor}人、熱量は低いが資金があるのは${about}${people.coolRich}人、熱量が低く資金も少ないのは${about}${people.coolPoor}人。`;
  return (
    <section className={styles.quad} aria-labelledby="j6q">
      <div className={styles.quadHead}>
        <p className={styles.jlabel} id="j6q" style={{ margin: 0 }}>
          {text.judge3}
        </p>
        {estimate && (
          <p className={styles.qEstimate} data-testid="quad-estimate">
            <span className={styles.qEstimateChip}>{quadLineText.estimate}</span>
          </p>
        )}
        {/* 大きい数字（右上の人数）は、線が初めの位置のときだけ出す。線を動かしている間は、カードの
            「いま呼べる 約N人」（目安）と食い違うので出さない（#24 の統括の指摘。案 2）。
            core の見込みは、⑥ の横棒の「見込み」に、いつも出ている（data-testid="expected" と強調はそちら） */}
        {!estimate && (
          <div className={styles.quadBigWrap} data-testid="quad-big">
            <p className={styles.quadBig}>
              <span className={styles.hl}>
                {view.expected}
                <small>人</small>
              </span>
            </p>
            <div className={styles.quadBigLabel}>{text.hotRichLabel}</div>
          </div>
        )}
      </div>
      {/* 図（左）と、象限の名前と人数・初めの位置に戻す（右）を横に並べる */}
      <div className={styles.quadBody}>
        <div className={styles.quadFig}>
          <svg viewBox={`0 0 520 ${y1 + 56}`} role="img" aria-label={label}>
            <rect
              className={styles.qHot}
              x={lx}
              y={y0}
              width={Math.max(0, x1 - lx)}
              height={Math.max(0, ly - y0)}
              rx={8}
            />
            <line className={styles.qMid} x1={lx} y1={y0} x2={lx} y2={y1} />
            <line className={styles.qMid} x1={x0} y1={ly} x2={x1} y2={ly} />
            <line className={styles.qAxis} x1={x0} y1={y1} x2={x1} y2={y1} />
            <line className={styles.qAxis} x1={x0} y1={y0} x2={x0} y2={y1} />
            {dots.map((dot, i) => (
              <circle
                key={i}
                className={`${styles.qDot} ${quadOfDot(dot, line) === 'hotRich' ? styles.hot : ''}`}
                cx={dot.x.toFixed(1)}
                cy={dot.y.toFixed(1)}
                r={6}
              />
            ))}
            <text className={styles.qT} x={x0} y={y1 + 24}>
              0
            </text>
            <text className={styles.qT} x={xm} y={y1 + 24} textAnchor="middle">
              15万円
            </text>
            <text className={styles.qT} x={x1} y={y1 + 24} textAnchor="end">
              60万円〜
            </text>
            <text className={styles.qT} x={(x0 + x1) / 2} y={y1 + 50} textAnchor="middle">
              預金額 →
            </text>
            <text className={styles.qT} x={x0 - 8} y={y0 + 10} textAnchor="end">
              5
            </text>
            <text className={styles.qT} x={x0 - 8} y={ym + 4} textAnchor="end">
              3
            </text>
            <text className={styles.qT} x={x0 - 8} y={y1} textAnchor="end">
              1
            </text>
            <text
              className={styles.qT}
              x={16}
              y={ym}
              textAnchor="middle"
              transform={`rotate(-90 16 ${ym})`}
            >
              熱量 →
            </text>
            {estimate && (
              <>
                <text
                  className={styles.qLineT}
                  x={Math.min(lx + 4, x1 - 4)}
                  y={y1 - 6}
                  textAnchor={lx + 60 > x1 ? 'end' : 'start'}
                >
                  {depositText(line.deposit)}
                </text>
                <text className={styles.qLineT} x={x0 + 4} y={ly > y0 + 16 ? ly - 5 : ly + 14}>
                  {heatText(line.heat)}
                </text>
              </>
            )}
          </svg>
          <p className={styles.qUnit}>● 1点 ≒ {demand.perDot}人</p>
        </div>
        <div className={styles.quadSide}>
          <ul className={styles.qNames} aria-hidden="true">
            {QUAD_STACK.map((key) => (
              <li key={key} className={key === 'hotRich' ? styles.hot : undefined}>
                <span className={styles.qName}>{QUAD_NAMES[key]}</span>
                <Changed k={QUAD_CHANGE_KEY[key]} now={people[key]} short>
                  <span className={styles.qNum} data-testid={`quad-${key}`}>
                    {about}
                    {key === 'hotRich' && !estimate ? view.expected : people[key]}
                    <small>人</small>
                  </span>
                </Changed>
              </li>
            ))}
          </ul>
          <QuadReset />
        </div>
      </div>
      {/* 境目のスライダー（QuadControls）は、条件の帯へ移した（要件 R-15）。初めの位置に戻すは、結果の横に残す */}
    </section>
  );
}

/** 「条件を調整」の金額の欄 1 つ（会場費・制作費・移動・宿泊・利益） */
function CostField({
  id,
  value,
  input,
  error,
  onInput,
  onBlur,
  noteId,
}: {
  readonly id: AdjustId;
  readonly value: number;
  readonly input: string | undefined;
  readonly error: string | undefined;
  readonly onInput: (id: AdjustId, raw: string) => void;
  readonly onBlur: (id: AdjustId) => void;
  /** 欄の外に置いた添え書きの id（読み上げで欄に結び付ける） */
  readonly noteId?: string;
}) {
  const described = [noteId ?? null, error !== undefined ? `err-${id}` : null]
    .filter((x) => x !== null)
    .join(' ');
  return (
    <div className={styles.field}>
      <label htmlFor={`in-${id}`}>{ADJUST_LABELS[id]}</label>
      <div className={styles.yenIn}>
        <input
          id={`in-${id}`}
          inputMode="numeric"
          autoComplete="off"
          value={input ?? value.toLocaleString('ja-JP')}
          aria-invalid={error !== undefined}
          aria-describedby={described === '' ? undefined : described}
          onChange={(event) => onInput(id, event.target.value)}
          onBlur={() => onBlur(id)}
        />
        <span>円</span>
      </div>
      {error !== undefined && (
        <p className={styles.err} id={`err-${id}`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function Adjust({ view }: { readonly view: OfficeView }) {
  const open = useOffice((s) => s.adjustOpen);
  const setOpen = useOffice((s) => s.setAdjustOpen);
  const costs = useOffice((s) => s.costs);
  const hope = useOffice((s) => s.hope);
  const costInputs = useOffice((s) => s.costInputs);
  const costErrors = useOffice((s) => s.costErrors);
  const setCostInput = useOffice((s) => s.setCostInput);
  const blurCost = useOffice((s) => s.blurCost);
  const minInput = useOffice((s) => s.minInput);
  const minError = useOffice((s) => s.minError);
  const minHand = useOffice((s) => s.minHand);
  const setMinInput = useOffice((s) => s.setMinInput);
  const blurMin = useOffice((s) => s.blurMin);
  const resetMin = useOffice((s) => s.resetMin);
  const { condition } = view;
  const { cap, unit } = condition.venue;
  return (
    <details
      className={styles.adjust}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>{text.adjust}</summary>
      {/* 入力は、収支シミュレーターの「1 数字」と同じ項目（2026-11-20。N-13・Issue #53）。出演料とアーティストの利益は「利益」に
          まとめた（シミュレーターの M-26 と同じ考え方）。利益は手数料 10% を引いたあとの額で、core には adjust.ts で組み替えて渡す（案 X） */}
      <p className={styles.adjustGrp}>{text.adjustCostGroup}</p>
      <div className={styles.condIn}>
        {(['venue', 'prod', 'travel'] as const).map((id) => (
          <CostField
            key={id}
            id={id}
            value={costs[id]}
            input={costInputs[id]}
            error={costErrors[id]}
            onInput={setCostInput}
            onBlur={blurCost}
          />
        ))}
      </div>
      <p className={styles.adjustGrp}>{text.adjustHopeGroup}</p>
      <div className={styles.condIn}>
        <CostField
          id="hope"
          value={hope}
          input={costInputs.hope}
          error={costErrors.hope}
          onInput={setCostInput}
          onBlur={blurCost}
          noteId="note-hope"
        />
        {/* 添え書きは、欄の右の空いた所に置く（欄の幅だと 3 行に折れるため） */}
        <p className={`${styles.help} ${styles.hopeNote}`} id="note-hope">
          {text.adjustHopeNote}
        </p>
      </div>
      <div className={styles.minIn}>
        <label htmlFor="in-min">{text.minLabel}</label>
        <div className={styles.minRow}>
          <div className={styles.yenIn} style={{ width: 160 }}>
            <input
              id="in-min"
              inputMode="numeric"
              autoComplete="off"
              value={minInput ?? String(condition.min)}
              aria-invalid={minError !== null}
              aria-describedby="min-help min-err"
              onChange={(event) => setMinInput(event.target.value)}
              onBlur={blurMin}
            />
            <span>人</span>
          </div>
          {minHand !== null && minHand !== condition.need && (
            <button type="button" className={styles.linkBtn} onClick={resetMin}>
              {minResetLabel(condition.need)}
            </button>
          )}
        </div>
        <p className={styles.help} id="min-help">
          {minHelp(condition.need, cap, unit)}
        </p>
        {minError !== null && (
          <p className={styles.err} id="min-err" role="alert">
            {minError}
          </p>
        )}
      </div>
    </details>
  );
}

/** ⑤ 開催条件（損益の要約）: 到達ライン・成立の条件・上乗せ、条件を調整、収支シミュレーター・提案を見る */
function Summary({ view }: { readonly view: OfficeView }) {
  const openModal = useOffice((s) => s.openModal);
  const costs = useOffice((s) => s.costs);
  const hope = useOffice((s) => s.hope);
  const { condition, low } = view;
  const { cap, unit } = condition.venue;
  const rule = ruleText(condition.line, condition.min);
  return (
    <section className={styles.jcard} aria-labelledby="j5">
      {/* 見出しの段落（区画の名前）の外に、架空の札と、実在と架空の混ざり方の一文を置く（仕様 4.3） */}
      <div className={styles.jHead}>
        <p className={styles.jlabel} id="j5" style={{ margin: 0 }}>
          <i>5</i>
          {text.judge1}
        </p>
        <span className={styles.fictChip} data-testid="fict-5">
          {realText.fiction}
        </span>
        <span className={styles.mixNote} data-testid="mix-note">
          {realText.mixNote}
        </span>
      </div>
      {/* 1 行目に「<到達ライン>で開催できます」を一番大きく、2 行目に「<必要人数> × <価格>」とキャパの札
          （2026-11-18。docs/office/要件.md の M-07）。data-testid="line" の中は、金額だけのまま */}
      <p className={styles.condLine} data-testid="cond-line">
        <span className={styles.k}>{text.lineLabel}</span>
        <span className={styles.lineCan}>
          <Changed k="line" now={condition.line} unit="円">
            <span className={styles.res} data-testid="line">
              {yen(condition.line)}
            </span>
          </Changed>
          {text.lineCan}
        </span>
      </p>
      <p className={styles.condSubLine} data-testid="cond-sub">
        <span className={styles.sub}>
          <Changed k="need" now={condition.need} unit="人">
            <span data-testid="need">{condition.need}人</span>
          </Changed>
          <span className={styles.op}>×</span>
          <Changed k="price" now={condition.price} unit="円">
            <span data-testid="price">{yen(condition.price)}</span>
          </Changed>
        </span>
        <span className={`${styles.capChip} ${view.overCapacity ? styles.over : ''}`}>
          {capChip(condition.need, cap, unit)}
        </span>
      </p>
      <p className={styles.condMore}>
        <span className={styles.k}>{text.ruleLabel}</span>
        <span data-testid="rule">
          {rule.before}
          <b>{rule.line}</b>
          {rule.middle}
          <b>{rule.min}</b>
          {rule.after}
        </span>
      </p>
      {/* 注記（最低人数・上位コースの数え方）と、上位のコースによる上乗せ（合計と内訳）は、2026-11-19 に外した
          （Issue #48・docs/office/要件.md の N6-1）。表示だけで、判定の計算（上乗せを金額の条件に数える）と状態は変えない。
          上乗せの内訳（UpRows）は、提案の 1 枚に残す */}
      {view.gapYen !== null && (
        <p className={styles.condWarn} role="status">
          {warnText(view.gapYen)}
        </p>
      )}
      <div className={styles.judgeFoot}>
        {/* 条件を調整（費用・最低人数）は、⑤ に残す（条件の帯へは移さない）。既存のテスト I-07 が、
            費用の入力の知らせを、判定の区画（data-testid="judge"）の中で探しているため（担当者の決定。R-15 は一部） */}
        <Adjust view={view} />
        <div className={styles.footBtns}>
          {/* 選んだ会場の ID を付けて渡す。シミュレーターは、その会場の規模の人数から始め、その会場を一番上で選ぶ
              （Issue #50・N-11。ID はシミュレーターの側で、会場の一覧と照らして、合ったときだけ使う）。
              あわせて「条件を調整」の 4 つの値（cost）を渡し、移ったあとも同じ値で見せる（Issue #53・N-15） */}
          {condition.venue.simulatorVenueId !== undefined && (
            <a
              className={`${styles.btn} ${styles.secondary}`}
              href={simulatorHref(condition.venue.simulatorVenueId, {
                venue: costs.venue,
                prod: costs.prod,
                travel: costs.travel,
                hope,
              })}
            >
              {text.simulator}
            </a>
          )}
          <button
            type="button"
            className={styles.btn}
            aria-disabled={low}
            aria-describedby={low ? 'pp-ng' : undefined}
            onClick={() => {
              if (!low) openModal('proposal');
            }}
          >
            {text.proposal}
          </button>
        </div>
        {/* シミュレーターに無い会場（RISE UP）の注記と、提案できない理由は、ボタンの組の外の 1 行ずつに置く
            （組の中に置くと、組ごと折り返して ⑤ が高くなる。2026-11-18。⑤ を ⑥ の上にしたぶん。V-14）。
            シミュレーターに無い会場は、入口を出さず注記だけ（押したあとに会場を探して迷わせない。D-21） */}
        {(condition.venue.simulatorVenueId === undefined || low) && (
          <div className={styles.footNotes}>
            {condition.venue.simulatorVenueId === undefined && (
              <p className={styles.simNone}>{text.simulatorNone}</p>
            )}
            {low && (
              <p className={styles.ppNg} id="pp-ng">
                {text.proposalNg}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/** ⑥ の凡例の下の 1 行: 選んだ市の登録者数 → 預金の支えがある熱いファン（見込み）。
    数字は core の値のまま（登録は地図の丸の面積と同じ metricValues、見込みは横棒と同じ view.expected） */
function DemandSource({ expected }: { readonly expected: number }) {
  const artistId = useOffice((s) => s.artistId);
  const city = useOffice((s) => s.city);
  if (city === null) return null;
  const reg = metricValues(artistId, 'reg')[cityIndex(city)] ?? 0;
  const line = demandSource(city, reg, expected);
  // 割合「（登録の 6.5%）」は、2026-11-19 に外した（Issue #48・docs/office/要件.md の N4-1）。
  // 登録の人数と見込みの人数は、これまでどおり並べて出す（R-03）。文そのものは core の値のまま
  return (
    <div className={styles.meetSourceRow}>
      <p className={styles.meetSource} data-testid="demand-source">
        {line.lead} <b>{line.reg}</b> {line.mid} <b>{line.expected}</b>
      </p>
    </div>
  );
}

/** ⑥ 確度: 満たせるか（札・横棒）と、熱量と資金（4 象限・線を動かす操作） */
function Certainty({ view }: { readonly view: OfficeView }) {
  const { condition, expected, level, low } = view;
  const verdictClass = level === '高' ? '' : level === '中' ? styles.mid : styles.low;
  return (
    <section className={styles.jcard} aria-labelledby="j6">
      <div className={styles.meetTop}>
        <p className={styles.jlabel} id="j6" style={{ margin: 0 }}>
          <i>6</i>
          {text.judge2}
        </p>
        <span className={`${styles.fictChip} ${styles.fictMid}`} data-testid="fict-6">
          {realText.fiction}
        </span>
        {/* core の見込み。線を動かしても変わらない（札の元）。2026-11-19 に横棒を外し、判定の札の横へ移した（N-7） */}
        <span className={styles.meetExp}>
          見込み{' '}
          <Changed k="expected" now={expected} unit="人">
            <span data-testid="expected">{expected}人</span>
          </Changed>
        </span>
        <Changed k="level" now={level}>
          <span className={`${styles.verdict} ${verdictClass}`} data-testid="verdict">
            {verdictText(level)}
          </span>
        </Changed>
      </div>
      {/* ⑥ の横棒（必要 ／ 見込み）と凡例は、2026-11-19 に外した（統括の追加の修正依頼の N-7）。4 象限の図は残す */}
      {/* 需要の出どころ（R-03）。強調はしない（見込みの強調は、判定の札の横の「見込み」のほう） */}
      <DemandSource expected={expected} />
      {low && (
        <p className={styles.meetShort}>
          <Changed k="shortfall" now={view.shortfall} unit="人">
            {shortText(condition.need, view.shortfall)}
          </Changed>
        </p>
      )}
      <Scatter view={view} />
    </section>
  );
}

/** 判定（会場を選ぶと出る）: ⑤ 開催条件 と ⑥ 確度。会場を選ぶまでは出さない（I-01）。
    2026-11-18 に、⑤ を上・⑥ を下にした（docs/office/要件.md の M-06・M-25） */
export function Judge({ view }: { readonly view: OfficeView }) {
  return (
    <div data-testid="judge" className={styles.judge}>
      <Summary view={view} />
      <Certainty view={view} />
    </div>
  );
}
