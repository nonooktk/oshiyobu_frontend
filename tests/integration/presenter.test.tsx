// 発表者用（/presenter/）（I-127。仕様 SP-67）。リセットは 2 段（合言葉 + RESET）。結果は原因ごとに分ける
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/presenter/App';

const meter = vi.hoisted(() => ({
  API_CONFIGURED: true,
  resetSharedMeter: vi.fn(),
  checkApiHealth: vi.fn(),
}));
vi.mock('../../src/shared/meter', () => meter);

const armAndConfirm = (passphrase: string, confirm = 'RESET') => {
  fireEvent.change(screen.getByLabelText('合言葉'), { target: { value: passphrase } });
  fireEvent.click(screen.getByRole('button', { name: 'リセットする' }));
  fireEvent.change(screen.getByLabelText(/RESET と入力/), { target: { value: confirm } });
};

describe('発表者用', () => {
  beforeEach(() => {
    meter.resetSharedMeter.mockReset();
    meter.checkApiHealth.mockReset();
    meter.API_CONFIGURED = true;
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('札「デモ用の架空データ」が出る。合言葉の欄は type=password', () => {
    render(<App />);
    expect(screen.getByText('デモ用の架空データ')).toBeTruthy();
    expect(screen.getByLabelText('合言葉').getAttribute('type')).toBe('password');
  });

  it('「リセットする」を押すまで、確認の欄は出ない。RESET（大文字・半角・完全一致）になるまで「実行する」は押せない', () => {
    render(<App />);
    expect(screen.queryByLabelText(/RESET と入力/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'リセットする' }));
    const run = screen.getByRole('button', { name: '実行する' }) as HTMLButtonElement;
    for (const wrong of ['', 'reset', 'RESET ', ' RESET', 'ＲＥＳＥＴ', 'RESE']) {
      fireEvent.change(screen.getByLabelText(/RESET と入力/), { target: { value: wrong } });
      expect(run.disabled).toBe(true);
    }
    fireEvent.change(screen.getByLabelText(/RESET と入力/), { target: { value: 'RESET' } });
    expect(run.disabled).toBe(false);
  });

  it.each([
    [{ kind: 'unauthorized' }, '合言葉が違います'],
    [{ kind: 'not_configured' }, 'サーバーに合言葉が設定されていません（12 文字以上が要る）'],
    [{ kind: 'timeout' }, '応答がありません。結果は不明です。もう一度実行できます'],
    [{ kind: 'network' }, '通信できません'],
    [{ kind: 'error', status: 500 }, '予期しない応答でした。もう一度実行できます'],
  ])('結果は原因ごとに分けて出す（%o）。何度でも実行し直せる', async (outcome, message) => {
    meter.resetSharedMeter.mockResolvedValue(outcome);
    render(<App />);
    armAndConfirm('dummy-passphrase');
    fireEvent.click(screen.getByRole('button', { name: '実行する' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(message));
    expect(screen.getByRole('button', { name: '実行する' })).toBeTruthy(); // 確認の欄は残り、もう一度実行できる
    expect(meter.resetSharedMeter).toHaveBeenCalledWith('dummy-passphrase');
  });

  it('合言葉に、HTTP ヘッダーに載せられない文字（印字できる ASCII 以外）が入っていたら、送らずに「半角の英数字と記号」と出す。半角に直せば送れる（G2-03）', async () => {
    meter.resetSharedMeter.mockResolvedValue({ kind: 'ok', resetAt: '2026-11-18T01:02:03.000Z' });
    render(<App />);
    armAndConfirm('dummy-passphrase');
    for (const bad of [
      'あいうえおかきくけこさし', // 全角（日本語）
      'ＰＡＳＳＷＯＲＤ１２３４', // 全角の英数字
      'café-passphrase', // ASCII の外の文字
      'pass\tword-1234', // タブ（印字できない）
    ]) {
      fireEvent.change(screen.getByLabelText('合言葉'), { target: { value: bad } });
      fireEvent.click(screen.getByRole('button', { name: '実行する' }));
      expect(screen.getByRole('status').textContent).toBe(
        '合言葉は半角の英数字と記号で入力してください',
      );
    }
    expect(meter.resetSharedMeter).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('合言葉'), {
      target: { value: 'Half-width_Pass 12!~' },
    });
    fireEvent.click(screen.getByRole('button', { name: '実行する' }));
    await waitFor(() =>
      expect(meter.resetSharedMeter).toHaveBeenCalledWith('Half-width_Pass 12!~'),
    );
  });

  it('成功したら、「リセットしました」と初期化の時刻を出し、合言葉の欄を空にする。合言葉はどこにも保存しない', async () => {
    meter.resetSharedMeter.mockResolvedValue({ kind: 'ok', resetAt: '2026-11-18T01:02:03.000Z' });
    render(<App />);
    armAndConfirm('dummy-passphrase');
    fireEvent.click(screen.getByRole('button', { name: '実行する' }));
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe(
        'リセットしました（初期化の時刻: 2026-11-18T01:02:03.000Z）',
      ),
    );
    expect((screen.getByLabelText('合言葉') as HTMLInputElement).value).toBe('');
    expect(screen.queryByLabelText(/RESET と入力/)).toBeNull();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('接続の確認: 応答時間を出す。つながらなければ「つながっていません」。接続先が無いときは、そう書く', async () => {
    meter.checkApiHealth
      .mockResolvedValueOnce({ ok: true, ms: 42 })
      .mockResolvedValueOnce({ ok: false, ms: 0 });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '接続を確認する' }));
    await waitFor(() => expect(screen.getByText('つながっています（応答 42 ms）')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: '接続を確認する' }));
    await waitFor(() => expect(screen.getByText('つながっていません')).toBeTruthy());
    cleanup();
    meter.API_CONFIGURED = false;
    render(<App />);
    expect(screen.getByText(/接続先が設定されていません/)).toBeTruthy();
  });
});
