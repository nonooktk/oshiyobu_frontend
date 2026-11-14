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
  btn,
  cleanup,
  click,
  closeGiftAfterFx,
  fireEvent,
  layer,
  mountFan,
  openNextPage,
  fundAndApply,
  passStart,
  passStartOnly,
  ReadyImage,
  screen,
  tick,
  setupFanTest,
  within,
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
  it.each(Array.from({ length: 15 }, (_, i) => i + 1))(
    '?p=%i は、Tech0サステナアイドル・預金 0円・メイン口座 いいえ で始まる。市の選択は無い',
    (no) => {
      mountFan(`?p=${no}`);
      expect(btn('Tech0サステナアイドル').getAttribute('aria-pressed')).toBe('true');
      click('次へ');
      expect(screen.queryByRole('heading', { name: '呼びたい市を選ぶ' })).toBeNull();
      expect(screen.getByText(/会場: 久留米シティプラザ Cボックス（144席）/)).toBeTruthy();
      const note = screen.getByText(
        (_, el) => el?.tagName === 'P' && (el.textContent ?? '').startsWith('いまの預金（仮）'),
      );
      expect(note.textContent).toContain('0円');
      expect(note.textContent).toContain('メイン口座 いいえ');
    },
  );

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
    ['tech0', 'Tech0サステナアイドル', /カマヤーン[\s\S]*申し込みありがとう/],
    ['krs48', 'KRS48', /えへへ/],
    ['riji', 'りじちょーといっしょだよ。', /あれっす！ありがとうっす！/],
    ['terao', 'てらお少年', /申し込みありがとう/],
    ['heisei', '平成の俺', /サンキュー/],
  ];
  it.each(MARK)(
    '%s は、組ごとの口調でホームのコメントを出す（どの人物でも同じ。推しは、はじめの画面で選ぶ）',
    (_id, name, re) => {
      mountFan('?p=4');
      click(name);
      click('次へ');
      click('このコースを目指して始める');
      fundAndApply();
      expect(bubbleText()).toMatch(re);
    },
  );

  it('状況に合わせてコメントが変わる（申し込む前 → 申し込んだあと。A-43）', () => {
    mountFan('?p=4');
    click('次へ');
    const seat = screen
      .getAllByRole('button')
      .find((b) => b.hasAttribute('aria-pressed') && (b.textContent ?? '').includes('前方の席'));
    fireEvent.click(seat as HTMLElement);
    click('このコースを目指して始める');
    const before = bubbleText();
    expect(before).toContain('だいぶ熱くなってきたね。'); // 申し込む前（熱量はヒートアップ）。人数は言わない
    expect(before).not.toMatch(/\d+人/);
    act(() => {
      const { actions } = getAppStore();
      actions.runAcct('teiki', 'home');
      actions.runAcct('main', 'home');
      actions.runAcct('deposit', 'home', 100_000);
      actions.clearAch();
    });
    fireEvent.click(screen.getByRole('button', { name: /^申し込む/ }));
    expect(bubbleText()).not.toBe(before);
  });
});

describe('すべての画面に札「デモ用の架空データ」が出る（A-54・I-101）', () => {
  it('はじめの画面 2 つ・ホーム・次のアクション・メニューと詳細の 7 画面', async () => {
    mountFan('?p=4');
    const badge = () => screen.getAllByText('デモ用の架空データ').length;
    expect(badge()).toBe(1);
    click('次へ');
    expect(badge()).toBe(1);
    click('このコースを目指して始める');
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
      '応援コース',
      '支援の状況',
      'しくみ',
      '推し・条件の変更',
      '情報の扱い',
    ]) {
      click(new RegExp(`^${title}`));
      await settle();
      expect(badge(), title).toBe(1);
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeTruthy();
      click('‹ メニュー');
    }
  });

  it('達成のエフェクト・特典の絵・感謝の層にも札が出る', async () => {
    mountFan('?p=4');
    passStart();
    await tick(650);
    expect(layer('fx')?.textContent).toContain('デモ用の架空データ');
    await tick(2600);
    expect(layer('gift')?.textContent).toContain('デモ用の架空データ');
  });

  it('C-06 下から出るシート（引き継ぎ・申し込みをやめる確認）の中にも札が出る。後ろの画面が下へスクロールされていても見える', async () => {
    mountFan('?p=4');
    passStart();
    await closeGiftAfterFx();
    click('メニュー');
    await settle();
    click('申し込みをやめる');
    await settle();
    const cancel = layer('sheet') as HTMLElement;
    expect(within(cancel).getByRole('heading', { name: '申し込みをやめますか？' })).toBeTruthy();
    expect(within(cancel).getAllByText('デモ用の架空データ')).toHaveLength(1);
    click('やめない（戻る）');
    await settle();

    click(/^推し・条件の変更/);
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

describe('共有（A-29〜A-32・I-29）', () => {
  async function toShare() {
    mountFan('?p=4');
    passStart();
    await closeGiftAfterFx();
    click(/^SNSに投稿する（任意）/); // ホームの副のボタン
    return screen.getByRole('textbox') as HTMLTextAreaElement;
  }

  it('投稿文に、推しの名前・市・開催熱量と距離のことばが入り（人数・達成率は入らない）、URL（仮の公開 URL を含む）と個人の情報は入らない', async () => {
    const box = await toShare();
    expect(box.value).toBe(
      'Tech0サステナアイドルを久留米市に呼びたい！ いま開催熱量は「FEVER 目前」です。開催まで、あと一歩です。いっしょに応援してください！ #OSHIYOBU',
    );
    expect(box.value).not.toMatch(/\d+人|\d+%|達成率|最低人数/);
    expect(box.value).not.toMatch(/https?:|example\.test|\?p=|90,000|預金|口座/);
  });

  it('X・Instagram・Facebook は、外のサイトを開かず（別タブも外へのリンクも無い）・コピーもせず、押すと投稿したことが出る', async () => {
    await toShare();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: write },
      configurable: true,
    });
    const sheet = layer('share') as HTMLElement;
    expect(sheet.querySelectorAll('a')).toHaveLength(0);
    // 説明は 1 文（3 つのボタンの名前を並べない）。別のタブを開く・コピーするとは言わない
    expect(sheet.textContent).toContain(
      '押すと投稿したことになります（デモのため、実際には投稿されません）。',
    );
    expect(sheet.textContent).not.toMatch(/別のタブ|投稿画面を開き|コピー/);
    for (const name of ['X', 'Instagram', 'Facebook']) {
      fireEvent.click(btn(name));
      expect(screen.getAllByText(`${name}に投稿しました（デモ・未投稿）`).length).toBeGreaterThan(
        0,
      );
    }
    expect(open).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it('クリップボードが使えない環境でも、Instagram を押すと投稿したことが出る（コピーに頼らない）。投稿文の欄は選択状態にならない', async () => {
    const box = await toShare();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('x')) },
      configurable: true,
    });
    fireEvent.click(btn('Instagram'));
    expect(screen.getAllByText('Instagramに投稿しました（デモ・未投稿）').length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByText(/コピーできませんでした/)).toBeNull();
    expect(document.activeElement).not.toBe(box);
  });

  it.each(['X', 'Instagram', 'Facebook'])(
    '%s を押すと、共有した印が付いて、称賛のあとに特典 2/3 が開く。続けて 3 つのボタンを押しても、特典は増えない',
    async (name) => {
      await toShare();
      fireEvent.click(btn(name));
      await tick(2600 + 2300); // 短い称賛（2.6 秒）→ ごほうび → 絵
      expect(layer('gift')?.getAttribute('aria-label')).toBe('特典 2/3');
      fireEvent.click(within(layer('gift') as HTMLElement).getByRole('button', { name: '閉じる' }));
      for (const other of ['X', 'Instagram', 'Facebook']) fireEvent.click(btn(other));
      await tick(2600 + 2300 + 100);
      expect(layer('gift')).toBeNull();
      // 共有した印: シートを閉じると、ホームの副のボタン「SNSに投稿する（任意）」が消える
      fireEvent.click(
        within(layer('share') as HTMLElement).getByRole('button', { name: '閉じる' }),
      );
      expect(screen.queryByRole('button', { name: /^SNSに投稿する/ })).toBeNull();
    },
  );
});

describe('特典の絵と感謝（I-28・I-117・I-118）', () => {
  it('絵がまだ届かない・読めないときは、空白の枠でなく、代わりの表示（丸い絵のぼかしと頭文字）を出す', async () => {
    mountFan('?p=4');
    passStart();
    await tick(650 + 2500 + 20);
    const gift = layer('gift') as HTMLElement;
    const fallback = within(gift).getByRole('img', { name: /特典の絵 1\/3/ });
    expect(fallback.textContent).toContain('サ');
    expect(gift.querySelectorAll('img[alt*="特典の絵"]')).toHaveLength(0); // 壊れた画像の印を出さない
  });

  it('代わりの表示の順: 本来の絵（幅 1152）が届くまでは、読み済みの幅 768 の絵を切り抜きの段のまま出す（D-40）', async () => {
    mountFan('?p=4');
    click('KRS48'); // krs48（1 枚の絵を切り抜いて広げる組）。推しは、はじめの画面で選ぶ
    click('次へ');
    click('このコースを目指して始める');
    fundAndApply();
    // 最初の画面・ホームで出した絵が、読み終えた（load）
    for (const img of Array.from(document.querySelectorAll('img[alt$="の絵"]')))
      fireEvent.load(img);
    await tick(650 + 2500 + 20);
    const art = layer('gift')?.querySelector('img[alt*="特典の絵 1/3"]') as HTMLImageElement;
    expect(art.getAttribute('src')).toMatch(/krs48-full-768/);
    expect(art.style.width).toMatch(/%$/); // 切り抜きの広げ方（1 段目は顔まわり）
    expect(layer('gift')?.querySelector('[role="img"][aria-label*="特典の絵"]')).toBeNull(); // 頭文字には落ちない
  });

  it('本来の絵が届いたら、その場で差し替える', async () => {
    vi.stubGlobal('Image', ReadyImage);
    mountFan('?p=4');
    passStart();
    await tick(650 + 2500 + 20);
    await tick(5);
    const gift = layer('gift') as HTMLElement;
    expect(gift.querySelector('img[alt*="特典の絵 1/3"]')).not.toBeNull();
  });

  it('3 つ目の特典の絵を閉じた直後に、感謝のメッセージが 1 回だけ出て、貢献で読み返せる（A-44）', async () => {
    mountFan('?p=4');
    passStart();
    await closeGiftAfterFx(); // 特典 1/3
    click(/^SNSに投稿する（任意）/);
    fireEvent.click(btn('X'));
    vi.spyOn(window, 'open').mockReturnValue(null);
    await tick(2600 + 2300); // 投稿の称賛 → 特典 2/3 の演出 → 絵
    fireEvent.click(within(layer('gift') as HTMLElement).getByRole('button', { name: '閉じる' })); // 特典 2/3 の絵
    fireEvent.click(within(layer('share') as HTMLElement).getByRole('button', { name: '閉じる' })); // 共有のシート
    click(/^仲間を呼ぶ/); // ホームの主のボタン
    await tick(1200 + 2300);
    expect(screen.getByRole('heading', { name: '特典 3/3 が開きました' })).toBeTruthy();
    fireEvent.click(within(layer('gift') as HTMLElement).getByRole('button', { name: '閉じる' }));
    expect(layer('thanks')).not.toBeNull();
    expect(
      within(layer('thanks') as HTMLElement).getByText(/ライブでみんなに会えたら、うれしいな。/),
    ).toBeTruthy();
    fireEvent.click(within(layer('thanks') as HTMLElement).getByRole('button'));
    expect(layer('thanks')).toBeNull();
    // 貢献で読み返す
    click('メニュー');
    await settle();
    click(/^貢献/);
    await settle();
    expect(screen.getByText(/ライブでみんなに会えたら、うれしいな。/)).toBeTruthy();
  });

  it('りじちょーの感謝のメッセージには、いまの市の名前が入る（久留米市で会えたら…）', async () => {
    mountFan('?p=4');
    click('りじちょーといっしょだよ。'); // 推しは、はじめの画面で選ぶ
    passStartOnly();
    fundAndApply();
    await closeGiftAfterFx();
    click(/^SNSに投稿する（任意）/);
    vi.spyOn(window, 'open').mockReturnValue(null);
    fireEvent.click(btn('X'));
    await tick(2600 + 2300);
    fireEvent.click(within(layer('gift') as HTMLElement).getByRole('button', { name: '閉じる' }));
    fireEvent.click(within(layer('share') as HTMLElement).getByRole('button', { name: '閉じる' }));
    click(/^仲間を呼ぶ/);
    await tick(1200 + 2300);
    fireEvent.click(within(layer('gift') as HTMLElement).getByRole('button', { name: '閉じる' }));
    const text = layer('thanks')?.textContent ?? '';
    expect(text).toContain('あれっす！特典を3つとも開けてくれて、ありがとうっす！');
    expect(text).toContain('久留米市で会えたら、ほんとうに最高にうれしいっす！');
    expect(text).not.toContain('{市}');
  });

  it('Esc で、いちばん上の層（特典の絵）を閉じる', async () => {
    mountFan('?p=4');
    passStart();
    await tick(650 + 2500 + 20);
    expect(layer('gift')).not.toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(layer('gift')).toBeNull();
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
    click('申し込みをやめる');
    expect(screen.getByRole('heading', { name: '申し込みをやめますか？' })).toBeTruthy();
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
        /送るのは、申し込みの合図（公演の指定を含む）と端末の番号だけです。個人の情報は送りません。/,
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

describe('メーターに金額を出さない（A-69・SP-56）', () => {
  it('ホームのメーター・共有のシートの画像・貢献の達成率の欄に、「円」「万」が出ない', async () => {
    mountFan('?p=4');
    passStart();
    await closeGiftAfterFx();
    const gauge = screen.getByRole('img', { name: /^開催熱量。/ });
    expect(`${gauge.getAttribute('aria-label')}${gauge.textContent}`).not.toMatch(/[円万]/);
    click(/^SNSに投稿する（任意）/);
    const frame = within(layer('share') as HTMLElement).getByRole('img', { name: /^共有用の画像/ });
    expect(`${frame.getAttribute('aria-label')}${frame.textContent}`).not.toMatch(/[円万]/);
    click('閉じる');
    click('メニュー');
    await settle();
    click(/^貢献/);
    await settle();
    const card = screen.getByText('みんなの開催熱量').closest('div') as HTMLElement;
    expect(card.textContent).not.toMatch(/[円万]/);
  });
});
