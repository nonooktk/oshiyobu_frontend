export const FIRST_LOAD_LIMIT: number;
export const FAN_WARN_LIMIT: number;
export const FONT_LIMIT: number;
export const FONT_SIM_LIMIT: number;
export function firstLoadFiles(
  manifest: Record<string, unknown>,
  entryKey: string,
): { js: string[]; css: string[] };
export function evaluate(args: {
  manifest: Record<string, unknown>;
  read: (path: string) => Buffer;
  images: readonly { out: string; maxBytes: number }[];
  listBundle: () => string[];
  searchText: (needle: string) => boolean;
  fonts?: readonly { name: string; bytes: number }[];
  strictImages?: boolean;
}): {
  errors: string[];
  warnings: string[];
  report: { page: string; gzip: number; files: number }[];
  fontReport: { core: number; sim: number };
};
