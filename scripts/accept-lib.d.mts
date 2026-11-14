// accept-lib.mjs の型（テストから使うため）
export type Status = 'pass' | 'fail' | 'skip' | 'warn';
export type Verdict = 'pass' | 'fail' | 'incomplete';
export type Item = {
  id: string;
  label: string;
  status: Status;
  detail: string;
  hints: string[];
  outputTail: string;
};
export type Section = { title: string; items: Item[] };
export type VerifyStep = {
  id: string;
  label: string;
  args: readonly string[];
  after?: string;
};

export const STATUS: {
  readonly PASS: 'pass';
  readonly FAIL: 'fail';
  readonly SKIP: 'skip';
  readonly WARN: 'warn';
};
export const STATUS_LABEL: Record<Status, string>;
export const VERDICT_LABEL: Record<Verdict, string>;
export const DEFAULT_API_PORT: number;
export const DEFAULT_WEB_PORT: number;
export const VERIFY_STEPS: readonly VerifyStep[];
export const GUIDES: Record<string, Partial<Record<Status, string>>>;
export const TEST_PERFORMANCE_ID: string;

export function makeItem(
  id: string,
  label: string,
  status: Status,
  detail?: string,
  hints?: string[],
  outputTail?: string,
): Item;
export function verdictOf(items: readonly Item[]): Verdict;
export function exitCodeOf(items: readonly Item[]): 0 | 1 | 2;
export function diagnoseTestOutput(output: string): string[];
export function listFailedTests(output: string, limit?: number): string[];
export function parseTestCounts(
  output: string,
): { failed: number; skipped: number; passed: number } | null;
export function guidanceLines(items: readonly Item[]): string[];
export function displayWidth(text: string): number;
export function renderReport(sections: readonly Section[]): string;
export function maskUrls(text: string, targets: readonly { url: string; as: string }[]): string;
export function isPresentationPerformance(id: unknown): boolean;
export function assertTestPerformance(id: string): void;
export function satisfiesNodeRange(version: string, range: string): boolean | null;
export function formatDuration(ms: number): string;
