// 新しい流れの通し（統括の決定。ビズ側の要望を含む）:
//   推しを選ぶ → コースを選ぶ（市の選択は無い。久留米市に固定）→ ホーム
//   ①推し活定期をはじめる → ②預金を積み増す（自由な額）→ ③申し込む → ④仲間を呼ぶ → ⑤仲間に知らせる
// 初めは口座なし・預金 0円（全人物で同じ）。内部の数字は、画面の文ではなく、ストアの状態で確かめる（74 → 75 → 93・成立）。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { harness, passStartOnly } from './helpers';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('はじめから成立まで、主のボタンの 1 つずつで進む（基準の公演 tech0:cbox）', () => {
  it('閉じる・5 分・リセットで、初めの状態（口座なし・預金 0円・はじめの画面）に戻る', () => {
    for (const back of [
      (h: ReturnType<typeof harness>) => h.a.resetFan(),
      (h: ReturnType<typeof harness>) => h.a.resetFanQuiet(),
      (h: ReturnType<typeof harness>) => void h.a.resetForIdle(),
    ]) {
      const h = harness(4, { solo: true });
      passStartOnly(h);
      h.a.homePrimary();
      h.a.runAcct('deposit', 'home', 20_000);
      back(h);
      expect(h.state()).toMatchObject({ page: 'start', course: null, aim: null });
      expect(h.state().acct).toEqual({ pay: false, deposit: 0, times: 0 });
      expect(h.state().done).toEqual({});
    }
  });
});
