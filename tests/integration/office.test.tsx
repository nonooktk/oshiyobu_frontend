// 事務所向け（/）の結合テスト（I-01〜I-15・I-101・I-110・I-113 の事務所側）。画面を描き、core の数字と照合する
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PUBLISH_DEBOUNCE_MS, createLink, resetLinkForTest } from '../../src/shared/link';
import { App } from '../../src/office/App';
import { initialOfficeState, officeStore } from '../../src/office/store';
import { FakeChannel, asBroadcastChannel } from '../helpers/fakeChannel';

const choose = (city: string) => {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${city}を選ぶ`) }));
};
const pickVenue = (name: RegExp | string) => {
  fireEvent.click(screen.getByRole('button', { name }));
};
const pickBase = () => {
  choose('久留米市');
  pickVenue(/久留米シティプラザ Cボックス/);
};
const text = (testId: string) => screen.getByTestId(testId).textContent;
const input = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement;
const type = (label: string | RegExp, value: string) => {
  fireEvent.change(input(label), { target: { value } });
};
const blur = (label: string | RegExp) => {
  fireEvent.blur(input(label));
};
const openAdjust = () => {
  fireEvent.click(screen.getByText('条件を調整'));
};

let fetchSpy: ReturnType<typeof vi.fn>;

describe('事務所向け', () => {
  beforeEach(() => {
    officeStore.setState(initialOfficeState());
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    FakeChannel.reset();
    vi.stubGlobal('BroadcastChannel', FakeChannel);
    resetLinkForTest();
  });
  afterEach(() => {
    cleanup();
    resetLinkForTest();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('I-01 基準（tech0・久留米市・Cボックス）: 650,000円・93人 × 7,000円・見込み 187人・札「高」・上乗せ 768,000円', () => {
    render(<App />);
    expect(screen.queryByTestId('judge')).toBeNull(); // 会場を選ぶまで、判定は出ない
    pickBase();
    expect(text('line')).toBe('650,000円');
    expect(text('need')).toBe('93人');
    expect(text('price')).toBe('7,000円');
    expect(text('expected')).toBe('187人');
    expect(text('verdict')).toBe('成立の見込み 高');
    expect(text('uplift-total')).toBe('+768,000円');
    expect(screen.getByText('キャパ 144席に収まる')).toBeTruthy();
    expect(screen.getByRole('button', { name: '提案を見る' }).getAttribute('aria-disabled')).toBe(
      'false',
    );
  });

  it('I-02 組を terao にすると、札「低」・あと 48人・提案を見るは押せない', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /てらお少年/ }));
    pickBase();
    expect(text('verdict')).toBe('成立の見込み 低');
    expect(screen.getByText('必要 93人に届かない（あと 48人）')).toBeTruthy();
    const button = screen.getByRole('button', { name: '提案を見る' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText('この条件では提案できません')).toBeTruthy();
    fireEvent.click(button);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('I-06 会場費を 100,000 円にすると、到達ライン 690,000円・必要人数 99人・札「高」。上乗せは 768,000円のまま', () => {
    render(<App />);
    pickBase();
    openAdjust();
    type('会場費', '100000');
    expect(text('line')).toBe('690,000円');
    expect(text('need')).toBe('99人');
    expect(text('verdict')).toBe('成立の見込み 高');
    expect(text('uplift-total')).toBe('+768,000円');
  });

  describe('I-07 費用の入力', () => {
    it.each([
      ['', '空'],
      ['-1', '負'],
      ['1.5', '小数'],
      ['abc', '文字'],
    ])('%s（%s）は反映せず、理由を出す。到達ラインは変わらない', (value) => {
      render(<App />);
      pickBase();
      openAdjust();
      type('会場費', value);
      expect(within(screen.getByTestId('judge')).getAllByRole('alert').length).toBeGreaterThan(0);
      expect(text('line')).toBe('650,000円');
      blur('会場費'); // 欄を離れたら、反映済みの値に戻る
      expect(input('会場費').value).toBe('60,000');
    });

    it('0 は受ける。全角の「１２０」は半角の 120 になる', () => {
      render(<App />);
      pickBase();
      openAdjust();
      type('会場費', '0');
      expect(text('line')).toBe('590,000円');
      type('会場費', '１２０');
      expect(text('line')).toBe('590,120円');
      expect(screen.queryAllByRole('alert')).toHaveLength(0);
    });

    it('5 項目がすべて 0 円のとき、必要人数 0・最低人数 1 で、数字が壊れない（NaN が出ない）', () => {
      render(<App />);
      pickBase();
      openAdjust();
      for (const label of ['会場費', '制作費', '出演料', '移動・宿泊', 'アーティストの利益'])
        type(label, '0');
      expect(text('need')).toBe('0人');
      expect(input('最低人数').value).toBe('1');
      expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
    });
  });

  describe('I-08 最低人数の入力', () => {
    it.each([
      ['80', 80],
      ['1', 1],
      ['144', 144],
      ['８０', 80],
    ])('%s は反映する（%i人）', (value, expected) => {
      render(<App />);
      pickBase();
      openAdjust();
      type('最低人数', value);
      expect(screen.getByTestId('rule').textContent).toContain(`${expected}人`);
      expect(screen.queryAllByRole('alert')).toHaveLength(0);
    });

    it.each(['0', '145', '1.5', 'abc'])(
      '%s は反映せず、理由を出し、欄を離れたら、もとの 93 に戻る',
      (value) => {
        render(<App />);
        pickBase();
        openAdjust();
        type('最低人数', value);
        expect(screen.getByRole('alert').textContent).toMatch(/人|整数/);
        expect(text('rule')).toContain('93人');
        blur('最低人数');
        expect(input('最低人数').value).toBe('93');
        expect(screen.getByRole('alert').textContent).toContain('もとの 93人 に戻しました');
      },
    );

    it('空は、欄を離れたらもとへ戻り、理由は出さない', () => {
      render(<App />);
      pickBase();
      openAdjust();
      type('最低人数', '');
      blur('最低人数');
      expect(input('最低人数').value).toBe('93');
      expect(screen.queryAllByRole('alert')).toHaveLength(0);
    });
  });

  it('I-09 最低人数を 80 にすると、成立の条件に 80人・注意「あと 90,000円ぶん」。必要人数は 93人のまま、札は「高」のまま', () => {
    render(<App />);
    pickBase();
    openAdjust();
    type('最低人数', '80');
    expect(text('rule')).toContain('最低人数（80人）');
    expect(screen.getByText(/あと 90,000円ぶん/)).toBeTruthy();
    expect(text('need')).toBe('93人');
    expect(text('verdict')).toBe('成立の見込み 高');
    fireEvent.click(screen.getByRole('button', { name: '計算の値に戻す（93人）' }));
    expect(input('最低人数').value).toBe('93');
  });

  it('I-75 heisei・宮崎市・メディキット県民文化センターは、札「低」（見込み 11 ÷ 必要人数 250）。提案は出せない', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /平成の俺/ }));
    choose('宮崎市');
    pickVenue(/メディキット県民文化センター/);
    expect(text('expected')).toBe('11人');
    expect(text('need')).toBe('250人');
    expect(text('verdict')).toBe('成立の見込み 低');
    expect(screen.getByRole('button', { name: '提案を見る' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
  });

  it('決定 12 札は、最低人数を変えても変わらない（必要人数で決まる）。必要人数 129人・見込み 187人で「中」', () => {
    render(<App />);
    pickBase();
    openAdjust();
    type('出演料', '500000');
    expect(text('need')).toBe('129人');
    expect(text('verdict')).toBe('成立の見込み 中');
    type('最低人数', '50');
    expect(text('verdict')).toBe('成立の見込み 中');
    expect(text('need')).toBe('129人');
  });

  it('I-10・I-11 開催条件と提案の 1 枚に、上乗せの 3 行と合計 +768,000円。提案には内訳 5 項目・募集期限・成立の条件', () => {
    render(<App />);
    pickBase();
    const rows = (root: HTMLElement) => root.textContent ?? '';
    expect(rows(screen.getByTestId('judge'))).toContain('前方の席');
    expect(rows(screen.getByTestId('judge'))).toContain('+196,000円');
    fireEvent.click(screen.getByRole('button', { name: '提案を見る' }));
    const dialog = screen.getByRole('dialog');
    for (const expected of ['+196,000円', '+279,000円', '+293,000円']) {
      expect(within(dialog).getByTestId('pp-uplift').textContent).toContain(expected);
    }
    expect(within(dialog).getByTestId('pp-uplift-total').textContent).toBe('+768,000円');
    const cost = within(dialog).getByTestId('pp-cost').textContent ?? '';
    for (const expected of [
      '会場費60,000円',
      '制作費100,000円',
      '出演料250,000円',
      '移動・宿泊120,000円',
      'アーティストの利益120,000円',
      '合計650,000円',
    ]) {
      expect(cost).toContain(expected);
    }
    expect(within(dialog).getByText('2026年12月20日')).toBeTruthy();
    expect(within(dialog).getByTestId('pp-line').textContent).toBe('93人・650,000円');
    expect(
      within(dialog).getByText('成立したら開催。成立しなければ費用は発生しません。'),
    ).toBeTruthy();
    expect(within(dialog).getByText('デモ用の架空データ')).toBeTruthy();
  });

  it('C-01 提案の 1 枚を開くとき、「閉じる」へ移るが、枠の中をスクロールさせない（見出し・札が上へ隠れない）', () => {
    // jsdom にはスクロールが無いので、ブラウザの既定の動き（フォーカス先が見える位置まで枠を送る）を止める指定で確かめる。
    // 実ブラウザでの隠れる量は、Playwright の台本で前後を測る（完了報告）
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    try {
      render(<App />);
      pickBase();
      fireEvent.click(screen.getByRole('button', { name: '提案を見る' }));
      const close = within(screen.getByRole('dialog')).getByRole('button', { name: '閉じる' });
      const at = focus.mock.contexts.indexOf(close);
      expect(at).toBeGreaterThanOrEqual(0); // 開いたら「閉じる」へ移る（従来どおり）
      expect(focus.mock.calls[at]?.[0]).toEqual({ preventScroll: true });
      expect(within(screen.getByRole('dialog')).getByText('デモ用の架空データ')).toBeTruthy();
    } finally {
      focus.mockRestore();
    }
  });

  describe('F-12 収支シミュレーターの入口（D-21）', () => {
    const simulatorLink = () =>
      within(screen.getByTestId('judge')).queryByRole('link', { name: '収支シミュレーター' });
    const NOTE = 'この会場は、収支シミュレーターにありません';

    it('シミュレーターにある会場（Cボックス）は、判定の下に入口が出て、注記は出ない', () => {
      render(<App />);
      pickBase();
      expect(simulatorLink()?.getAttribute('href')).toBe('/simulator.html');
      expect(screen.queryByText(NOTE)).toBeNull();
    });

    it('C-03 シミュレーターに無い会場（RISE UP）は、入口を出さず、1 行の注記を出す', () => {
      render(<App />);
      choose('久留米市');
      pickVenue(/RISE UP/);
      expect(simulatorLink()).toBeNull();
      expect(within(screen.getByTestId('judge')).getByText(NOTE)).toBeTruthy();
    });

    it('RISE UP から Cボックスへ選び直すと、入口が戻り、注記が消える', () => {
      render(<App />);
      choose('久留米市');
      pickVenue(/RISE UP/);
      pickVenue(/久留米シティプラザ Cボックス/);
      expect(simulatorLink()).not.toBeNull();
      expect(screen.queryByText(NOTE)).toBeNull();
    });

    it('11 会場すべて（RISE UP 以外）に入口がある', () => {
      const cities = [
        ['福岡市', 3],
        ['北九州市', 1],
        ['久留米市', 2],
        ['佐賀市', 1],
        ['長崎市', 1],
        ['熊本市', 1],
        ['大分市', 1],
        ['宮崎市', 1],
        ['鹿児島市', 1],
      ] as const;
      render(<App />);
      let withLink = 0;
      let withNote = 0;
      for (const [city, count] of cities) {
        choose(city);
        for (let i = 0; i < count; i++) {
          const buttons = screen
            .getByRole('heading', { name: `${city}の会場` })
            .parentElement?.querySelectorAll<HTMLButtonElement>('ul button');
          fireEvent.click(buttons?.[i] as HTMLButtonElement);
          if (simulatorLink() !== null) withLink += 1;
          if (screen.queryByText(NOTE) !== null) withNote += 1;
        }
      }
      expect([withLink, withNote]).toEqual([11, 1]);
    });
  });

  it('提案の 1 枚は、Esc で閉じ、押した場所に戻る', () => {
    render(<App />);
    pickBase();
    const opener = screen.getByRole('button', { name: '提案を見る' });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('I-13 必要人数が会場のキャパを超えても、警告の色で出し、提案は札で決まり、最低人数の欄にエラーは出ない', () => {
    render(<App />);
    pickBase();
    openAdjust();
    // 必要人数が 158人になり、キャパ（144）を超える。札は 187 ÷ 158 で「中」
    type('出演料', '700000');
    expect(screen.getByText('キャパ 144席を超える')).toBeTruthy();
    expect(screen.queryAllByRole('alert')).toHaveLength(0);
    expect(screen.getByRole('button', { name: '提案を見る' }).getAttribute('aria-disabled')).toBe(
      'false',
    );
  });

  it('I-14 別の市を選ぶと、会場・判定・手で書き換えた最低人数が消える。会場を選び直すと必要人数から始まる', () => {
    render(<App />);
    pickBase();
    openAdjust();
    type('最低人数', '80');
    choose('福岡市');
    expect(screen.queryByTestId('judge')).toBeNull();
    choose('久留米市');
    expect(screen.queryByTestId('judge')).toBeNull();
    pickVenue(/久留米シティプラザ Cボックス/);
    expect(text('rule')).toContain('最低人数（93人）');
  });

  it('I-03 9 市の会場候補は、12 件（福岡市 3・北九州市 1・久留米市 2・ほか各 1）', () => {
    render(<App />);
    const expected: Record<string, number> = {
      福岡市: 3,
      北九州市: 1,
      久留米市: 2,
      佐賀市: 1,
      長崎市: 1,
      熊本市: 1,
      大分市: 1,
      宮崎市: 1,
      鹿児島市: 1,
    };
    let total = 0;
    for (const [city, count] of Object.entries(expected)) {
      choose(city);
      const heading = screen.getByRole('heading', { name: `${city}の会場` });
      const list = heading.parentElement?.querySelectorAll('li').length ?? 0;
      expect(list).toBe(count);
      total += list;
    }
    expect(total).toBe(12);
  });

  it('I-05 指標を「払える熱量」にすると、色の段が最小の市＝最も淡く・最大の市＝最も濃くなり、式が出る', () => {
    render(<App />);
    expect(screen.queryByText('＝ 熱量 × 預金額')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '払える熱量' }));
    expect(screen.getByText('＝ 熱量 × 預金額')).toBeTruthy();
    const fills = [...document.querySelectorAll<SVGCircleElement>('circle')]
      .map((c) => c.getAttribute('style') ?? '')
      .filter((s) => s.includes('--heat-'));
    expect(fills).toHaveLength(9);
    expect(fills.some((s) => s.includes('--heat-1)'))).toBe(true);
    expect(fills.some((s) => s.includes('--heat-5)'))).toBe(true);
  });

  it('I-15 情報の扱い: 保存している項目・保存先・戻す方法が出る。事務所向けは、何も送らない（通信 0 件）', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '情報の扱い' }));
    let dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('保存している項目（いまの内容）')).toBeTruthy();
    expect(within(dialog).getByTestId('priv-items').textContent).toContain(
      '選んだ市: （まだ選んでいません）',
    );
    expect(within(dialog).getByText(/この端末の中だけです/)).toBeTruthy();
    expect(within(dialog).getByText('最初の状態に戻す方法')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: '閉じる' }));
    pickBase();
    fireEvent.click(screen.getByRole('button', { name: '情報の扱い' }));
    dialog = screen.getByRole('dialog');
    const items = within(dialog).getByTestId('priv-items').textContent ?? '';
    expect(items).toContain('アーティスト: Tech0サステナアイドル');
    expect(items).toContain('選んだ会場: 久留米シティプラザ Cボックス');
    expect(items).toContain('会場費 60,000円');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('I-101 札「デモ用の架空データ」が、画面と、重ねて出す枠（情報の扱い）にある', () => {
    render(<App />);
    expect(screen.getAllByText('デモ用の架空データ')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '情報の扱い' }));
    expect(screen.getAllByText('デモ用の架空データ')).toHaveLength(2);
  });

  it('キーボード: 市の丸は Enter で選べる。聞き手向けの画面への入口（発表者用へのリンク）は出さない', () => {
    render(<App />);
    fireEvent.keyDown(screen.getByRole('button', { name: /^熊本市を選ぶ/ }), { key: 'Enter' });
    expect(screen.getByRole('heading', { name: '熊本市の会場' })).toBeTruthy();
    expect(document.querySelector('a[href*="presenter"]')).toBeNull();
  });

  describe('C-05 キーボードで市を選ぶと、会場の先頭にフォーカスが移る（SP-03）', () => {
    const firstVenue = (city: string) =>
      within(screen.getByRole('heading', { name: `${city}の会場` }).parentElement as HTMLElement)
        .getAllByRole('button')
        .at(0);

    it.each([
      ['Enter', 'Enter'],
      ['Space', ' '],
    ])('%s で選ぶと、その市の会場の先頭のボタンにフォーカスが移る', (_label, key) => {
      render(<App />);
      const dot = screen.getByRole('button', { name: /^福岡市を選ぶ/ });
      dot.focus();
      fireEvent.keyDown(dot, { key });
      expect(document.activeElement).toBe(firstVenue('福岡市'));
      expect(document.activeElement).not.toBe(dot);
    });

    it('すでに選んでいる市をもう一度キーボードで選んでも、会場の先頭へ移る', () => {
      render(<App />);
      const dot = screen.getByRole('button', { name: /^久留米市を選ぶ/ });
      fireEvent.keyDown(dot, { key: 'Enter' });
      dot.focus();
      expect(document.activeElement).toBe(dot);
      fireEvent.keyDown(dot, { key: 'Enter' });
      expect(document.activeElement).toBe(firstVenue('久留米市'));
    });

    it('マウスで選んだときは、フォーカスを動かさない（会場の先頭に移らない）', () => {
      render(<App />);
      const dot = screen.getByRole('button', { name: /^佐賀市を選ぶ/ });
      dot.focus();
      fireEvent.click(dot);
      expect(screen.getByRole('heading', { name: '佐賀市の会場' })).toBeTruthy();
      expect(document.activeElement).toBe(dot);
    });

    it('「事務所向けだけ戻す」のあとに、キーボードで選び直しても、会場の先頭へ移る', () => {
      render(<App />);
      const dot = () => screen.getByRole('button', { name: /^熊本市を選ぶ/ });
      fireEvent.keyDown(dot(), { key: 'Enter' });
      fireEvent.click(screen.getByRole('button', { name: '事務所向けだけ戻す' }));
      fireEvent.keyDown(dot(), { key: 'Enter' });
      expect(document.activeElement).toBe(firstVenue('熊本市'));
    });
  });

  describe('同じ端末の連動（I-110・I-113 の事務所側）', () => {
    const open = () => {
      const fan = createLink(asBroadcastChannel);
      return fan;
    };

    it('会場を選ぶと、100 ms でまとめて、ファン向けに会場・費用・最低人数が届く', () => {
      vi.useFakeTimers();
      const fan = open();
      render(<App />);
      pickBase();
      openAdjust();
      type('最低人数', '80');
      act(() => {
        vi.advanceTimersByTime(PUBLISH_DEBOUNCE_MS);
      });
      expect(fan.getLinked()?.selection).toMatchObject({ venueId: 'cbox', minPeople: 80 });
      expect(fan.getLinked()?.selection.costs.venue).toBe(60000);
    });

    it('「デモを最初に戻す」は、ファン向けを戻す（resetAll）。「事務所向けだけ戻す」は、送らない', () => {
      vi.useFakeTimers();
      const fan = open();
      const onReset = vi.fn();
      fan.onResetAll(onReset);
      render(<App />);
      pickBase();
      fireEvent.click(screen.getByRole('button', { name: '事務所向けだけ戻す' }));
      expect(onReset).not.toHaveBeenCalled();
      expect(screen.queryByTestId('judge')).toBeNull();
      expect(screen.getByRole('status').textContent).toBe('事務所向けを最初に戻しました');
      fireEvent.click(screen.getByRole('button', { name: 'デモを最初に戻す' }));
      expect(onReset).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('status').textContent).toBe('最初に戻しました');
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(screen.getByRole('status').textContent).toBe('');
    });
  });
});
