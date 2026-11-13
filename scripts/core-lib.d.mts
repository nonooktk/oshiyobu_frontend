// core-lib.mjs の型（テストから使うため）
export const ROOT: string;
export const CORE_DIR: string;
export const LOCK_PATH: string;
export const BACKEND_REPOSITORY: string;
export function listFiles(dir: string): string[];
export function treeSha256(dir: string): string;
export function readCoreVersion(dir: string): string;
export function readLock(): {
  source: string;
  repository: string;
  commit: string;
  coreVersion: string;
  treeSha256: string;
};
