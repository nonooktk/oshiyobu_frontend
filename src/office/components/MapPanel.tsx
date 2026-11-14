import { CITIES, colorStep, metricValues, radiusOf } from '../../core';
import type { CSSProperties } from 'react';
import { CITY_POS, MAP_VIEWBOX, RAMPS } from '../map/layout';
import { PREF_SHAPES } from '../map/shapes';
import styles from '../office.module.css';
import { useOffice } from '../store';
import { text } from '../text/labels';

const LEGEND_STEPS = [20000, 5000, 1000] as const;

function Legend() {
  const cx = 54;
  const base = 566;
  const first = radiusOf(LEGEND_STEPS[0]);
  return (
    <g aria-hidden="true">
      <text className={styles.legT} x={8} y={base - 2 * first - 16}>
        {text.legendTitle}
      </text>
      {LEGEND_STEPS.map((n) => {
        const r = radiusOf(n);
        const top = base - 2 * r;
        return (
          <g key={n}>
            <circle className={styles.legC} cx={cx} cy={base - r} r={r} />
            <line className={styles.legL} x1={cx} y1={top} x2={cx + 50} y2={top} />
            <text className={styles.legT} x={cx + 56} y={top + 4}>
              {n.toLocaleString('ja-JP')}人
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** 地図: 丸の大きさは登録者数（面積）、濃さは選んだ指標。9 つの市の丸を押すと、その市を選べる */
export function MapPanel() {
  const artistId = useOffice((s) => s.artistId);
  const metric = useOffice((s) => s.metric);
  const city = useOffice((s) => s.city);
  const setMetric = useOffice((s) => s.setMetric);
  const pickCity = useOffice((s) => s.pickCity);
  const focusVenues = useOffice((s) => s.focusVenues);
  const regs = metricValues(artistId, 'reg');
  const hots = metricValues(artistId, 'hot');
  const values = metric === 'reg' ? regs : hots;
  // 大きい丸を先に（下に）、小さい丸を後に（上に）描く。近い丸の押せる範囲は、小さい丸が上になる
  const order = CITIES.map((_, i) => i).sort((a, b) => (regs[b] ?? 0) - (regs[a] ?? 0));
  return (
    <div className={styles.mapCol}>
      <div className={styles.segRow}>
        <div
          className={`${styles.seg} ${metric === 'hot' ? styles.segHot : ''}`}
          role="group"
          aria-label={text.metricGroup}
        >
          <button type="button" aria-pressed={metric === 'reg'} onClick={() => setMetric('reg')}>
            {text.metricReg}
          </button>
          <button
            type="button"
            className={styles.hotOn}
            aria-pressed={metric === 'hot'}
            onClick={() => setMetric('hot')}
          >
            {text.metricHot}
          </button>
        </div>
        {metric === 'hot' && <span className={styles.formula}>{text.formula}</span>}
      </div>
      <div className={styles.mapWrap}>
        <svg
          viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
          role="group"
          aria-labelledby="map-title"
        >
          <title id="map-title">{text.mapTitle}</title>
          <g aria-hidden="true">
            {PREF_SHAPES.map((shape, i) =>
              shape.tag === 'polygon' ? (
                <polygon key={i} className={styles.pref} points={shape.points} />
              ) : shape.tag === 'ellipse' ? (
                <ellipse
                  key={i}
                  className={styles.pref}
                  cx={shape.cx}
                  cy={shape.cy}
                  rx={shape.rx}
                  ry={shape.ry}
                />
              ) : (
                <circle key={i} className={styles.pref} cx={shape.cx} cy={shape.cy} r={shape.r} />
              ),
            )}
          </g>
          <Legend />
          <g>
            {order.map((i) => {
              const data = CITIES[i];
              if (data === undefined) return null;
              const { x, y, pos } = CITY_POS[data.name];
              const reg = regs[i] ?? 0;
              const value = values[i] ?? 0;
              const r = radiusOf(reg);
              const fill = `var(${RAMPS[metric][colorStep(values, value)]})`;
              const [lx, ly] =
                pos === 'r'
                  ? [x + r + 5, y - 2]
                  : pos === 'l'
                    ? [x - r - 5, y - 2]
                    : [x, y + r + 19];
              const anchor = pos === 'l' ? 'end' : pos === 'r' ? 'start' : 'middle';
              const selected = city === data.name;
              const choose = () => pickCity(data.name);
              return (
                <g
                  key={data.name}
                  className={`${styles.cityHit} ${selected ? styles.selected : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected}
                  aria-label={`${data.name}を選ぶ。登録者 ${reg.toLocaleString('ja-JP')}人、払える熱量 ${hots[i] ?? 0}`}
                  onClick={choose}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      choose();
                      focusVenues(); // キーボードで選んだときは、会場の先頭へフォーカスを移す（SP-03）
                    }
                  }}
                >
                  <circle className={styles.hit} cx={x} cy={y} r={Math.max(r + 4, 26)} />
                  <circle className={styles.selRing} cx={x} cy={y} r={r + 5} />
                  <circle className={styles.focusRing} cx={x} cy={y} r={r + 8} />
                  <circle
                    className={styles.cityDot}
                    cx={x}
                    cy={y}
                    r={r}
                    style={{ fill } as CSSProperties}
                  />
                  <circle className={styles.cityRing} cx={x} cy={y} r={r} />
                  <text
                    className={styles.cityLabel}
                    aria-hidden="true"
                    textAnchor={anchor}
                    transform={`translate(${lx.toFixed(1)} ${ly.toFixed(1)})`}
                  >
                    <tspan x={0} dy={0}>
                      {data.name}
                    </tspan>
                    <tspan className={styles.v} x={0} dy="1.25em">
                      {metric === 'reg' ? `${value.toLocaleString('ja-JP')}人` : String(value)}
                    </tspan>
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
