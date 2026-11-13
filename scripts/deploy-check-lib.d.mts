type Res = { path: string; status: number; headers: Record<string, string> };
export const PAGES: string[];
export function checkPage(res: Res): string[];
export function checkBundle(res: Res): string[];
export function checkCoreVersion(args: {
  health: { coreVersion?: string } | null;
  lockVersion: string;
}): string[];
