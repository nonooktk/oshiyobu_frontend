// api-check-lib.mjs の型（テストから使うため）
export type Judged = { ok: boolean; detail: string };
export const SLOW_MS: number;
export const UNKNOWN_ORIGIN: string;
export function meterBodyErrors(body: unknown, performanceId: string): string[];
export function judgeHealth(args: { status: number; body: unknown; lockVersion: string }): Judged;
export function judgeMeter(args: { status: number; body: unknown; performanceId: string }): Judged;
export function judgeNotFound(args: { status: number }): Judged;
export function judgeCorsAllow(args: { allowOrigin: string; origin: string }): Judged;
export function judgeCorsDeny(args: { allowOrigin: string; unknownOrigin?: string }): Judged;
export function judgePreflight(args: {
  status: number;
  allowOrigin: string;
  allowHeaders: string;
  origin: string;
}): Judged;
export function judgeTiming(args: { times: readonly number[]; limitMs?: number }): {
  slow: boolean;
  detail: string;
};
export function judgeJoin(args: {
  status: number;
  body: unknown;
  performanceId: string;
  expectCounted: boolean;
}): Judged;
export function judgeCountIncrease(args: { before: number; after: number }): Judged;
export function isMeterUrl(url: string): boolean;
export function judgeLiveMeter(args: {
  responses: readonly { status: number; allowOrigin: string; origin?: string }[];
  pageOrigin: string;
  apiOrigin?: string;
  failures?: readonly string[];
}): Judged;
