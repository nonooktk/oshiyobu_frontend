// 押すボタンの共通の決まり。Enter の押しっぱなし（キーのリピート）では、click が続けて起きて、2 段進んでしまう。
// リピートの keydown は、click を起こさないよう止める（最初の 1 回は止めない。Space は、キーを離したときに 1 回だけ click になる）。
import type { KeyboardEvent } from 'react';

export const noRepeat = (e: KeyboardEvent<HTMLElement>): void => {
  if (e.repeat) e.preventDefault();
};
