// @vitest-environment node
// 音源ファイルの検査（G-04）。称賛の音のうち、申し込んだ瞬間（join）・仲間を呼んだ瞬間（friend）・最後の演出（fever）の 3 場面だけ、
// 音源ファイルに差し替えてよい。置き場は public/sounds/ だけで、同じ場所の台帳（ledger.md）に、出どころ・作者・ライセンス・確認日を書く。
//   ① 台帳に無い音声ファイルがある ② 台帳にあるのにファイルが無い ③ ライセンスが CC0・自作以外 ④ 置き場の外に音声ファイルがある
//   ⑤ 場面が join・friend・fever 以外／1 つの場面に 2 つ ⑥ 出どころ・確認日などの欄が欠けている（出どころを複数書く行は、どれも URL と作者がそろう）
//   ⑦ 賭けを連想させる語（ファイル名・どんな音）
// のどれかで落ちる。落ちたら、直さずに、管理者（統括）へ。
// 限界: 音の聞こえ方は見つけられない（ファイルの中身は、機械では判断できない）。PR のレビューで、耳で確かめる。
import { describe, expect, it } from 'vitest';
import { FILE_CUES, SOUND_FILES } from '../../src/fan/sound-files';
import {
  LUCK_WORDS,
  SOUND_WORDS,
  between,
  exists,
  guardMessage,
  read,
  stripComments,
  walk,
  withExt,
} from './helpers';

/** 音声ファイルの置き場（唯一） */
const SOUNDS_DIR = 'public/sounds';
const LEDGER_PATH = `${SOUNDS_DIR}/ledger.md`;
/** 音源ファイルに差し替えてよい場面（G-04） */
const ALLOWED_CUES = ['join', 'friend', 'fever'];
/** 使えるライセンス（G-04）。CC0 は、権利を放棄した公開の音。自作は、チームが作った音 */
const ALLOWED_LICENSES = ['CC0', '自作'];
/** 音声ファイルの拡張子（小文字で比べる） */
const AUDIO_EXTS = [
  '.mp3',
  '.wav',
  '.ogg',
  '.oga',
  '.m4a',
  '.aac',
  '.flac',
  '.opus',
  '.weba',
  '.aif',
  '.aiff',
  '.wma',
  '.mid',
  '.midi',
];
/** 賭けを連想させる音を表す英語の語（ファイル名・どんな音の欄に書かない。日本語は helpers.ts の一覧） */
const EN_WORDS = [
  'coin',
  'slot',
  'jackpot',
  'casino',
  'roulette',
  'lottery',
  'gacha',
  'cash',
  'drum roll',
  'drumroll',
  'cha-ching',
  'ka-ching',
];
/** 台帳の表の列（この順に、9 つ） */
const COLUMNS = [
  'ファイル',
  '場面',
  'どんな音',
  '出どころ',
  '作者',
  'ライセンス',
  '確認日',
  '元の長さ',
  '加工の内容',
];

interface LedgerRow {
  file: string;
  cue: string;
  sound: string;
  source: string;
  author: string;
  license: string;
  checked: string;
  processing: string;
}

/**
 * 1 つの欄（出どころ・作者）に、複数書くときは <br> で区切る（1 つのファイルを、2 つの素材を混ぜて作ったとき。C がそう）。
 * 区切った 1 つずつが、出どころ 1 か所・作者 1 人分。前に「ファンファーレ: 」のような名札を付けてよい。
 */
const parts = (cell: string): string[] => cell.split(/<br\s*\/?>/i).map((part) => part.trim());
/** 出どころ 1 か所（CC0 のとき）。名札（任意）のあとに、公開のページの URL（https://）だけ */
const SOURCE_PART = /^(?:[^\s:：]+[:：]\s*)?https:\/\/\S+$/;

/** 台帳の表（印 ledger:start〜ledger:end の間）を読む。読めない行・印が無いときは、problems に書く */
function parseLedger(text: string): { rows: LedgerRow[]; problems: string[] } {
  const body = between(text, '<!-- ledger:start -->', '<!-- ledger:end -->');
  if (body === null) {
    return { rows: [], problems: ['台帳の表の印（ledger:start・ledger:end）がありません'] };
  }
  const rows: LedgerRow[] = [];
  const problems: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((cell) => cell.trim().replace(/^`|`$/g, ''));
    if (cells[0] === COLUMNS[0] || cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
    if (cells.length !== COLUMNS.length || cells.some((cell) => cell === '')) {
      problems.push(
        `台帳の行「${cells[0] ?? ''}」: ${COLUMNS.join('・')} の ${COLUMNS.length} 欄が、すべて埋まっていません`,
      );
      continue;
    }
    const [
      file = '',
      cue = '',
      sound = '',
      source = '',
      author = '',
      license = '',
      checked = '',
      ,
      processing = '',
    ] = cells;
    rows.push({ file, cue, sound, source, author, license, checked, processing });
  }
  return { rows, problems };
}

const isRealDate = (text: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text);
};

/**
 * 台帳と、リポジトリの音声ファイルを突き合わせて、問題の一覧を返す（空なら問題なし）。
 * audioPaths は、リポジトリの中の音声ファイルの、一番上からのパス（/ 区切り）。
 * mapped は、コード（src/fan/sound-files.ts の対応表）の、場面 → 読む先（URL）。渡したときは、台帳と同じ内容かも見る。
 */
function inspectSounds(
  ledgerText: string,
  audioPaths: readonly string[],
  mapped?: Readonly<Record<string, string>>,
): string[] {
  const { rows, problems } = parseLedger(ledgerText);
  const inDir = (path: string): boolean => path.startsWith(`${SOUNDS_DIR}/`);
  const ledgerFiles = new Set(rows.map((row) => `${SOUNDS_DIR}/${row.file}`));

  for (const path of audioPaths) {
    if (!inDir(path))
      problems.push(`${path}: 置き場（${SOUNDS_DIR}/）の外に、音声ファイルがあります`);
    else if (!ledgerFiles.has(path))
      problems.push(`${path}: 台帳（${LEDGER_PATH}）に、書かれていません`);
  }
  const seenFiles = new Set<string>();
  const seenCues = new Set<string>();
  for (const row of rows) {
    const path = `${SOUNDS_DIR}/${row.file}`;
    if (!audioPaths.includes(path))
      problems.push(`${row.file}: 台帳にあるのに、ファイルがありません`);
    if (seenFiles.has(row.file)) problems.push(`${row.file}: 台帳に 2 行あります`);
    seenFiles.add(row.file);
    if (!ALLOWED_CUES.includes(row.cue)) {
      problems.push(
        `${row.file}: 場面「${row.cue}」は使えません（${ALLOWED_CUES.join('・')} だけ）`,
      );
    } else if (seenCues.has(row.cue)) {
      problems.push(
        `${row.file}: 場面「${row.cue}」に、ファイルが 2 つあります（1 場面に 1 ファイル）`,
      );
    }
    seenCues.add(row.cue);
    if (!ALLOWED_LICENSES.includes(row.license)) {
      problems.push(
        `${row.file}: ライセンス「${row.license}」は使えません（${ALLOWED_LICENSES.join('・')} だけ）`,
      );
    }
    // 出どころが複数（<br> 区切り）のときは、どれも URL でなければならない。作者も、出どころと同じ数（1 か所ごとに 1 人分）、空でなく書く
    const sources = parts(row.source);
    const authors = parts(row.author);
    if (row.license === 'CC0' && !sources.every((part) => SOURCE_PART.test(part))) {
      problems.push(`${row.file}: 出どころは、公開のページの URL（https://）で書きます`);
    }
    if (sources.length !== authors.length || authors.some((part) => part === '')) {
      problems.push(
        `${row.file}: 出どころ ${sources.length} か所に対して、作者が ${authors.length} 人分です（出どころごとに、作者を書きます）`,
      );
    }
    if (!isRealDate(row.checked)) {
      problems.push(`${row.file}: 確認日「${row.checked}」を、YYYY-MM-DD の実在の日で書きます`);
    }
    const words = [...LUCK_WORDS, ...SOUND_WORDS].filter(
      (word) =>
        row.sound.includes(word) || row.processing.includes(word) || row.file.includes(word),
    );
    const lower = `${row.file} ${row.sound}`.toLowerCase();
    const enHits = EN_WORDS.filter((word) => lower.includes(word));
    if (words.length + enHits.length > 0) {
      problems.push(
        `${row.file}: 賭けを連想させる語「${[...words, ...enHits].join('・')}」があります（音源ファイルにも入れない）`,
      );
    }
  }
  if (mapped !== undefined) {
    for (const [cue, url] of Object.entries(mapped)) {
      const file = /^\/sounds\/([\w.-]+)$/.exec(url)?.[1];
      if (file === undefined) {
        problems.push(
          `対応表の ${cue}: 読む先「${url}」は、同じ配信元の /sounds/ の下のファイルではありません`,
        );
        continue;
      }
      const row = rows.find((item) => item.file === file);
      if (row === undefined) problems.push(`対応表の ${cue}: ${file} が、台帳にありません`);
      else if (row.cue !== cue) {
        problems.push(`対応表の ${cue}: ${file} の場面が、台帳では「${row.cue}」です（食い違い）`);
      }
    }
    for (const row of rows) {
      if (mapped[row.cue] !== `/sounds/${row.file}`) {
        problems.push(
          `${row.file}: 台帳にあるのに、対応表（src/fan/sound-files.ts）の ${row.cue} に書かれていません`,
        );
      }
    }
  }
  return problems;
}

const ledgerRow = (over: Partial<Record<(typeof COLUMNS)[number], string>> = {}): string => {
  const base: Record<string, string> = {
    ファイル: 'A-join.mp3',
    場面: 'join',
    どんな音: 'やわらかい鉄琴の上がる音',
    出どころ: 'https://example.test/sounds/1/',
    作者: 'テスト',
    ライセンス: 'CC0',
    確認日: '2026-11-15',
    元の長さ: '3.45 秒',
    加工の内容: '2.2 秒に切る',
    ...over,
  };
  return `| ${COLUMNS.map((name) => base[name]).join(' | ')} |`;
};
const ledgerOf = (...rows: string[]): string =>
  [
    '<!-- ledger:start -->',
    `| ${COLUMNS.join(' | ')} |`,
    `| ${COLUMNS.map(() => '---').join(' | ')} |`,
    ...rows,
    '<!-- ledger:end -->',
  ].join('\n');

describe('音源ファイルの台帳と置き場（G-04）', () => {
  // 大文字小文字を区別して台帳と比べるため、元のパスを残す（拡張子だけ、小文字にして判定する）
  const actualPaths = walk('').filter((path) =>
    AUDIO_EXTS.some((ext) => path.toLowerCase().endsWith(ext)),
  );

  it('検査の対象を読めている（空振りしていない）。台帳があり、表の印がある', () => {
    expect(walk('')).toContain('package.json');
    const message = guardMessage('G-04', `音源の台帳（${LEDGER_PATH}）がありません`);
    expect(exists(LEDGER_PATH), message).toBe(true);
    expect(read(LEDGER_PATH), message).toContain('<!-- ledger:start -->');
    expect(read(LEDGER_PATH), message).toContain('<!-- ledger:end -->');
  });

  it('G-04: 音声ファイルは、置き場（public/sounds/）の、台帳に書いたものだけ。出どころ・作者・ライセンス（CC0 か自作）・確認日がそろい、場面は join・friend・fever だけ', () => {
    // 台帳が無いときも、読めないエラーではなく、どのファイルが台帳に無いかを出す
    const mapped = Object.fromEntries(
      Object.entries(SOUND_FILES).map(([cue, file]) => [cue, file.url]),
    );
    const problems = inspectSounds(
      exists(LEDGER_PATH) ? read(LEDGER_PATH) : '',
      actualPaths,
      mapped,
    );
    expect(
      problems,
      guardMessage('G-04', '音源ファイルの置き場・台帳の決まりに反しています'),
    ).toEqual([]);
  });
});

describe('音源ファイルを読むコード（G-04）', () => {
  it('音源ファイルに使える場面は、join・friend・fever だけ（コードの型と、この検査の一覧が同じ）', () => {
    expect([...FILE_CUES]).toEqual(ALLOWED_CUES);
    for (const cue of Object.keys(SOUND_FILES)) expect(ALLOWED_CUES, cue).toContain(cue);
  });

  it('fetch を直接呼ぶのは、API の通信（src/shared/meter/）と、音源を同じ配信元から読む 1 か所（src/fan/sound-files.ts）だけ', () => {
    const FETCH_CALL = /(^|[^.\w$])fetch\s*\(/;
    const allowed = (path: string): boolean =>
      path.startsWith('src/shared/meter/') || path === 'src/fan/sound-files.ts';
    const sources = withExt(walk('src', ['src/core']), ['.ts', '.tsx']);
    expect(sources.length).toBeGreaterThan(50);
    expect(sources).toContain('src/fan/sound-files.ts'); // 空振りの防止
    const hits = sources.filter(
      (path) => !allowed(path) && FETCH_CALL.test(stripComments(read(path))),
    );
    expect(
      hits,
      guardMessage(
        'G-04',
        'fetch を直接呼んでいます（API の通信は src/shared/meter/ の中だけ。音源の読み込みは src/fan/sound-files.ts だけ）',
      ),
    ).toEqual([]);
    expect(FETCH_CALL.test('const r = await fetch(url);')).toBe(true);
    expect(FETCH_CALL.test('requestMeterFetch(pid)')).toBe(false);
  });

  it('音源ファイルを読むのは、同じ配信元だけ。外部の URL・API には使わない（読む先は、/sounds/ の下だけ）', () => {
    const urls = Object.values(SOUND_FILES).map((file) => file.url);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(url).toMatch(/^\/sounds\/[\w.-]+\.mp3$/);
  });
});

describe('この検査は、決まりに反する置き方を見つけられる（見張りが働いている）', () => {
  const ok = ledgerOf(ledgerRow());
  const placed = [`${SOUNDS_DIR}/A-join.mp3`];

  it('決まりどおりなら、問題なし（空の台帳・ファイルなしも問題なし）', () => {
    expect(inspectSounds(ok, placed)).toEqual([]);
    expect(inspectSounds(ledgerOf(), [])).toEqual([]);
  });

  it('① 台帳に無い音声ファイルがあると、落ちる', () => {
    const problems = inspectSounds(ok, [...placed, `${SOUNDS_DIR}/B-friend.mp3`]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('B-friend.mp3: 台帳');
  });

  it('② 台帳にあるのに、ファイルが無いと、落ちる', () => {
    const problems = inspectSounds(ok, []);
    expect(problems).toEqual(['A-join.mp3: 台帳にあるのに、ファイルがありません']);
  });

  it.each(['CC-BY', 'CC BY 4.0', '不明', 'フリー素材'])(
    '③ ライセンスが CC0・自作以外（%s）だと、落ちる',
    (license) => {
      const problems = inspectSounds(ledgerOf(ledgerRow({ ライセンス: license })), placed);
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain(`ライセンス「${license}」は使えません`);
    },
  );

  it('③ 自作は、使える（出どころは URL でなくてよい）', () => {
    const own = ledgerOf(ledgerRow({ ライセンス: '自作', 出どころ: 'チームが作った（作者の欄）' }));
    expect(inspectSounds(own, placed)).toEqual([]);
  });

  it.each(['src/fan/click.wav', 'assets-src/jingle.MP3', 'public/assets/bgm.ogg', 'e2e/a.m4a'])(
    '④ 置き場の外（%s）に音声ファイルがあると、落ちる',
    (path) => {
      const problems = inspectSounds(ok, [...placed, path]);
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain('置き場（public/sounds/）の外');
    },
  );

  it('④ 置き場の中でも、台帳に書いてなければ落ちる（フォルダ名だけを似せても通らない）', () => {
    expect(inspectSounds(ok, [...placed, 'public/sounds-extra/x.mp3'])).toHaveLength(1);
    expect(inspectSounds(ok, [...placed, 'src/public/sounds/x.mp3'])).toHaveLength(1);
  });

  it.each(['slot', 'share', 'stage', ''])(
    '⑤ 場面が join・friend・fever 以外（%s）だと、落ちる',
    (cue) => {
      const problems = inspectSounds(ledgerOf(ledgerRow({ 場面: cue })), placed);
      expect(problems.length).toBeGreaterThan(0);
    },
  );

  it('⑤ 1 つの場面に 2 つのファイルがあると、落ちる。同じファイルが 2 行あっても、落ちる', () => {
    const two = ledgerOf(ledgerRow(), ledgerRow({ ファイル: 'A-join-2.mp3' }));
    expect(inspectSounds(two, [...placed, `${SOUNDS_DIR}/A-join-2.mp3`]).join('\n')).toContain(
      '場面「join」に、ファイルが 2 つ',
    );
    expect(inspectSounds(ledgerOf(ledgerRow(), ledgerRow()), placed).join('\n')).toContain(
      '台帳に 2 行',
    );
  });

  it.each(['出どころ', '作者', '確認日', '加工の内容'])('⑥ 欄（%s）が空だと、落ちる', (name) => {
    const problems = inspectSounds(ledgerOf(ledgerRow({ [name]: '' })), placed);
    expect(problems.join('\n')).toContain('すべて埋まっていません');
  });

  it.each(['2026-13-01', '2026-02-30', '2026/11/15', '昨日'])(
    '⑥ 確認日が実在の日（YYYY-MM-DD）でない（%s）と、落ちる',
    (date) => {
      expect(inspectSounds(ledgerOf(ledgerRow({ 確認日: date })), placed).join('\n')).toContain(
        '確認日',
      );
    },
  );

  it('⑥ CC0 の出どころが、https:// の URL でないと、落ちる', () => {
    expect(
      inspectSounds(ledgerOf(ledgerRow({ 出どころ: 'どこかのサイト' })), placed).join('\n'),
    ).toContain('https://');
    expect(
      inspectSounds(ledgerOf(ledgerRow({ 出どころ: 'http://example.test/' })), placed).join('\n'),
    ).toContain('https://');
  });

  // 1 つのファイルを、2 つの素材を混ぜて作ったとき（C）。出どころ・作者の欄に、<br> で区切って 2 つ書く。2 つとも、URL と作者が要る
  describe('⑥ 出どころが 2 つの行（<br> 区切り）は、2 つとも URL（https://）と作者が要る', () => {
    const two = (over: Partial<Record<(typeof COLUMNS)[number], string>> = {}): string =>
      ledgerOf(
        ledgerRow({
          出どころ:
            'ファンファーレ: https://example.test/sounds/1/<br>観客: https://example.test/sounds/2/',
          作者: 'ファンファーレ: 作者 A<br>観客: 作者 B',
          ...over,
        }),
      );

    it('2 つとも URL と作者があれば、問題なし（名札なしでも、<br/> でも）', () => {
      expect(inspectSounds(two(), placed)).toEqual([]);
      expect(
        inspectSounds(
          two({
            出どころ: 'https://example.test/sounds/1/<br/>https://example.test/sounds/2/',
            作者: '作者 A<br />作者 B',
          }),
          placed,
        ),
      ).toEqual([]);
    });

    it.each([
      ['2 つめが URL でない', 'https://example.test/sounds/1/<br>どこかのサイト'],
      ['2 つめが http://', 'https://example.test/sounds/1/<br>観客: http://example.test/sounds/2/'],
      ['1 つめが URL でない（名札だけ）', 'ファンファーレ: 不明<br>https://example.test/sounds/2/'],
      [
        'URL のあとに、余計な語がある',
        'https://example.test/sounds/1/ と https://example.test/sounds/2/',
      ],
    ])('出どころの %s と、落ちる', (_name, source) => {
      expect(inspectSounds(two({ 出どころ: source }), placed).join('\n')).toContain('https://');
    });

    it.each([
      ['作者が 1 人分しかない', '作者 A'],
      ['作者が 3 人分ある', '作者 A<br>作者 B<br>作者 C'],
      ['2 人めの作者が空', '作者 A<br>'],
    ])('%s と、落ちる（出どころごとに、作者を書く）', (_name, author) => {
      expect(inspectSounds(two({ 作者: author }), placed).join('\n')).toContain(
        '出どころごとに、作者を書きます',
      );
    });

    it('1 か所だけの行（A・B）は、いままでどおり。作者の欄が空なら、落ちる', () => {
      expect(inspectSounds(ok, placed)).toEqual([]);
      expect(inspectSounds(ledgerOf(ledgerRow({ 作者: '' })), placed).join('\n')).toContain(
        'すべて埋まっていません',
      );
    });
  });

  it.each([
    ['どんな音', 'コインが落ちるような音'],
    ['どんな音', '金属音のジャラジャラ'],
    ['どんな音', 'slot machine win'],
    ['どんな音', 'Casino jackpot bells'],
    ['ファイル', 'coin-drop.mp3'],
  ])('⑦ 賭けを連想させる語（%s: %s）があると、落ちる', (name, value) => {
    const file = name === 'ファイル' ? value : 'A-join.mp3';
    const problems = inspectSounds(ledgerOf(ledgerRow({ [name]: value })), [
      `${SOUNDS_DIR}/${file}`,
    ]);
    expect(problems.join('\n')).toContain('賭けを連想させる語');
  });

  it('対応表（コード）と台帳の食い違いで、落ちる（ファイルと台帳だけ足して対応表を忘れた・対応表だけ足して台帳を忘れた・場面が違う・外部の URL）', () => {
    const map = { join: '/sounds/A-join.mp3' };
    expect(inspectSounds(ok, placed, map)).toEqual([]);
    expect(inspectSounds(ok, placed, {}).join('\n')).toContain('対応表');
    expect(
      inspectSounds(ok, placed, { ...map, friend: '/sounds/B-friend.mp3' }).join('\n'),
    ).toContain('B-friend.mp3 が、台帳にありません');
    expect(inspectSounds(ok, placed, { friend: '/sounds/A-join.mp3' }).join('\n')).toContain(
      '食い違い',
    );
    expect(inspectSounds(ok, placed, { join: 'https://example.test/a.mp3' }).join('\n')).toContain(
      '同じ配信元',
    );
    expect(inspectSounds(ok, placed, { join: '/assets/A-join.mp3' }).join('\n')).toContain(
      '同じ配信元',
    );
  });

  it('台帳の表の印が無いと、落ちる', () => {
    expect(inspectSounds('| ファイル | 場面 |', placed).join('\n')).toContain('印');
  });
});
