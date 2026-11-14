import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { RECRUITMENT_DEADLINE, costItems } from '../../core';
import { DemoBadge } from '../../shared/components/DemoBadge';
import styles from '../office.module.css';
import { useOffice } from '../store';
import { ARTIST_TEXT } from '../text/artists';
import { COST_LABELS, ruleText, text, warnText, yen } from '../text/labels';
import { venueById } from '../../core';
import type { OfficeView } from '../view';
import { Avatar } from './ArtistBar';
import { UpRows } from './Judge';

/**
 * 重ねて出す枠。開いたら、閉じるボタンへ移り、Esc・外側の押下・閉じるで閉じる。閉じたら、押した場所へ戻す。
 * 暗幕の上の操作は、枠の中だけ（Tab は枠の中で回る）。
 * 開いたときのフォーカス移動は、枠をスクロールさせない（preventScroll）。閉じるは枠の下端にあり、
 * 既定のままだと枠が下へ送られて、見出し・札「デモ用の架空データ」が上へ隠れる（C-01）
 */
function Modal({
  labelId,
  onClose,
  children,
}: {
  readonly labelId: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'Tab' && panel.current) {
        const items = [
          ...panel.current.querySelectorAll<HTMLElement>('button, a[href], input, [tabindex="0"]'),
        ];
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, [onClose]);
  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        ref={panel}
      >
        {children}
      </div>
    </div>
  );
}

/** 提案の 1 枚（札が「低」のときは開かない）。数字は core から。内訳 5 項目・上乗せ・成立の条件・募集期限 */
export function Proposal({ view }: { readonly view: OfficeView }) {
  const closeModal = useOffice((s) => s.closeModal);
  const artistId = useOffice((s) => s.artistId);
  const city = useOffice((s) => s.city);
  const { condition } = view;
  const rule = ruleText(condition.line, condition.min);
  return (
    <Modal labelId="pp-title" onClose={closeModal}>
      <div className={styles.ppHead}>
        <Avatar artist={ARTIST_TEXT[artistId]} />
        <div>
          <div className={styles.kick}>
            {text.proposalKick} <DemoBadge />
          </div>
          <h2 id="pp-title">
            {ARTIST_TEXT[artistId].name}の{city}公演
          </h2>
        </div>
      </div>
      <div className={styles.ppBody}>
        <p className={styles.ppRule}>{text.proposalRule}</p>
        <dl className={styles.ppGrid}>
          <div>
            <dt>{text.lineLabel}</dt>
            <dd data-testid="pp-line">
              {condition.need}人・{yen(condition.line)}
            </dd>
          </div>
          <div>
            <dt>{text.deadlineLabel}</dt>
            <dd>{RECRUITMENT_DEADLINE}</dd>
          </div>
          <div className={styles.wide}>
            <dt>{text.ruleLabel}</dt>
            <dd data-testid="pp-rule">
              {rule.before}
              <b>{rule.line}</b>
              {rule.middle}
              <b>{rule.min}</b>
              {rule.after}
              <small>最低人数は、事務所と相談して決めた値です。</small>
              {view.gapYen !== null && (
                <small className={styles.warn}>{warnText(view.gapYen)}</small>
              )}
            </dd>
          </div>
        </dl>
        <div className={styles.ppCost}>
          <div className={styles.k}>{text.costBreakdown}</div>
          <ul className={styles.upRows} data-testid="pp-cost">
            {costItems(condition.costs).map((item) => (
              <li key={item.id}>
                <span className={styles.n}>{COST_LABELS[item.id]}</span>
                <span className={styles.p} style={{ color: 'var(--ink)' }}>
                  {yen(item.yen)}
                </span>
              </li>
            ))}
            <li>
              <span className={styles.n}>{text.total}</span>
              <span className={styles.p} style={{ color: 'var(--ink)' }}>
                {yen(condition.line)}
              </span>
            </li>
          </ul>
        </div>
        <div className={styles.ppUp}>
          <div className={styles.k}>{text.upliftLabel}</div>
          <div data-testid="pp-uplift">
            <UpRows view={view} />
          </div>
          <div className={styles.ppUpTot}>
            <span className={styles.k}>{text.total}</span>
            <span className={styles.plus} data-testid="pp-uplift-total">
              +{yen(view.uplift.total)}
            </span>
          </div>
        </div>
        <p className={styles.ppClose}>
          <span>{text.proposalClose}</span>
        </p>
        <div className={styles.ppFoot}>
          <button
            type="button"
            className={`${styles.btn} ${styles.secondary} ${styles.sm}`}
            data-autofocus
            onClick={closeModal}
          >
            {text.close}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** 情報の扱い: 保存している項目（いまの内容）・保存先・最初の状態に戻す方法。事務所向けは何も送らない */
export function Privacy() {
  const closeModal = useOffice((s) => s.closeModal);
  const artistId = useOffice((s) => s.artistId);
  const metric = useOffice((s) => s.metric);
  const city = useOffice((s) => s.city);
  const venueId = useOffice((s) => s.venueId);
  const costs = useOffice((s) => s.costs);
  return (
    <Modal labelId="priv-title" onClose={closeModal}>
      <div className={styles.privHead}>
        <h2 id="priv-title">{text.privacy}</h2>
        <DemoBadge />
      </div>
      <div className={styles.privBody}>
        <svg className={styles.privFig} viewBox="0 0 300 120" role="img" aria-label={text.privFig}>
          <rect className={styles.out} x={6} y={6} width={288} height={108} rx={8} />
          <rect className={styles.box} x={22} y={26} width={120} height={68} rx={8} />
          <text x={82} y={56} textAnchor="middle">
            この端末
          </text>
          <text className={styles.sub} x={82} y={78} textAnchor="middle">
            選んだ内容
          </text>
          <line className={styles.ln} x1={150} y1={60} x2={196} y2={60} />
          <line className={styles.ln} x1={196} y1={48} x2={196} y2={72} />
          <text x={246} y={56} textAnchor="middle">
            外へは
          </text>
          <text x={246} y={78} textAnchor="middle">
            送らない
          </text>
        </svg>
        <div>
          <h3>{text.privItems}</h3>
          <ul data-testid="priv-items">
            <li>アーティスト: {ARTIST_TEXT[artistId].name}</li>
            <li>地図の指標: {metric === 'hot' ? text.metricHot : text.metricReg}</li>
            <li>選んだ市: {city ?? text.none}</li>
            <li>選んだ会場: {venueId === null ? text.none : venueById(venueId).name}</li>
            <li>
              「条件を調整」の費用の入力値:{' '}
              {venueId === null
                ? text.noneCost
                : (Object.keys(COST_LABELS) as (keyof typeof COST_LABELS)[])
                    .map((id) => `${COST_LABELS[id]} ${yen(costs[id])}`)
                    .join('・')}
            </li>
          </ul>
        </div>
        <div>
          <h3>{text.privWhere}</h3>
          <p>{text.privWhereBody}</p>
        </div>
        <div>
          <h3>{text.privReset}</h3>
          <p>{text.privResetBody}</p>
          <p style={{ marginTop: 'var(--s2)', color: 'var(--ink-soft)' }}>{text.privResetNote}</p>
        </div>
        <div className={styles.ppFoot}>
          <button
            type="button"
            className={`${styles.btn} ${styles.secondary} ${styles.sm}`}
            data-autofocus
            onClick={closeModal}
          >
            {text.close}
          </button>
        </div>
      </div>
    </Modal>
  );
}
