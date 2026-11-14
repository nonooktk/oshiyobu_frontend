// G-08 の歯止め（docs/守ること.md「予定」→ 有効にするための検査）。ファン向けの画面の文と読み上げ用の文に、
// 人数・割合・最低人数・達成率・到達ライン・目標の金額が出ない。出してよい数字は、自分が払うコースの金額・預金・席数・日付・特典の n/3・ステップの 1 / 3 だけ。
// 巡回する画面: はじめの画面 3 つ・ホーム（申し込む前・後・FEVER。主のボタンと副のボタン）・演出（申し込み・投稿・届いた！・ゲージが伸びている最中・FEVER の瞬間・仲間に知らせる）・共有のシート・やめる確認・メニューの下の全画面。推し 5 組（人物 4・10・12・14・15）
// 起動条件: 巡回した場面の数が、決めた数以上であること（0 件で通る空振りを防ぐ）。
// 置き場: tests/guard/ に移すのは管理者（この PR では、決まりの文書と guard を変えないため、通常のテストとして置く）。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setMeterEngineForTest } from '../../../src/shared/meter';
import { createMeterEngine } from '../../../src/shared/meter/engine';
import {
  act,
  btn,
  click,
  fireEvent,
  layer,
  mountFan,
  openNextPage,
  screen,
  setupFanTest,
  tick,
  within,
} from './helpers';

setupFanTest();

/** 画面に出してはいけない言い方（G-08）。「円」を伴う金額・席数・日付・n/3・1 / 3 は対象外 */
const FORBIDDEN: [string, RegExp][] = [
  ['数字＋人', /[0-9０-９]\s*人/],
  ['数字＋%', /[0-9０-９]\s*[%％]/],
  ['最低人数', /最低人数/],
  ['達成率', /達成率/],
  ['到達ライン', /到達ライン/],
  ['目標の金額', /目標の金額/],
  ['支援者', /支援者/],
  // 「あと 10,000円」は自分の預金の不足額（自分の金額）なので許す。人数・割合の「あと 18」「あと 5%」は止める
  ['あと＋数字', /あと\s*[0-9０-９](?![0-9０-９,]*\s*円)/],
];

/** 要素の文字と、読み上げ用の属性（aria-label・title・alt）を集める */
function collect(root: ParentNode = document.body): string {
  const parts = [(root as HTMLElement).textContent ?? ''];
  root
    .querySelectorAll('[aria-label],[title],[alt]')
    .forEach((el) =>
      parts.push(
        el.getAttribute('aria-label') ?? '',
        el.getAttribute('title') ?? '',
        el.getAttribute('alt') ?? '',
      ),
    );
  return parts.join('\n');
}

const settle = async (): Promise<void> => {
  await act(async () => {
    await vi.dynamicImportSettled();
  });
};

const PERSONAS: [number, string][] = [
  [4, 'tech0'],
  [10, 'krs48'],
  [12, 'riji'],
  [14, 'terao'],
  [15, 'heisei'],
];

describe('ファン向けの画面に、人数・達成率・目標の金額の数字が出ない（G-08）', () => {
  beforeEach(() => {
    setMeterEngineForTest(createMeterEngine({ apiBase: '', random: () => 0.5 }));
  });

  it.each(PERSONAS)('人物 %i（%s）の通し', async (no) => {
    const seen: { scene: string; text: string }[] = [];
    const look = (scene: string, root?: ParentNode) => seen.push({ scene, text: collect(root) });

    mountFan(`?p=${no}`);
    look('はじめの画面 1/3');
    click('次へ');
    look('はじめの画面 2/3');
    click('次へ');
    look('はじめの画面 3/3');
    const go =
      screen.queryByRole('button', { name: 'この内容で申し込む' }) ??
      btn('このコースを目指して始める');
    const canApply = go.textContent === 'この内容で申し込む';
    fireEvent.click(go);
    look('ホーム（申し込む前または直後）');
    await tick(700);
    const fx = layer('fx');
    if (fx) look('演出', fx);
    await tick(2600);
    if (layer('gift')) {
      look('特典の絵', layer('gift') as HTMLElement);
      fireEvent.click(within(layer('gift') as HTMLElement).getByRole('button', { name: '閉じる' }));
    }
    look('ホーム（主のボタンが見える）');
    openNextPage(); // いまできること の一覧（ホームからは移らない。ストアの操作で開く）
    look('次のアクション');
    click('‹ ホーム');
    if (canApply) {
      // 副のボタン → 共有のシート → 投稿した直後の称賛 → 特典 2/3
      click(/^SNSに投稿する（任意）/);
      look('共有のシート', layer('share') as HTMLElement);
      fireEvent.click(btn('X'));
      look('投稿の称賛の演出', layer('fx') as HTMLElement);
      await tick(2600 + 2300);
      if (layer('gift'))
        fireEvent.click(
          within(layer('gift') as HTMLElement).getByRole('button', { name: '閉じる' }),
        );
      fireEvent.click(
        within(layer('share') as HTMLElement).getByRole('button', { name: '閉じる' }),
      );
      look('ホーム（投稿したあと）');
      // 主のボタン「仲間を呼ぶ」→ 届いた！（ゲージが伸びている最中）→ FEVER の瞬間 → 特典 3/3
      fireEvent.click(screen.getByRole('button', { name: /^仲間を呼ぶ/ }));
      look('「届いた！」の演出', layer('fx') as HTMLElement);
      look('ゲージが伸びている最中のホーム');
      await tick(2600);
      const reached = layer('fx');
      if (reached) look('FEVER の瞬間の演出', reached);
      await tick(3600 + 2300);
      if (layer('gift'))
        fireEvent.click(
          within(layer('gift') as HTMLElement).getByRole('button', { name: '閉じる' }),
        );
      if (layer('thanks')) {
        look('感謝のメッセージ', layer('thanks') as HTMLElement);
        fireEvent.click(within(layer('thanks') as HTMLElement).getByRole('button'));
      }
      look('ホーム（FEVER のあと）');
      // 主のボタン「仲間に知らせる」→ 短い称賛
      fireEvent.click(screen.getByRole('button', { name: /^仲間に知らせる/ }));
      look('仲間に知らせるの称賛の演出', layer('fx') as HTMLElement);
      await tick(2600 + 10);
    } else {
      // 預金が足りない人物: 主のボタン「預金を積み増す」→ 口座と預金の画面
      fireEvent.click(screen.getByRole('button', { name: /^預金を積み増す/ }));
      await settle();
      look('口座と預金（主のボタンから）');
      click('‹ ホーム');
    }
    look('ホーム（FEVER のあと、または申し込む前）');
    click('メニュー');
    await settle();
    look('メニュー');
    for (const title of [
      '貢献',
      '応援コース',
      '口座と預金',
      '支援の状況',
      'しくみ',
      '推し・条件の変更',
      '情報の扱い',
    ]) {
      click(new RegExp(`^${title}`));
      await settle();
      look(`メニュー › ${title}`);
      click('‹ メニュー');
    }
    if (canApply) {
      click('申し込みをやめる');
      await settle();
      look('やめる確認のシート', layer('sheet') as HTMLElement);
    }

    // 巡回した場面の数（空振りの防止）
    expect(seen.length).toBeGreaterThanOrEqual(canApply ? 27 : 16);
    const violations = seen.flatMap(({ scene, text }) =>
      FORBIDDEN.filter(([, re]) => re.test(text)).map(
        ([name, re]) => `${scene}: 「${name}」 ${text.match(re)?.[0] ?? ''}`,
      ),
    );
    expect(
      violations,
      'G-08 に反しています（ファン向けに、人数・達成率・目標の金額を出さない）',
    ).toEqual([]);
  });

  it('この検査は、数字を見つけられる（見張りが働いている）', () => {
    const bad = [
      'あと18人',
      '達成率 80%',
      '最低人数 93人',
      '到達ライン 650,000円',
      '支援者 75人',
      '目標の金額',
    ];
    for (const text of bad)
      expect(
        FORBIDDEN.some(([, re]) => re.test(text)),
        text,
      ).toBe(true);
    const ok = [
      '特典 1/3',
      '1 / 3',
      '7,000円',
      '会場の席数（144席）まで',
      '2026年12月20日',
      '開催熱量。FEVER 目前。あと一歩',
    ];
    for (const text of ok)
      expect(
        FORBIDDEN.some(([, re]) => re.test(text)),
        text,
      ).toBe(false);
  });
});
