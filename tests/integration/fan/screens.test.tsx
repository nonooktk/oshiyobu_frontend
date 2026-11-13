// ファン向けの画面ごとの確かめ（上層: A-17・A-29〜A-32・A-42・A-54・A-56・A-57・I-29・I-67・I-69・I-74・I-101・I-117・I-118）。
import { describe, expect, it, vi } from 'vitest';
import { PREFETCH_IMAGES, PREFETCH_PLAN } from '../../../src/fan/art/registry';
import { PUBLIC_URL } from '../../../src/fan/domain/share';
import { loadLayersChunk, loadPagesChunk } from '../../../src/fan/prefetch';
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
  passStart,
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

// 人物 15 通り（仕様 SP-64 の表。推しの名前・地元の市・預金額・メイン口座）
const PERSONA_TABLE: [number, string, string, string, string][] = [
  [1, 'Tech0サステナアイドル', '久留米市', '15,000円', 'いいえ'],
  [2, 'Tech0サステナアイドル', '久留米市', '28,000円', 'いいえ'],
  [3, 'Tech0サステナアイドル', '久留米市', '62,000円', 'いいえ'],
  [4, 'Tech0サステナアイドル', '久留米市', '90,000円', 'いいえ'],
  [5, 'Tech0サステナアイドル', '久留米市', '95,000円', 'はい'],
  [6, 'Tech0サステナアイドル', '久留米市', '120,000円', 'はい'],
  [7, 'Tech0サステナアイドル', '久留米市', '180,000円', 'いいえ'],
  [8, 'Tech0サステナアイドル', '久留米市', '320,000円', 'はい'],
  [9, 'Tech0サステナアイドル', '久留米市', '1,050,000円', 'はい'],
  [10, 'KRS48', '福岡市', '48,000円', 'いいえ'],
  [11, 'KRS48', '熊本市', '240,000円', 'はい'],
  [12, 'りじちょーといっしょだよ。', '久留米市', '90,000円', 'はい'],
  [13, 'りじちょーといっしょだよ。', '佐賀市', '320,000円', 'いいえ'],
  [14, 'てらお少年', '長崎市', '9,000円', 'いいえ'],
  [15, '平成の俺', '宮崎市', '400,000円', 'はい'],
];

describe('人物 15 通り（I-67・A-56・A-57）', () => {
  it.each(PERSONA_TABLE)(
    '?p=%i は、%s・%s・預金 %s・メイン口座 %s で始まる',
    (no, oshi, city, deposit, pay) => {
      mountFan(`?p=${no}`);
      expect(btn(oshi).getAttribute('aria-pressed')).toBe('true');
      click('次へ');
      expect(btn(city).getAttribute('aria-pressed')).toBe('true');
      click('次へ');
      const note = screen.getByText(
        (_, el) => el?.tagName === 'P' && (el.textContent ?? '').startsWith('いまの預金（仮）'),
      );
      expect(note.textContent).toContain(deposit);
      expect(note.textContent).toContain(`メイン口座 ${pay}`);
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

  it('はじめの画面の初めの市は、人物の地元の市（?p=11 は熊本市。I-71）', () => {
    mountFan('?p=11');
    click('次へ');
    expect(btn('熊本市').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/会場: Restaurant Bar CIB（100名）/)).toBeTruthy();
  });
});

describe('推しの口調（A-42）', () => {
  const MARK: [number, string, RegExp][] = [
    [4, 'tech0', /カマヤーン[\s\S]*申し込みありがとう/],
    [10, 'krs48', /えへへ/],
    [12, 'riji', /あれっす！ありがとうっす！/],
    [14, 'terao', /君を/],
    [15, 'heisei', /サンキュー/],
  ];
  it.each(MARK)('?p=%i（%s）は、組ごとの口調でホームのコメントを出す', (no, _id, re) => {
    mountFan(`?p=${no}`);
    click('次へ');
    click('次へ');
    const go =
      screen.queryByRole('button', { name: 'この内容で申し込む' }) ??
      btn('このコースを目指して始める');
    fireEvent.click(go);
    expect(bubbleText()).toMatch(re);
  });

  it('状況に合わせてコメントが変わる（申し込む前 → 申し込んだあと。A-43）', () => {
    mountFan('?p=4');
    click('次へ');
    click('次へ');
    const seat = screen
      .getAllByRole('button')
      .find((b) => b.hasAttribute('aria-pressed') && (b.textContent ?? '').includes('前方の席'));
    fireEvent.click(seat as HTMLElement);
    click('このコースを目指して始める');
    const before = bubbleText();
    expect(before).toContain('あと19人');
    click(/^次のアクション/);
    for (const label of [/^メイン口座にする/, /^預金を積み増す/])
      fireEvent.click(screen.getByRole('button', { name: label }));
    fireEvent.click(screen.getByRole('button', { name: /^前方の席に申し込む/ }));
    expect(bubbleText()).not.toBe(before);
  });
});

describe('すべての画面に札「デモ用の架空データ」が出る（A-54・I-101）', () => {
  it('はじめの画面 3 つ・ホーム・次のアクション・メニューと詳細の 7 画面', async () => {
    mountFan('?p=4');
    const badge = () => screen.getAllByText('デモ用の架空データ').length;
    expect(badge()).toBe(1);
    click('次へ');
    expect(badge()).toBe(1);
    click('次へ');
    expect(badge()).toBe(1);
    click('この内容で申し込む');
    expect(badge()).toBe(1);
    await closeGiftAfterFx();
    click(/^次のアクション/);
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
});

describe('共有（A-29〜A-32・I-29）', () => {
  async function toShare() {
    mountFan('?p=4');
    passStart();
    await closeGiftAfterFx();
    click(/^次のアクション/);
    click(/^SNSで広める/);
    return screen.getByRole('textbox') as HTMLTextAreaElement;
  }

  it('投稿文に、推しの名前・市・達成率・あと N 人と、公開 URL（人物の番号なし）が入り、個人の情報は入らない', async () => {
    const box = await toShare();
    expect(box.value).toBe(
      `Tech0サステナアイドルを久留米市に呼びたい！ いま80%まで来ています。ライブ開催まであと18人です。いっしょに応援してください！ #OSHIYOBU\n${PUBLIC_URL}`,
    );
    expect(box.value).not.toMatch(/\?p=|90,000|預金|口座/);
  });

  it('X・Facebook は別タブ（noopener,noreferrer）で投稿画面を開き、Instagram は文面をコピーする', async () => {
    const box = await toShare();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: write },
      configurable: true,
    });
    fireEvent.click(btn('X'));
    expect(open).toHaveBeenLastCalledWith(
      `https://x.com/intent/post?text=${encodeURIComponent(box.value)}`,
      '_blank',
      'noopener,noreferrer',
    );
    fireEvent.click(btn('Facebook'));
    const fb = String(open.mock.calls.at(-1)?.[0]);
    expect(fb).toContain(`sharer.php?u=${encodeURIComponent(PUBLIC_URL)}&quote=`);
    await act(async () => {
      fireEvent.click(btn('Instagram'));
    });
    expect(write).toHaveBeenCalledWith(box.value);
    expect(
      screen.getAllByText('コピーしました。Instagramに貼り付けて投稿できます').length,
    ).toBeGreaterThan(0);
  });

  it('コピーできないときは、「コピーできませんでした」と出す（SP-90）', async () => {
    await toShare();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('x')) },
      configurable: true,
    });
    await act(async () => {
      fireEvent.click(btn('Instagram'));
    });
    expect(
      screen.getAllByText('コピーできませんでした。選んだ文面を手動でコピーしてください').length,
    ).toBeGreaterThan(0);
  });
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
    click(/^次のアクション/);
    click(/^SNSで広める/);
    fireEvent.click(btn('X'));
    vi.spyOn(window, 'open').mockReturnValue(null);
    await tick(400 + 2300); // 特典 2/3 の演出 → 絵
    fireEvent.click(within(layer('gift') as HTMLElement).getByRole('button', { name: '閉じる' })); // 特典 2/3 の絵
    fireEvent.click(within(layer('share') as HTMLElement).getByRole('button', { name: '閉じる' })); // 共有のシート
    await tick(2000 + 700 + 2300);
    expect(screen.getByRole('heading', { name: '特典 3/3 が開きました' })).toBeTruthy();
    fireEvent.click(within(layer('gift') as HTMLElement).getByRole('button', { name: '閉じる' }));
    expect(layer('thanks')).not.toBeNull();
    expect(
      within(layer('thanks') as HTMLElement).getByText(/ライブでみんなに会えたら、うれしいな。/),
    ).toBeTruthy();
    fireEvent.click(within(layer('thanks') as HTMLElement).getByRole('button'));
    expect(layer('thanks')).toBeNull();
    // 貢献で読み返す
    click('‹ ホーム');
    click('メニュー');
    await settle();
    click(/^貢献/);
    await settle();
    expect(screen.getByText(/ライブでみんなに会えたら、うれしいな。/)).toBeTruthy();
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

describe('遅れて読む画面と、受け皿（I-119・I-121・I-103・SP-90）', () => {
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
    expect(screen.getByRole('img', { name: /^支援者75人/ })).toBeTruthy();
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
  });

  it('コピーできないときは、投稿文の欄を選択状態にする（SP-90）', async () => {
    mountFan('?p=4');
    passStart();
    await closeGiftAfterFx();
    click(/^次のアクション/);
    click(/^SNSで広める/);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('x')) },
      configurable: true,
    });
    const box = screen.getByRole('textbox') as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.click(btn('Instagram'));
    });
    expect(document.activeElement).toBe(box);
    expect(box.selectionStart).toBe(0);
    expect(box.selectionEnd).toBe(box.value.length);
  });
});
