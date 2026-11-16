// G-08 の歯止め（docs/守ること.md）。ファン向けの画面の文と読み上げ用の文に、
// 人数・割合・最低人数・達成率・到達ライン・目標の金額が出ない。出してよい数字は、自分が払うコースの金額・預金・席数・日付・特典の n/3・ステップの 1 / 3 だけ。
// 巡回する画面: はじめの画面 2 つ・参加の確認・ホーム（参加の直後・預金でやること・SNSで広める／プランを上げる・各プラン）・演出（参加・広めた・プランを上げた）・預金でやることのページ・共有のシート・プランを上げるシート・特典の贈呈・次のアクション・やめる確認・メニューの下の全画面。推し 5 組（人物 4・10・12・14・15）
// 起動条件: 巡回した場面の数が、決めた数以上であること（0 件で通る空振りを防ぐ）。
// 置き場: tests/guard/（2026-11-14 に tests/integration/fan/ から移した。管理者の側だけが変える。ソースの語を見る検査は heat.test.ts）。
// 画面の部品は tests/integration/fan/ の helpers を使う（共有の部品は本物・サーバーだけ偽物）。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAppStore } from '../../src/fan/store/FanProvider';
import { setMeterEngineForTest } from '../../src/shared/meter';
import { createMeterEngine } from '../../src/shared/meter/engine';
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
} from '../integration/fan/helpers';

setupFanTest();

/** 落ちたときの文（tests/guard/helpers.ts の guardMessage と同じ形。この検査は画面を描くので、jsdom で動き、その部品を読み込めない） */
const guardMessage = (id: string, what: string): string =>
  `【${id} に反しています】${what}。直さずに、管理者（統括）へ相談してください（docs/守ること.md の ${id}）。`;

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

const OSHI_NAME: Record<string, string> = {
  tech0: 'Tech0サステナアイドル',
  krs48: 'KRS48',
  riji: 'りじちょーといっしょだよ。',
  terao: 'てらお少年',
  heisei: '平成の俺',
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

  it.each(PERSONAS)('人物 %i（%s）の通し', async (no, oshiId) => {
    const seen: { scene: string; text: string }[] = [];
    const look = (scene: string, root?: ParentNode) => seen.push({ scene, text: collect(root) });

    mountFan(`?p=${no}`);
    click(OSHI_NAME[oshiId] as string); // 推しは、はじめの画面で選ぶ（人物の番号では決まらない）
    look('はじめの画面 1/2');
    click('次へ');
    look('はじめの画面 2/2（プランの一覧。上のプランは選べない）');
    click(/で参加する$/);
    look('参加の確認の枠', layer('sheet') as HTMLElement);
    click('参加する');
    look('ホーム（参加した直後）');
    if (layer('fx')) look('参加の称賛の演出', layer('fx') as HTMLElement);
    await tick(2600);
    look('ホーム（預金でやることが残っている）');
    openNextPage(); // いまできること の一覧（ストアの操作で開く）
    look('次のアクション（預金でやること）');
    click('‹ ホーム');
    click(/^預金でやることへ/);
    await settle();
    look('預金でやることのページ（まだ）');
    click('推し活定期をはじめる');
    look('推し活定期をはじめた直後（短い称賛の札）');
    fireEvent.pointerDown(document.body);
    look('預金でやることのページ（推し活定期が済んだ）');
    click('積み増す'); // 初めから、ちょうど届く額が入っている
    look('積み増して、すべて済んだ直後（短い称賛の札）');
    fireEvent.pointerDown(document.body);
    look('預金でやることのページ（すべて済んだ）');
    click('ホームへもどる');
    look('ホーム（SNSで広める・プランを上げる）');
    openNextPage();
    look('次のアクション（SNSで広める・プランを上げる）');
    click('‹ ホーム');
    // SNSで広める → 共有のシート → 広めた直後の称賛
    click(/^SNSで広める/);
    look('共有のシート', layer('share') as HTMLElement);
    fireEvent.click(btn('X'));
    look('広めた直後の称賛の演出', layer('fx') as HTMLElement);
    await tick(2600 + 400);
    fireEvent.click(within(layer('share') as HTMLElement).getByRole('button', { name: '閉じる' }));
    look('ホーム（広めたあと）');
    // プランを上げる（ゴールド → プラチナ → ダイヤモンド）。シート → 特別な演出 → 特典の贈呈 → ホームの背景
    for (const plan of ['ゴールドプラン', 'プラチナプラン', 'ダイヤモンドプラン']) {
      click(/^プランを上げる/);
      look(`プランを上げるシート（${plan}の前）`, layer('sheet') as HTMLElement);
      click(`${plan}に上げる`);
      look(`${plan}に上げた直後の演出`, layer('fx') as HTMLElement);
      await tick(3300);
      look(`${plan}の特典の贈呈`, layer('sheet') as HTMLElement);
      click('閉じる');
      look(`ホーム（${plan}）`);
    }
    click('特典を見る');
    look('特典をもう一度見る', layer('sheet') as HTMLElement);
    click('閉じる');
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
    {
      click('申し込みをやめる');
      await settle();
      look('やめる確認のシート', layer('sheet') as HTMLElement);
    }

    // 巡回した場面の数（空振りの防止）
    expect(seen.length).toBeGreaterThanOrEqual(32);
    const violations = seen.flatMap(({ scene, text }) =>
      FORBIDDEN.filter(([, re]) => re.test(text)).map(
        ([name, re]) => `${scene}: 「${name}」 ${text.match(re)?.[0] ?? ''}`,
      ),
    );
    expect(
      violations,
      guardMessage(
        'G-08',
        'ファン向けの画面に、人数・最低人数・残りの人数・達成率・目標の金額の数字が出ています',
      ),
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

describe('ひとり体験の開催熱量は、どの時点でも「FEVER 目前」のまま。数字は出ない（G-02・G-08）', () => {
  beforeEach(() => {
    setMeterEngineForTest(createMeterEngine({ apiBase: '', random: () => 0.5 }));
  });

  /** ホームのメーター（開催熱量。段階の名前。距離のことば）の読み上げの文 */
  const gauge = (): string =>
    screen.getByRole('img', { name: /^開催熱量。/ }).getAttribute('aria-label') ?? '';

  it('参加の直後 → 預金でやることのあと → ダイヤモンドプランに上げたあと、で同じ', async () => {
    const stages: string[] = [];
    mountFan('?p=4');
    click('次へ');
    click(/で参加する$/);
    click('参加する');
    await tick(2600);
    stages.push(gauge());
    act(() => {
      const a = getAppStore().actions;
      a.runAcct('teiki', 'home');
      a.runAcct('deposit', 'home', 20_000);
      a.clearAch();
    });
    stages.push(gauge());
    click(/^プランを上げる/);
    click('ダイヤモンドプランに上げる');
    await tick(3300);
    click('閉じる');
    stages.push(gauge());
    expect(stages.map((t) => t.split('。')[1])).toEqual(['FEVER 目前', 'FEVER 目前', 'FEVER 目前']);
    expect(new Set(stages).size).toBe(1);
    for (const text of stages)
      expect(
        FORBIDDEN.some(([, re]) => re.test(text)),
        text,
      ).toBe(false);
  });
});
