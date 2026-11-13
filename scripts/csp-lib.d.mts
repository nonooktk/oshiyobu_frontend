export function parseCsp(csp: string): Record<string, string[]>;
export function checkCsp(args: { config: unknown; fanHtml: string; apiOrigin: string }): string[];
