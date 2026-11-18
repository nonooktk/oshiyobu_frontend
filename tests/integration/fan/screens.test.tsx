// ファン向けの画面ごとの確かめ（上層: A-17・A-29〜A-32・A-42・A-54・A-56・A-57・I-29・I-67・I-69・I-74・I-101・I-117・I-118）。
import { describe, expect, it, vi } from 'vitest';
import { PREFETCH_IMAGES, PREFETCH_PLAN } from '../../../src/fan/art/registry';
import { loadLayersChunk, loadPagesChunk } from '../../../src/fan/prefetch';
import { getAppStore } from '../../../src/fan/store/FanProvider';
import { App } from '../../../src/fan/App';
import { STORAGE_KEYS } from '../../../src/shared/device';
import { configurePrefetch } from '../../../src/shared/prefetch';
import { render } from '@testing-library/react';
import {
  act,
  cleanup,
  click,
  closeGiftAfterFx,
  layer,
  mountFan,
  openNextPage,
  fundAndApply,
  passStart,
  screen,
  tick,
  setupFanTest,
  within,
  joinFromPlans,
} from './helpers';

setupFanTest();

const settle = async (): Promise<void> => {
  await act(async () => {
    await vi.dynamicImportSettled();
  });
};
const bubbleText = (): string => document.querySelector('[class*="_bubble_"]')?.textContent ?? '';

// 人物 15 通り（`?p=1`〜`15`）の入口は残すが、ファン向けの初めの状態は全員同じ（統括の決定）:
// 推し ＝ Tech0サステナアイドル・市 ＝ 久留米市・口座なし・預金 0円・メイン口座は いいえ。
// core の人物のデータ（人物ごとの推し・市・預金）は、事務所向け・発表者用が使うので変えない（tests/unit/fan/persona-experience.test.ts）。
describe('人物 15 通り: どれで開いても、同じ初めの状態（I-67・A-56・A-57）', () => {
  it('範囲外・数字でない `?p=` は無視され、端末の番号から決まる人物で始まる。エラーは出ない（I-69）', () => {
    for (const bad of ['?p=0', '?p=16', '?p=abc', '?p=1.5', '?p=']) {
      cleanup();
      mountFan(bad);
      expect(screen.getByRole('heading', { name: '推しを選ぶ' })).toBeTruthy();
      expect(screen.queryByText(/エラー/)).toBeNull();
    }
  });

  it('同じ端末は、再読み込みしても同じ人物になる（人物の番号は保存せず、端末の番号から決まる。決定 6）', () => {
    mountFan('');
    const first = screen
      .getAllByRole('button', { pressed: true })
      .map((b) => b.getAttribute('aria-label'));
    expect(localStorage.length).toBe(1); // 残るのは端末の番号だけ
    expect(Object.keys(localStorage)).toEqual(['oshiyobu.v1.device']);
    document.body.innerHTML = '';
    mountFan('');
    const second = screen
      .getAllByRole('button', { pressed: true })
      .map((b) => b.getAttribute('aria-label'));
    expect(second).toEqual(first);
  });

  it('呼ぶ市は、どの人物・どの推しでも久留米市（?p=11 でも熊本市にならない。I-71）', () => {
    mountFan('?p=11');
    click('次へ');
    expect(screen.queryByText(/熊本市/)).toBeNull();
    expect(screen.getByText(/会場: 久留米シティプラザ Cボックス/)).toBeTruthy();
  });
});

describe('推しの口調（A-42）', () => {
  const MARK: [string, string, RegExp][] = [
    ['tech0', 'Tech0サステナアイドル', /カマヤーン[\s\S]*参加ありがとう/],
    ['krs48', 'KRS48', /えへへ/],
    ['riji', 'りじちょーといっしょだよ。', /あれっす！ありがとうっす！/],
    ['terao', 'てらお少年', /参加ありがとう/],
    ['heisei', '平成の俺', /サンキュー/],
  ];
  it.each(MARK)(
    '%s は、組ごとの口調でホームのコメントを出す（どの人物でも同じ。推しは、はじめの画面で選ぶ）',
    (_id, name, re) => {
      mountFan('?p=4');
      click(name);
      click('次へ');
      joinFromPlans();
      fundAndApply();
      expect(bubbleText()).toMatch(re);
    },
  );
});

describe('すべての画面に札「デモ用の架空データ」が出る（A-54・I-101）', () => {
  it('はじめの画面 2 つ・ホーム・次のアクション・メニューと詳細の 7 画面', async () => {
    mountFan('?p=4');
    const badge = () => screen.getAllByText('デモ用の架空データ').length;
    expect(badge()).toBe(1);
    click('次へ');
    expect(badge()).toBe(1);
    joinFromPlans();
    fundAndApply();
    expect(badge()).toBe(1);
    await closeGiftAfterFx();
    openNextPage(); // ホームの主のボタンは行動そのもの。いまできること の一覧は、ストアの操作で開く
    expect(badge()).toBe(1);
    click('‹ ホーム');
    click('メニュー');
    await settle();
    expect(badge()).toBe(1);
    for (const title of [
      '貢献',
      '口座と預金',
      'プラン',
      '支援の状況',
      'しくみ',
      '推しの変更',
      '情報の扱い',
    ]) {
      click(new RegExp(`^${title}`));
      await settle();
      expect(badge(), title).toBe(1);
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeTruthy();
      click('‹ メニュー');
    }
  });

  it('C-06 下から出るシート（引き継ぎ・申し込みをやめる確認）の中にも札が出る。後ろの画面が下へスクロールされていても見える', async () => {
    mountFan('?p=4');
    passStart();
    await closeGiftAfterFx();
    click('メニュー');
    await settle();
    click('参加をやめる');
    await settle();
    const cancel = layer('sheet') as HTMLElement;
    expect(within(cancel).getByRole('heading', { name: '参加をやめますか？' })).toBeTruthy();
    expect(within(cancel).getAllByText('デモ用の架空データ')).toHaveLength(1);
    click('やめない（戻る）');
    await settle();

    click(/^推しの変更/);
    await settle();
    click('KRS48');
    click('この条件に変える（デモ用）');
    await settle();
    const carry = layer('sheet') as HTMLElement;
    expect(within(carry).getByRole('heading', { name: '引き継いだもの' })).toBeTruthy();
    expect(within(carry).getAllByText('デモ用の架空データ')).toHaveLength(1); // 「デモ用の操作」の札とは別
    expect(within(carry).getByText('デモ用の操作')).toBeTruthy();
  });
});

describe('遅れて読む画面と、受け皿（I-119・I-121・I-103）', () => {
  it('メニュー配下の塊が読めないあいだも、枠（札・戻る・見出し）は出て、白い画面にならない。読めたら中身が埋まる', async () => {
    let fail = true;
    configurePrefetch({
      images: PREFETCH_IMAGES,
      plan: PREFETCH_PLAN,
      chunks: {
        'fan-pages': () => (fail ? Promise.reject(new Error('読めない')) : loadPagesChunk()),
        'fan-layers': loadLayersChunk,
      },
    });
    mountFan('?p=4');
    passStart();
    await closeGiftAfterFx();
    click('メニュー');
    await tick(10);
    expect(screen.getByRole('heading', { level: 2, name: 'メニュー' })).toBeTruthy(); // 枠
    expect(screen.getByRole('button', { name: '‹ ホーム' })).toBeTruthy(); // 操作が残る
    expect(screen.getByText('デモ用の架空データ')).toBeTruthy();
    expect(screen.queryByText('くわしく')).toBeNull(); // 中身は空のまま。エラーの文言は出さない
    expect(screen.queryByText(/エラー|失敗/)).toBeNull();
    fail = false;
    await tick(8000); // 失敗のあと、2・4 秒と間隔を空けて、自動で再試行する
    await settle();
    expect(screen.getByText('くわしく')).toBeTruthy();
  });

  it('やめる確認の塊が読めないあいだも、枠と「戻る」は出る', async () => {
    let fail = true;
    configurePrefetch({
      images: PREFETCH_IMAGES,
      plan: PREFETCH_PLAN,
      chunks: {
        'fan-pages': loadPagesChunk,
        'fan-layers': () => (fail ? Promise.reject(new Error('読めない')) : loadLayersChunk()),
      },
    });
    mountFan('?p=4');
    passStart();
    await closeGiftAfterFx();
    click('メニュー');
    await settle();
    click('参加をやめる');
    expect(screen.getByRole('heading', { name: '参加をやめますか？' })).toBeTruthy();
    expect(
      within(layer('sheet') as HTMLElement).getByRole('button', { name: '戻る' }),
    ).toBeTruthy();
    fail = false;
    // 失敗のあと、2・4 秒と間隔を空けて、自動で再試行する（待ちと読み込みを、少しずつ進める）
    for (let i = 0; i < 5; i++) {
      await tick(2000);
      await settle();
    }
    expect(
      within(layer('sheet') as HTMLElement).getByRole('button', { name: 'やめない（戻る）' }),
    ).toBeTruthy();
  });

  it('ルートの受け皿が中身を作り直しても、状態（申し込み・人数）は残る（ストアは React の外にある）', async () => {
    mountFan('?p=4');
    passStart();
    await closeGiftAfterFx();
    cleanup();
    render(<App />); // 作り直し（再読み込みではない）
    expect(getAppStore().view().status.supporters).toBe(75); // 内部の人数は、ストアの状態で確かめる
    expect(screen.getByRole('img', { name: /^開催熱量。FEVER 目前/ })).toBeTruthy();
  });

  it('操作のあとの localStorage のキーは、端末の番号だけ（I-103）。「情報の扱い」の一覧も、同じ数のキーから作る', async () => {
    mountFan('?p=4');
    passStart();
    await closeGiftAfterFx();
    click('メニュー');
    await settle();
    click(/^情報の扱い/);
    await settle();
    expect(
      Object.keys(localStorage).every((k) => (STORAGE_KEYS as readonly string[]).includes(k)),
    ).toBe(true);
    expect(screen.getAllByText('この端末に残ります')).toHaveLength(STORAGE_KEYS.length);
    expect(
      screen.getByText(
        /送るのは、参加の合図（公演の指定を含む）と端末の番号だけです。個人の情報は送りません。/,
      ),
    ).toBeTruthy();
    // 共有ボタンは、押すと投稿したことになるだけで、投稿文を外へ送らない（コピーもしない）
    expect(
      screen.getByText(
        /共有ボタンを押しても、投稿文は外へ送りません。押すと投稿したことになるだけです。/,
      ),
    ).toBeTruthy();
  });
});
