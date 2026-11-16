import type { ReactNode } from 'react';
import styles from '../office.module.css';
import { snapshotOfState, useOffice } from '../store';
import { changeLiveText, diffText, prevText } from '../text/labels';
import type { ChangeKey } from '../view';

// 変わった数字の強調（要件 R-14。仕様 2.2）。
// - 直前の操作で変わった数字だけ、背景を淡い色にして、約 2 秒で元に戻す（1 回だけ。点滅にしない。G-05）
// - 前の値を、隣に小さく残す（次に数字が変わるまで）。前の値は、data-testid の付いた要素の外に出す（既存のテストの文字を変えない）
// - 変わるたびに key を替えて、薄れていく動きを最初からやり直す
// - 前の値の字は aria-hidden。読み上げは、store.ts の知らせで伝える

interface Props {
  /** 強調の対象の数字の名前（view.ts の CHANGE_KEYS） */
  readonly k: ChangeKey;
  /** いまの値（前の値との差を出すため） */
  readonly now: number | string;
  readonly unit?: '' | '人' | '円';
  /** 前の値を「前 187人（−67）」で出すか、差だけ「−67」で出すか（狭い所は差だけ） */
  readonly short?: boolean;
  /** 中身が段落など（ブロック）のときは div で包む */
  readonly block?: boolean;
  readonly children: ReactNode;
}

/**
 * 変わった数字の読み上げ（画面には出さない）。操作ごとの知らせ（store.ts の live）とは別の枠で、
 * 「見込み 187人から 120人。」のように、前の値と今の値を伝える。変わった数字が無いときは空
 */
export function ChangeLive() {
  // 状態そのもの（変わるまで同じ参照）を受け取り、今の数字は描くときに出す（選ぶ関数で新しい物を作らない）
  const state = useOffice((s) => s);
  const { changes } = state;
  return (
    <p className="sr-only" aria-live="polite" data-testid="change-live">
      {/* 線を動かした変化は読み上げない（線の値と「いま呼べる」は、操作の知らせ（store の live）で伝える） */}
      {changes.byLine ? '' : changeLiveText(changes.keys, changes.prev, snapshotOfState(state))}
    </p>
  );
}

export function Changed({ k, now, unit = '', short = false, block = false, children }: Props) {
  const changes = useOffice((s) => s.changes);
  const prev = changes.prev;
  const Tag = block ? 'div' : 'span';
  // 変わっていないときは包まない（数字の要素の親を、変える前と同じに保つ。#24 の office-quad-big のテスト）
  // 線を動かした変化は、強調も「前」も出さない（4 枚のカードとも。#26 の統括の指摘 ②）
  if (prev === null || changes.byLine || !changes.keys.includes(k)) return <>{children}</>;
  const before = prev[k];
  return (
    <Tag key={changes.seq} className={styles.chg} data-changed="true">
      {children}
      <small className={styles.prevVal} aria-hidden="true" data-prev={k}>
        {short ? diffText(before, now) : prevText(before, now, unit)}
      </small>
    </Tag>
  );
}
