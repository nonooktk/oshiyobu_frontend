import { normalizeApiBase } from './apiBase';

/** API の接続先。ビルド時に VITE_API_BASE で渡す。未設定なら空（サーバーなしで動く） */
export const API_BASE: string = normalizeApiBase(import.meta.env.VITE_API_BASE);

/**
 * 共有メーター（全員の申し込みを、API で集める形）を使うか。ビルド時の VITE_SHARED_METER が、ちょうど on のときだけ。
 * 既定（変数なし）は「ひとり体験」で、人数を端末の中だけで数え、ファン向けは API を呼ばない（API の接続先が渡されていても）。
 * 発表者用の画面の接続の確認・リセットは、この値に関わらず、API の接続先を使う
 */
export const SHARED_METER_ON: boolean = import.meta.env.VITE_SHARED_METER === 'on';

/** ファン向けの共有メーターの接続先。ひとり体験では空（通信しない。接続先が無いときと同じ動き） */
export const METER_BASE: string = SHARED_METER_ON ? API_BASE : '';
