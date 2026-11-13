/**
 * API の接続先（ビルド時の環境変数 VITE_API_BASE）を、末尾の / を除いた origin にする。
 * 空・未設定・http(s) 以外・URL でないものは、空文字（＝サーバーなし。画面は初期値のまま動く）にする。
 */
export function normalizeApiBase(raw: unknown): string {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return '';
  }
  try {
    const url = new URL(raw.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : '';
  } catch {
    return '';
  }
}
