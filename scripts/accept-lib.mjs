// 検収の共通部品（npm run verify・check:api・check:live・accept が使う。テストも使う）。
// 画面にも API にも触らない、純粋な関数だけを置く（ファイル・通信・プロセスは、各台本の側で扱う）。
//
// 考え方: 結果は「項目（item）」の配列。1 項目 = 表の 1 行 = 合格／不合格／飛ばした／注意 のどれか。
//   合格     … 確かめて、決まりどおりだった
//   不合格   … 確かめて、決まりと違った（直す。次に見る場所を出す）
//   飛ばした … 確かめられなかった（前提が足りない）。「合格」と紛れないよう、判定は「未完了」になる
//   注意     … 合否にはしない知らせ（応答が遅い・Node の版が範囲の外 など）
// 終了コード: 0 = すべて合格 / 1 = 不合格あり / 2 = 不合格はないが、飛ばした項目がある

export const STATUS = Object.freeze({ PASS: 'pass', FAIL: 'fail', SKIP: 'skip', WARN: 'warn' });
export const STATUS_LABEL = Object.freeze({
  pass: '合格',
  fail: '不合格',
  skip: '飛ばした',
  warn: '注意',
});

/**
 * 項目を作る。detail は 1 行の説明、hints は、この項目だけの追加の案内（無ければ空）、
 * outputTail は、落ちたときの出力の末尾（最後のまとめに添える。無ければ空）
 */
export function makeItem(id, label, status, detail = '', hints = [], outputTail = '') {
  return { id, label, status, detail, hints, outputTail };
}

/** 判定。不合格があれば fail、なければ飛ばした項目があれば incomplete、すべて合格（注意は含む）なら pass */
export function verdictOf(items) {
  if (items.some((item) => item.status === STATUS.FAIL)) return 'fail';
  if (items.some((item) => item.status === STATUS.SKIP)) return 'incomplete';
  return 'pass';
}

export const VERDICT_LABEL = Object.freeze({
  pass: '合格',
  fail: '不合格',
  incomplete: '未完了 — 飛ばした項目があるため、合格ではありません',
});

/** 手元で立てる API と、手元で配る画面の、既定の番号（どちらも 127.0.0.1。--api-port・--web-port で変えられる） */
export const DEFAULT_API_PORT = 8795;
export const DEFAULT_WEB_PORT = 5295;

export function exitCodeOf(items) {
  const verdict = verdictOf(items);
  return verdict === 'pass' ? 0 : verdict === 'fail' ? 1 : 2;
}

// ---------------------------------------------------------------------------
// 手元の検査（npm run verify）の中身。CI（ci.yml）は、これを npm run verify で呼ぶ。
// deploy.yml の検査（build・check:budget --strict-images・check:csp・core:check）も、すべてここに入っている
// （入っていることは tests/unit/accept-lib.test.ts が検査する）。直すときは、ここだけを直す。
// ---------------------------------------------------------------------------
export const VERIFY_STEPS = Object.freeze([
  { id: 'lint', label: 'lint（書き方の検査）', args: ['run', 'lint'] },
  { id: 'typecheck', label: '型チェック', args: ['run', 'typecheck'] },
  { id: 'format:check', label: '整形の確認', args: ['run', 'format:check'] },
  { id: 'test', label: 'テスト', args: ['run', 'test'] },
  { id: 'build', label: 'ビルド', args: ['run', 'build'] },
  {
    id: 'check:budget',
    label: '量の検査（絵は WebP だけ）',
    args: ['run', 'check:budget', '--', '--strict-images'],
    after: 'build',
  },
  { id: 'check:csp', label: '配信の設定（CSP）の検査', args: ['run', 'check:csp'], after: 'build' },
  { id: 'core:check', label: 'core が lock のとおり', args: ['run', 'core:check'] },
]);

/** テストの失敗を、ファイル名から読み解いた案内（FAIL の行に出るテストのファイル名 → 案内） */
const TEST_FILE_HINTS = Object.freeze({
  fonts:
    '書体の字: 画面に新しい字を足すと落ちます。docs/フォント.md の「5. 画面の字を足したとき」。絞り直しには Python と元のフォントが要ります。無いときは、漏れた字の一覧を添えて管理者へ',
  'type-scale':
    '文字の大きさの段: font-size に px を直接書いています（演出の中だけ許します）。src/styles/tokens.css の段のトークン（--fs-*）を使う（docs/フォント.md の「2. 文字の大きさの段」）',
  'forbidden-words':
    '画面に使わない語が src/ か HTML に入っています。CLAUDE.md の「画面の決まり」の語に言い換える',
  'demo-badge':
    '札「デモ用の架空データ」が消えています。全画面に出す決まりです（CLAUDE.md の「画面の決まり」）',
  'core-lock':
    'src/core/ を手で変えています（core:check と同じ原因）。変えた所を戻し、必要な変更は管理者へ',
  csp: '配信の設定か CSP を変えています。外部の読み込み（CDN・Web フォント・外部画像）を足していないか',
  'static-web-app-config':
    '配信の設定（public/staticwebapp.config.json）を変えています。ヘッダー・CSP の決まりを確かめる',
});

/** vitest の出力（FAIL の行）から、落ちたテストのファイルに当たる案内を集める */
export function diagnoseTestOutput(output) {
  const hints = [];
  const seen = new Set();
  for (const match of String(output).matchAll(/FAIL\s+(\S+?)\.test\.tsx?/g)) {
    const name = match[1].split('/').pop();
    const hint = TEST_FILE_HINTS[name];
    if (hint && !seen.has(name)) {
      seen.add(name);
      hints.push(`${name}.test: ${hint}`);
    }
  }
  return hints;
}

/** vitest の出力から、落ちたテスト（FAIL の行）を、重なりを除いて最大 limit 件、集める */
export function listFailedTests(output, limit = 8) {
  const lines = [];
  for (const match of String(output).matchAll(/^\s*FAIL\s+(.+)$/gm)) {
    const line = match[1].trim();
    if (!lines.includes(line)) lines.push(line);
  }
  return lines.slice(0, limit);
}

// 色の指定（ESC [ … m）。出力の読み取りの前に取り除く
const ANSI_COLOR = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

/** vitest の出力から、テストの件数（通った件数・落ちた件数）を読む。読めなければ null */
export function parseTestCounts(output) {
  const text = String(output).replace(ANSI_COLOR, '');
  const match = /Tests\s+(?:(\d+) failed \| )?(?:(\d+) skipped \| )?(\d+) passed/.exec(text);
  if (!match) return null;
  return {
    failed: Number(match[1] ?? 0),
    skipped: Number(match[2] ?? 0),
    passed: Number(match[3]),
  };
}

// ---------------------------------------------------------------------------
// 落ちたときの案内（項目の id → 状態ごとの案内）。CLAUDE.md の「落ちたときの見分け方」の表と同じ内容
// ---------------------------------------------------------------------------
const NEED_API =
  'API の接続先が渡されていません。VITE_API_BASE（GitHub の Variable と同じ値。管理者に聞く）を環境変数で渡すか、`npm run accept -- --local-api` で手元の API を立てて確かめる';
export const GUIDES = Object.freeze({
  'verify.node': {
    warn: 'Node を、必要な版（package.json の engines。docs/はじめに.md の C 節）に入れ替える。ほかの検査が落ちたときは、先にこれを直す',
  },
  'verify.deps': { fail: '依存が入っていません。`npm ci` を実行してから、もう一度実行する' },
  lint: {
    fail: '書き方の検査。出力の最初のエラー（ファイルと行）から直す。`npm run lint -- --fix` で直るものもある。通信（fetch）は src/shared/meter/ の中だけで行う',
  },
  typecheck: {
    fail: '型の検査。出力の `error TS` の行を直す。`any` や `@ts-ignore` で逃げない（検査をゆるめるときは申告が要る）',
  },
  'format:check': {
    fail: '整形の違い。`npm run format` で整えて、差分を確かめてから、整形だけの変更として commit する',
  },
  test: {
    fail: 'テストの失敗。出力の FAIL の行のテストから見る。期待値を変えて通さない（直すのは画面の側）。個別の原因は、下の案内（テストのファイル名ごと）も見る',
  },
  build: {
    fail: 'ビルドの失敗。出力の最初のエラーを見る。import の綴りや、消したファイルの参照が多い',
  },
  'check:budget': {
    fail: '量・絵の検査。最初に読む JS・CSS が gzip で 200 KB 超 → 新しい依存や大きなコードを足していないか。絵が jpg・png のまま → `npm run images`（元絵は assets-src/）で WebP にする。書体の量の超過は管理者へ',
  },
  'check:csp': {
    fail: '配信の設定（CSP）の検査。外部の読み込み（CDN・Web フォント・外部画像・外部への通信）を足していないか。足したものを外す。API の接続先だけは VITE_API_BASE で入る',
  },
  'core:check': {
    fail: 'src/core/ が core.lock.json と違います。src/core/ は手で直さない。`git diff -- src/core` で変えた所を確かめ、担当者に確認してから戻す。必要な変更は backend で直す依頼を管理者へ（core:sync は管理者だけ）',
  },
  'api.target': { skip: NEED_API },
  'api.health': {
    fail: '接続できない・200 でない → 接続先の値が違うか、API が止まっています（管理者へ）。coreVersion の不一致 → backend が先に進んだか、core.lock.json が古い（管理者へ。自分で core:sync しない）',
  },
  'api.meter': {
    fail: '応答の形が決まりと違います（正本は src/core/schema/meter.ts の parseMeterResponse）。API の版が違う可能性。src/core/ は手で直さず、管理者へ',
  },
  'api.notfound': {
    fail: '存在しない公演が 404 になりません。API の版が違う可能性（管理者へ）',
  },
  'api.cors.allow': {
    fail: '画面の接続元が、API の許可（CORS_ORIGINS）と違います。API の設定は管理者が直す（管理者へ）。手元の API なら、`--local-api` でやり直すと接続元がそろう',
    skip: '画面の接続元が渡されていないか、API に接続できないため、確かめていません。前者は、公開中の画面なら SWA_BASE_URL、手元の画面なら `--web-origin` を渡す（accept は自動で渡す）。後者は、先に /healthz の項目を直す',
  },
  'api.cors.deny': {
    fail: '知らない接続元まで許しています（API の CORS の設定ミス。管理者へ）',
    skip: '画面の接続元が渡されていないか、API に接続できないため、確かめていません（「CORS: 画面の接続元を許す」と同じ）',
  },
  'api.cors.preflight': {
    fail: '発表者用の初期化（reset）の事前の問い合わせ（OPTIONS）が通りません。API の CORS の設定（管理者へ）',
    skip: '画面の接続元が渡されていないか、API に接続できないため、確かめていません（「CORS: 画面の接続元を許す」と同じ）',
  },
  'api.timing': {
    warn: '応答が遅めです。回線や、API の起動直後（コールドスタート）の可能性。もう一度実行して、続くなら管理者へ',
  },
  'api.write': {
    fail: '申し込みの動き（端末の番号で冪等・人数が 1 だけ増える）が決まりと違います。API の版を確かめる（管理者へ）。手元の API では `--local-api` でやり直す',
  },
  'api.local': {
    fail: '手元の API を立てられませんでした。理由（表の詳細）を見る。ネットワーク（GitHub への接続）・ポートの使用中（--api-port）・Node の版が多い',
  },
  'live.build': {
    fail: '手元の画面のビルドか、配るサーバーの起動に失敗しました。ビルドは verify の build と同じ原因。ポートが使用中なら --web-port で別の番号を',
  },
  'live.target': {
    skip: '手元の画面は VITE_API_BASE（または `--local-api`）、公開中の画面は SWA_BASE_URL が要ります',
  },
  'live.browser': {
    fail: 'Chrome を起動できません。Google Chrome を入れる。別の Chromium を使うなら、先に `npx playwright install chromium` をして ACCEPT_CHANNEL=chromium を渡す',
  },
  'live.page': {
    fail: 'コンソールのエラー → 文言を見る（CSP の違反なら外部の読み込み、CORS なら接続元〈管理者へ〉）。失敗した通信 → 404 は存在しないファイルの読み込み。札が無い → DemoBadge を消していないか（全画面に出す決まり）',
  },
  'live.meter': {
    fail: '/fan/ からメーターの取得が出ない・200 でない・CORS で許されていない。VITE_API_BASE がビルドに入っていない／check:csp が落ちている（connect-src に API が無い）／API が止まっている／接続元が API の許可と違う（管理者へ）',
  },
});

/** 項目の案内の本文を探す（api.write.first のような枝は、親の api.write の案内を使う） */
function guideText(item) {
  const keys = [item.id, item.id.split('.').slice(0, 2).join('.')];
  for (const key of keys) {
    const text = GUIDES[key]?.[item.status];
    if (text) return text;
  }
  // 専用の案内が無い「飛ばした」は、詳細の欄の理由（前提が足りない）を直して、やり直す
  return item.status === STATUS.SKIP
    ? '前提が足りず、確かめていません。詳細の欄の理由を直して、もう一度実行する'
    : null;
}

/** 不合格・飛ばした・注意の項目について、「次に見る場所」の行を作る */
export function guidanceLines(items) {
  const lines = [];
  for (const item of items) {
    if (item.status === STATUS.PASS) continue;
    const texts = [guideText(item), ...item.hints].filter(Boolean);
    for (const text of texts) {
      lines.push(`- [${STATUS_LABEL[item.status]}] ${item.label}: ${text}`);
    }
  }
  return lines;
}

// ---------------------------------------------------------------------------
// 表の出力。全角の字は 2 桁として数えて、桁をそろえる
// ---------------------------------------------------------------------------
const WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹯＀-｠￠-￦]/;
export function displayWidth(text) {
  let width = 0;
  for (const ch of String(text)) width += WIDE.test(ch) ? 2 : 1;
  return width;
}
const padEndWidth = (text, width) => text + ' '.repeat(Math.max(0, width - displayWidth(text)));

/** 落ちた検査の出力の末尾を、最後のまとめに添える行数 */
const TAIL_LINES = 20;

/** sections: [{ title, items }]。表（Markdown の表の形。そのままチャットに貼れる）と、判定と、案内を返す */
export function renderReport(sections) {
  const all = sections.flatMap((section) => section.items);
  const out = [];
  for (const section of sections) {
    if (section.items.length === 0) continue;
    // 表の区切りの | は逃がす（Markdown の表として、そのまま貼れるように）
    const escape = (text) => String(text).replace(/\|/g, '\\|');
    const rows = section.items.map((item) => [
      STATUS_LABEL[item.status],
      escape(item.label),
      escape(item.detail),
    ]);
    const head = ['結果', '項目', '詳細'];
    const widths = head.map((cell, column) =>
      Math.max(displayWidth(cell), ...rows.map((row) => displayWidth(row[column]))),
    );
    const line = (cells) => `| ${cells.map((c, i) => padEndWidth(c, widths[i])).join(' | ')} |`;
    out.push(
      `■ ${section.title}`,
      '',
      line(head),
      `| ${widths.map((w) => '-'.repeat(w)).join(' | ')} |`,
    );
    for (const row of rows) out.push(line(row));
    out.push('');
  }
  const count = (status) => all.filter((item) => item.status === status).length;
  out.push(
    `判定: ${VERDICT_LABEL[verdictOf(all)]}` +
      `（合格 ${count(STATUS.PASS)}・不合格 ${count(STATUS.FAIL)}・飛ばした ${count(STATUS.SKIP)}・注意 ${count(STATUS.WARN)}）`,
  );
  const guidance = guidanceLines(all);
  if (guidance.length > 0) out.push('', '次に見る場所:', ...guidance);
  for (const item of all) {
    if (item.status !== STATUS.FAIL || !item.outputTail) continue;
    const lines = item.outputTail.trimEnd().split('\n').slice(-TAIL_LINES);
    out.push('', `--- ${item.label} の出力の末尾（${lines.length} 行）---`, ...lines);
  }
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// URL の伏せ字。画面の公開 URL と API の接続先は、出力に出さない（<SWA>・<API> などに置き換える）
// ---------------------------------------------------------------------------
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * text の中の、targets（[{ url, as }]）に当たる文字を、as に置き換える。
 * 完全な URL・origin・host（ポートつき）の順に、長いものから置き換える。大文字小文字は区別しない
 */
export function maskUrls(text, targets) {
  const pairs = [];
  for (const { url, as } of targets) {
    if (!url) continue;
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }
    pairs.push([url, as], [parsed.origin, as], [parsed.host, as]);
  }
  pairs.sort((a, b) => b[0].length - a[0].length);
  let out = String(text);
  for (const [needle, as] of pairs) {
    if (needle) out = out.replace(new RegExp(escapeRegExp(needle), 'gi'), as);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 書き込みの試験の相手。発表に使う公演には、絶対に送らない
// ---------------------------------------------------------------------------
/** 書き込みの試験に使う、発表に使わない公演（<推し>:<会場>）。ほかの公演には送らない */
export const TEST_PERFORMANCE_ID = 'terao:KGS-001';
/** 発表に使う公演の推しの印（tech0:cbox など）。この印で始まる公演には、読み取り以外をしない */
const PRESENTATION_PREFIX = 'tech0:';

export function isPresentationPerformance(id) {
  return typeof id === 'string' && id.trim().toLowerCase().startsWith(PRESENTATION_PREFIX);
}

/** 書き込んでよい公演か確かめる。だめなら例外（発表に使う公演・試験用でない公演・形の違うもの） */
export function assertTestPerformance(id) {
  if (isPresentationPerformance(id)) {
    throw new Error('発表に使う公演には、書き込みません');
  }
  if (id !== TEST_PERFORMANCE_ID) {
    throw new Error(`書き込みは、試験用の公演（${TEST_PERFORMANCE_ID}）だけに行います`);
  }
}

// ---------------------------------------------------------------------------
// Node の版（package.json の engines.node）。対応するのは ^X.Y.Z と >=X.Y.Z を || でつないだ形だけ
// ---------------------------------------------------------------------------
const parseVersion = (text) => {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(text).trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
};
const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** version が range に入るか。range を読めないときは null（判定できない） */
export function satisfiesNodeRange(version, range) {
  const v = parseVersion(version);
  if (!v) return null;
  let understood = false;
  for (const part of String(range).split('||')) {
    const match = /^\s*(\^|>=)\s*(\d+\.\d+\.\d+)\s*$/.exec(part);
    if (!match) continue;
    understood = true;
    const base = parseVersion(match[2]);
    const upper = match[1] === '^' ? [base[0] + 1, 0, 0] : null;
    if (compare(v, base) >= 0 && (upper === null || compare(v, upper) < 0)) return true;
  }
  return understood ? false : null;
}

/** 秒・ミリ秒の表示 */
export function formatDuration(ms) {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} 秒`;
}
