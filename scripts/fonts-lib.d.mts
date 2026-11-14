// fonts-lib.mjs の型（テストから使うため）
type Glyphs = {
  included: Set<string>;
  extra: Set<string>;
  missing: Set<string>;
  display: Set<string>;
  displayMissing: Set<string>;
};

export const FONT_DIR: string;
export const FONT_FILES: string[];
export const EXTRA_FILES: string[];
export const GLYPHS_FILE: string;
export const DISPLAY_FILE: string;
export const DISPLAY_FAMILY: string;
export const LICENSE_FILES: string[];
export const SIMULATOR_CSS: string;
export const SIMULATOR_FILE: string;
export const BASE_CHARS: string;
export function collectChars(text: string, kind: 'ts' | 'tsx' | 'js' | 'css' | 'html'): Set<string>;
export function screenSourceFiles(root: string): string[];
export function collectScreenCharsByFile(root: string): Map<string, Set<string>>;
export function collectScreenChars(root: string): Map<string, string>;
export function requestedChars(root: string): { core: string; extra: string };
export function parseGlyphs(text: string): Glyphs;
export function formatGlyphs(glyphs: Glyphs): string;
export function findMissingGlyphs(screen: Map<string, string>, listed: Glyphs): Map<string, string>;
export function findMissingDisplayGlyphs(
  byFile: Map<string, Set<string>>,
  listed: Glyphs,
): Map<string, string>;
export function missingMessage(missing: Map<string, string>): string;
export function unicodeRange(chars: string): string;
export function parseUnicodeRange(range: string): Set<number>;
export function simulatorCss(extra: string): string;
export function readWoff2Cmap(buffer: Buffer): Set<number>;
