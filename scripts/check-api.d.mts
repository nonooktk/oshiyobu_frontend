// check-api.mjs の型（テストから使うため）
import type { Item } from './accept-lib.mjs';
export function runCheckApi(options: {
  apiBase: string;
  webOrigin?: string;
  write?: boolean;
  lockVersion: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  samples?: number;
}): Promise<Item[]>;
export function originOf(raw: unknown): string;
