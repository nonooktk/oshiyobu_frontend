// 条件の帯（要件 R-15・受け入れ V-10。仕様 1.4）。推しの帯の下の 2 行目に、条件を変える入力をまとめる。
// - 境目（預金額・熱量のスライダーと数字の入力）: ⑥ から移した。初めの位置に戻すは、結果の横（⑥）に残す
// - ② 集まる人数: 2026-11-18 に、① 地図の下へ移した（docs/office/要件.md の M-02。App.tsx と CrowdField.tsx）
// - 条件を調整（費用・最低人数）は、⑤ に残す（既存のテスト I-07 が、費用の入力の知らせを、判定の区画の中で探すため。
//   担当者の決定。R-15 は一部）
// 境目は、これまでどおり、会場を選んで判定が出てから出す。帯の行の高さは、会場を選ぶ前から確保する
// （会場を選んだときに、下の見出しが動かないように）
import styles from '../office.module.css';
import { bandText } from '../text/labels';
import type { OfficeView } from '../view';
import { QuadControls } from './QuadControls';

export function ConditionBand({ view }: { readonly view: OfficeView | null }) {
  return (
    <div className={styles.condBand} data-testid="cond-band">
      <span className={styles.artistLabel}>{bandText.label}</span>
      {view !== null && <QuadControls />}
    </div>
  );
}
