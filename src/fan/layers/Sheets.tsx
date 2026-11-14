// あとから読む層の中身（設計 D-40 の fan-layers）: 申し込みをやめる確認（SP-51）と、引き継ぎ（SP-25）。
// 枠（背景・見出し・閉じる）は、読み込み前から出ている（components/SheetShell）。
import { useEffect, useRef } from 'react';
import { ACT_IDS } from '../domain/state';
import { heatOf } from '../domain/heat';
import { ACT_NAMES } from '../text/ui';
import { yen } from '../text/format';
import fan from '../fan.module.css';
import { useFan } from '../store/FanProvider';
import pages from '../pages/pages.module.css';
import { DepositCard } from '../pages/DepositCard';

/** 申し込みをやめる確認。戻る金額と、残るもの。成立後・未申し込みは「戻る」だけ。 */
export function CancelBody() {
  const { state, view, actions } = useFan();
  const { status, cond, my } = view;
  const no = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    no.current?.focus({ preventScroll: true });
  }, []);
  const held = my?.price ?? 0;
  // やめたあとの熱量（数字は出さず、段階の名前で伝える）
  const after = view.joined
    ? heatOf({ supporters: status.supporters - 1, established: false }, cond.min)
    : view.heat;
  return (
    <>
      <p className={pages.plain} style={{ margin: 0 }}>
        {!view.joined
          ? 'いまは申し込んでいないので、やめるものはありません。負担は0円です。'
          : status.established
            ? '成立したあとの取り消しは、今後の対応範囲です。'
            : '成立前なので、確保しているお金は解除されます。負担は0円になります。'}
      </p>
      <p className={pages.subH}>戻る金額</p>
      <dl className={pages.facts}>
        <dt>確保額</dt>
        <dd className={fan.num}>
          {yen(held)}
          {my ? `（${my.name}）` : ''}
        </dd>
        <dt>戻る金額</dt>
        <dd className={fan.num}>{yen(held)}（確保を解除）</dd>
        <dt>負担</dt>
        <dd className={fan.num}>0円</dd>
        <dt>開催熱量</dt>
        <dd>
          {view.heat.name} → {after.name}
        </dd>
      </dl>
      <p className={pages.subH}>残るもの</p>
      <dl className={pages.facts}>
        <dt>開いた特典</dt>
        <dd>{view.giftCount} / 3</dd>
        <dt>達成した行動</dt>
        <dd>
          {view.doneCount} / {ACT_IDS.length}
        </dd>
        <dt>仲間を呼んだか</dt>
        <dd>{state.called > 0 ? '呼びました' : 'まだです'}</dd>
      </dl>
      <div className={fan.sheetBtns}>
        <button
          ref={no}
          type="button"
          className={`${fan.btn} ${fan.btnFull}`}
          onClick={actions.closeCancel}
        >
          {view.joined && !status.established ? 'やめない（戻る）' : '戻る'}
        </button>
        {view.joined && !status.established ? (
          <button
            type="button"
            className={`${fan.btn} ${fan.btnFull} ${pages.danger}`}
            onClick={actions.doCancel}
          >
            申し込みをやめる
          </button>
        ) : null}
      </div>
    </>
  );
}

/** 引き継いだもの（条件を変えた直後）。 */
export function CarryBody() {
  const { state, actions } = useFan();
  const c = state.carry;
  const ok = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ok.current?.focus({ preventScroll: true });
  }, []);
  if (!c) return null;
  return (
    <>
      <p className={pages.plain} style={{ margin: 0 }}>
        {c.oshiName}を{c.city}に呼ぶ条件に変えました。次のものを引き継ぎました。
      </p>
      <p className={pages.demoLine}>
        <span className={pages.demoChip}>デモ用の操作</span>
        実際は、決済が通った時点で確定します
      </p>
      <dl className={`${pages.facts} ${pages.factsV}`} style={{ marginTop: 'var(--s2)' }}>
        <dt>開いた特典</dt>
        <dd>{c.gifts} / 3</dd>
        <dt>達成した行動</dt>
        <dd>
          {c.doneCount} / {ACT_IDS.length}（
          {c.doneNames.map((id) => ACT_NAMES[id]).join('・') || 'なし'}）
        </dd>
        <dt>仲間を呼んだか</dt>
        <dd>{c.called > 0 ? '呼びました' : 'まだです'}</dd>
        <dt>口座の設定（擬似）</dt>
        <dd>
          預金 {yen(c.deposit)}・メイン口座 {c.pay ? 'はい' : 'いいえ'}
        </dd>
      </dl>
      <p className={pages.subH}>取り直すもの</p>
      <dl className={`${pages.facts} ${pages.factsV}`}>
        <dt>確保額</dt>
        <dd>
          {yen(c.held)} → 0円（申し込み直すと、新しい条件の{yen(c.seatPrice)}で取り直します）
        </dd>
        <dt>公演の開催熱量</dt>
        <dd>
          「{c.heatName}」から（{c.venueName}）
        </dd>
      </dl>
      <div className={fan.sheetBtns}>
        <button
          ref={ok}
          type="button"
          className={`${fan.btn} ${fan.btnFull}`}
          onClick={actions.closeCarry}
        >
          ホームへ
        </button>
      </div>
    </>
  );
}

/** 預金を積み増す額の入力（ホームの主のボタン・次のアクションから開く）。条件に届くと、自動で閉じる。 */
export function DepositBody() {
  const { actions } = useFan();
  return (
    <>
      <DepositCard title="預金を積み増す" desc="積み増す額を決めます。" primary />
      <div className={fan.sheetBtns}>
        <button
          type="button"
          className={`${fan.btn} ${fan.btnFull}`}
          onClick={actions.closeDeposit}
        >
          閉じる
        </button>
      </div>
    </>
  );
}
