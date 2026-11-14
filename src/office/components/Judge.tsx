import { COST_ITEM_IDS, demandOf } from '../../core';
import styles from '../office.module.css';
import { quadDots, QUAD_BOX, QUAD_MID } from '../scatter';
import { useOffice } from '../store';
import { ARTIST_TEXT } from '../text/artists';
import {
  capChip,
  COST_LABELS,
  expectedText,
  minHelp,
  minResetLabel,
  needText,
  ruleText,
  shortText,
  text,
  verdictText,
  warnText,
  yen,
} from '../text/labels';
import type { OfficeView } from '../view';

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
  if (city === null) return null;
  const demand = demandOf(artistId, city);
  const dots = quadDots(artistId, city);
  const { x0, x1, y0, y1 } = QUAD_BOX;
  const { x: xm, y: ym } = QUAD_MID;
  const label = `${ARTIST_TEXT[artistId].name}の、${city}のファンの散布図。横軸が預金額、縦軸が熱量。1点は約${demand.perDot}人。熱量が高く資金もあるファンは${view.expected}人、熱量は高いが資金が少ないのは${demand.people.hotPoor}人、熱量は低いが資金があるのは${demand.people.coolRich}人、熱量が低く資金も少ないのは${demand.people.coolPoor}人。`;
  return (
    <section className={`${styles.jcard} ${styles.quad}`} aria-labelledby="j3">
      <div className={styles.quadHead}>
        <p className={styles.jlabel} id="j3" style={{ margin: 0 }}>
          <i>3</i>
          {text.judge3}
        </p>
        <div>
          <p className={styles.quadBig} data-testid="expected">
            <span className={styles.hl}>
              {view.expected}
              <small>人</small>
            </span>
          </p>
          <div className={styles.quadBigLabel}>{text.hotRichLabel}</div>
        </div>
      </div>
      <svg viewBox={`0 0 520 ${y1 + 44}`} role="img" aria-label={label}>
        <rect className={styles.qHot} x={xm} y={y0} width={x1 - xm} height={ym - y0} rx={8} />
        <line className={styles.qMid} x1={xm} y1={y0} x2={xm} y2={y1} />
        <line className={styles.qMid} x1={x0} y1={ym} x2={x1} y2={ym} />
        <line className={styles.qAxis} x1={x0} y1={y1} x2={x1} y2={y1} />
        <line className={styles.qAxis} x1={x0} y1={y0} x2={x0} y2={y1} />
        {dots.map((dot, i) => (
          <circle
            key={i}
            className={`${styles.qDot} ${dot.hot ? styles.hot : ''}`}
            cx={dot.x.toFixed(1)}
            cy={dot.y.toFixed(1)}
            r={4.2}
          />
        ))}
        <text className={styles.qT} x={x0} y={y1 + 18}>
          0
        </text>
        <text className={styles.qT} x={xm} y={y1 + 18} textAnchor="middle">
          15万円
        </text>
        <text className={styles.qT} x={x1} y={y1 + 18} textAnchor="end">
          60万円〜
        </text>
        <text className={styles.qT} x={(x0 + x1) / 2} y={y1 + 36} textAnchor="middle">
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
      </svg>
      <p className={styles.qUnit}>● 1点 ≒ {demand.perDot}人</p>
    </section>
  );
}

function Adjust({ view }: { readonly view: OfficeView }) {
  const open = useOffice((s) => s.adjustOpen);
  const setOpen = useOffice((s) => s.setAdjustOpen);
  const costs = useOffice((s) => s.costs);
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
      <div className={styles.condIn}>
        {COST_ITEM_IDS.map((id) => {
          const error = costErrors[id];
          return (
            <div key={id} className={styles.field}>
              <label htmlFor={`in-${id}`}>{COST_LABELS[id]}</label>
              <div className={styles.yenIn}>
                <input
                  id={`in-${id}`}
                  inputMode="numeric"
                  autoComplete="off"
                  value={costInputs[id] ?? costs[id].toLocaleString('ja-JP')}
                  aria-invalid={error !== undefined}
                  aria-describedby={error !== undefined ? `err-${id}` : undefined}
                  onChange={(event) => setCostInput(id, event.target.value)}
                  onBlur={() => blurCost(id)}
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
        })}
      </div>
      <p className={styles.hint}>{text.adjustHint}</p>
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

/** 判定（会場を選ぶと出る）: 開催条件・満たせるか・熱量と資金、条件を調整、提案を見る */
export function Judge({ view }: { readonly view: OfficeView }) {
  const openModal = useOffice((s) => s.openModal);
  const { condition, expected, level, low } = view;
  const { cap, unit } = condition.venue;
  const max = Math.max(expected, condition.need) * 1.12;
  const rule = ruleText(condition.line, condition.min);
  const verdictClass = level === '高' ? '' : level === '中' ? styles.mid : styles.low;
  return (
    <div data-testid="judge">
      <div className={styles.judge}>
        <div className={styles.leftStack}>
          <section className={styles.jcard} aria-labelledby="j1">
            <p className={styles.jlabel} id="j1">
              <i>1</i>
              {text.judge1}
            </p>
            <p className={styles.condLine}>
              <span className={styles.k}>{text.lineLabel}</span>
              <span className={styles.res} data-testid="line">
                {yen(condition.line)}
              </span>
              <span className={styles.sub}>
                <span data-testid="need">{condition.need}人</span>
                <span className={styles.op}>×</span>
                <span data-testid="price">{yen(condition.price)}</span>
              </span>
            </p>
            <span className={`${styles.capChip} ${view.overCapacity ? styles.over : ''}`}>
              {capChip(condition.need, cap, unit)}
            </span>
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
            <p className={styles.condNote}>{text.minNote}</p>
            {view.gapYen !== null && (
              <p className={styles.condWarn} role="status">
                {warnText(view.gapYen)}
              </p>
            )}
            <div className={styles.upSum}>
              <p className={styles.condMore} style={{ marginTop: 0 }}>
                <span className={styles.k}>{text.upliftLabel}</span>
                <span className={styles.upTot} data-testid="uplift-total">
                  +{yen(view.uplift.total)}
                </span>
              </p>
              <UpRows view={view} />
            </div>
          </section>
          <section className={styles.jcard} aria-labelledby="j2">
            <div className={styles.meetTop}>
              <p className={styles.jlabel} id="j2" style={{ margin: 0 }}>
                <i>2</i>
                {text.judge2}
              </p>
              <span className={`${styles.verdict} ${verdictClass}`} data-testid="verdict">
                {verdictText(level)}
              </span>
            </div>
            <div
              className={styles.meet}
              role="img"
              aria-label={`払える熱いファンの見込みは${expected}人、必要なのは${condition.need}人。${verdictText(level)}`}
            >
              <span
                className={styles.needMark}
                style={{ left: `${(condition.need / max) * 100}%` }}
              >
                <span>{needText(condition.need)}</span>
              </span>
              <div className={styles.track}>
                <i style={{ width: `${(expected / max) * 100}%` }} />
              </div>
              <span
                className={styles.expMark}
                style={{ left: `max(7.5em, ${(expected / max) * 100}%)` }}
              >
                {expectedText(expected)}
              </span>
            </div>
            <p className={styles.meetLegend} aria-hidden="true">
              <span>
                <i style={{ background: 'var(--primary)' }} />
                {text.legendExpected}
              </span>
              <span>
                <i style={{ background: 'var(--ink)', width: 3 }} />
                {text.legendNeed}
              </span>
            </p>
            {low && <p className={styles.meetShort}>{shortText(condition.need, view.shortfall)}</p>}
          </section>
        </div>
        <Scatter view={view} />
      </div>
      <div className={styles.judgeFoot}>
        <Adjust view={view} />
        <div className={styles.footBtns}>
          {condition.venue.simulatorVenueId === undefined ? (
            // シミュレーターに無い会場（RISE UP）は、入口を出さず注記だけ（押したあとに会場を探して迷わせない。D-21）
            <p className={styles.simNone}>{text.simulatorNone}</p>
          ) : (
            <a className={`${styles.btn} ${styles.secondary}`} href="/simulator.html">
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
          {low && (
            <p className={styles.ppNg} id="pp-ng">
              {text.proposalNg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
