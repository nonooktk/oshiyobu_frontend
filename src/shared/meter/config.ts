import { normalizeApiBase } from './apiBase';

/** API の接続先。ビルド時に VITE_API_BASE で渡す。未設定なら空（サーバーなしで動く） */
export const API_BASE: string = normalizeApiBase(import.meta.env.VITE_API_BASE);
