// @vitest-environment node
// ファン向けの、ことば・絵・動きの検査。
//   G-04: 演出とことばが褒めるのは、利用者の行動だけ。運・勝ち負け・得を褒めない（銀行に出す企画のため）
//   G-05: 急がせる促し（点滅・残り時間・「いますぐ」）を入れない
//   G-04（音）: 称賛の音に、スロット・硬貨・くじを連想させる語・音声ファイル・素材の再生を入れない。音のボタンを消さない
// 検査の範囲は、ファン向け（src/fan/ と fan/index.html）の、コード・CSS・文言と、絵のファイル名。
// 限界: 語の一覧に無い言い換えと、動きそのもの（点滅の見た目）・音の聞こえ方は、見つけられない。PR のレビューで見る。
// 起動条件: 検査の対象が見つかり、中身を読めていること（0 件で通る空振りの防止）。
import { describe, expect, it } from 'vitest';
import { guardMessage, read, stripComments, walk, withExt } from './helpers';

const TEXT_EXTS = ['.ts', '.tsx', '.css', '.json', '.svg', '.html'];
const files = [...withExt(walk('src/fan'), TEXT_EXTS), 'fan/index.html'];
const sources = files.map((path) => ({ path, text: read(path) }));

/** 運・勝ち負け・得を褒める語（G-04）。一覧の外の言い換えは見つけられない */
const LUCK_WORDS = [
  '大当たり',
  '当たり',
  '確変',
  'ラッキー',
  '獲得',
  'お得',
  'ボーナス',
  'ガチャ',
  'ジャックポット',
  '当選',
  '抽選',
  '勝ち',
  '負け',
  'コイン',
  '札束',
  'くじ',
  'スロット',
];
/** コイン・札束・くじ・スロットの絵に当たる絵文字（G-04） */
const LUCK_EMOJI = ['🪙', '💰', '💴', '💵', '💶', '💷', '💸', '🎰', '🎲', '🎟'];
/** 絵のファイル名（G-04）。コイン・札束・くじ・スロットの絵を、置かない */
const LUCK_FILE_NAME = /(^|[^a-z])(coin|slot|lottery|kuji|gacha|jackpot|casino|cash)/i;
/** 急がせる語（G-05） */
const HURRY_WORDS = [
  'いますぐ',
  '今すぐ',
  '残り時間',
  '今だけ',
  '期間限定',
  '急いで',
  'お急ぎ',
  'カウントダウン',
  '点滅',
];
/** 点滅・脈動に当たるアニメーションの名前（G-05）。単発の閃光（flash）や震え（shake）は、演出で使っているので対象にしない */
const BLINK_KEYFRAMES = /@keyframes\s+[\w-]*(blink|flicker|strobe|twinkle|pulse)/i;

/**
 * 「増える」は、預金の条件の説明（下の 1 文）でだけ使っている。利用者を褒める語ではないので許す。
 * ほかの使い方（「ポイントが増える」など、得を褒める言い方）は見つけて止める。
 */
const GROW_WORD = '増える';
const GROW_ALLOWED = ['預金が増えると、各コースの預金の条件がそろいます。'];

const hitsOf = (words: readonly string[]): string[] =>
  words.flatMap((word) =>
    sources.filter(({ text }) => text.includes(word)).map(({ path }) => `${path}: 「${word}」`),
  );

describe('ファン向けの、ことば・絵・動き（G-04・G-05）', () => {
  it('検査の対象が見つかり、中身を読めている（空振りしていない）', () => {
    const paths = sources.map((source) => source.path);
    expect(paths).toContain('fan/index.html');
    expect(paths).toContain('src/fan/fan.module.css');
    expect(paths).toContain('src/fan/text/voices.ts');
    expect(paths.length).toBeGreaterThan(30);
    expect(sources.filter(({ text }) => text.length === 0).map(({ path }) => path)).toEqual([]);
  });

  it('G-04: 運・勝ち負け・得を褒める語が、ファン向けに 0 件', () => {
    expect(
      hitsOf(LUCK_WORDS),
      guardMessage(
        'G-04',
        '運・勝ち負け・得を褒める語が入っています（銀行に出す企画のため、使わない）',
      ),
    ).toEqual([]);
  });

  it('G-04: コイン・札束・くじ・スロットに当たる絵文字が、ファン向けに 0 件', () => {
    expect(
      hitsOf(LUCK_EMOJI),
      guardMessage('G-04', 'コイン・札束・くじ・スロットの絵文字が入っています'),
    ).toEqual([]);
  });

  it('G-04: コイン・札束・くじ・スロットに当たる名前の絵・ファイルが、置かれていない', () => {
    const names = [
      ...walk('src/assets'),
      ...walk('assets-src'),
      ...walk('public/assets'),
      ...walk('src/fan'),
    ].filter((path) => LUCK_FILE_NAME.test(path.split('/').at(-1) ?? ''));
    expect(
      names,
      guardMessage('G-04', 'コイン・札束・くじ・スロットに当たる名前のファイルがあります'),
    ).toEqual([]);
  });

  it('G-04: 「増える」は、預金の条件の説明（1 文）だけ。ほかの使い方は 0 件', () => {
    const hits: string[] = [];
    for (const { path, text } of sources) {
      if (!path.endsWith('.ts') && !path.endsWith('.tsx')) continue;
      const code = stripComments(text);
      let rest = code;
      for (const allowed of GROW_ALLOWED) rest = rest.split(allowed).join('');
      if (rest.includes(GROW_WORD)) hits.push(path);
    }
    expect(
      hits,
      guardMessage(
        'G-04',
        `「${GROW_WORD}」を、預金の条件の説明以外で使っています（得を褒める言い方に読めるため）`,
      ),
    ).toEqual([]);
  });

  it('G-05: 急がせる語が、ファン向けに 0 件', () => {
    expect(hitsOf(HURRY_WORDS), guardMessage('G-05', '急がせる促しの語が入っています')).toEqual([]);
  });

  it('G-05: 点滅・脈動に当たる名前のアニメーションが、ファン向けの CSS に 0 件', () => {
    const hits = sources
      .filter(
        ({ path, text }) => path.endsWith('.css') && BLINK_KEYFRAMES.test(stripComments(text)),
      )
      .map(({ path }) => path);
    expect(hits, guardMessage('G-05', '点滅・脈動のアニメーションが入っています')).toEqual([]);
  });

  it('この検査は、語を見つけられる（見張りが働いている）', () => {
    // 検査の関数が空振りしていないことの確認。実際の画面には入れず、検査の側で作った文に当てる
    const sample = [{ path: 'sample.ts', text: '大当たり！ いますぐ 🪙' }];
    const found = (words: readonly string[]): string[] =>
      words.filter((word) => sample.some(({ text }) => text.includes(word)));
    expect(found(LUCK_WORDS)).toEqual(['大当たり', '当たり']);
    expect(found(HURRY_WORDS)).toEqual(['いますぐ']);
    expect(found(LUCK_EMOJI)).toEqual(['🪙']);
    expect(LUCK_FILE_NAME.test('coin-fall.webp')).toBe(true);
    expect(BLINK_KEYFRAMES.test('@keyframes blinkNow { 0% {} }')).toBe(true);
  });
});

/** 音のことば（G-04）。スロット・硬貨・くじを連想させる音を表す語。一覧の外の言い換えと、音の聞こえ方は見つけられない */
const SOUND_WORDS = [
  'チャリン',
  'ジャラジャラ',
  'ルーレット',
  'ドラムロール',
  'スロットの音',
  'コインの音',
  'くじの音',
  '金属音',
  '硬貨',
];
/** 音声ファイルの拡張子（G-04）。称賛の音は Web Audio の合成だけで、素材を置かない */
const AUDIO_EXTS = ['.mp3', '.wav', '.ogg', '.oga', '.m4a', '.aac', '.flac', '.opus', '.weba'];
/** 素材を読んで鳴らす書き方（G-04）。合成（createOscillator）だけにする */
const AUDIO_SAMPLE_PLAYBACK = [
  /new\s+Audio\s*\(/,
  /<audio\b/i,
  /decodeAudioData/,
  /createMediaElementSource/,
  /createBufferSource/,
];

describe('称賛の音（G-04）', () => {
  it('音を連想させる語（スロット・硬貨・くじなど）が、ファン向けに 0 件', () => {
    expect(
      hitsOf(SOUND_WORDS),
      guardMessage('G-04', 'スロット・硬貨・くじを連想させる音を表す語が入っています'),
    ).toEqual([]);
  });

  it('音声ファイル（mp3・wav・ogg など）が、リポジトリに 0 件', () => {
    const hits = [...walk('src'), ...walk('public'), ...walk('assets-src')].filter((path) =>
      AUDIO_EXTS.some((ext) => path.toLowerCase().endsWith(ext)),
    );
    expect(
      hits,
      guardMessage('G-04', '音声ファイルを置いています（称賛の音は、合成だけで鳴らす）'),
    ).toEqual([]);
  });

  it('音は合成だけ。素材を読んで鳴らす書き方が、ファン向けのコードに 0 件。合成の部品（createOscillator）を使っている', () => {
    const code = sources
      .filter(({ path }) => path.endsWith('.ts') || path.endsWith('.tsx'))
      .map(({ path, text }) => ({ path, text: stripComments(text) }));
    const hits = code.flatMap(({ path, text }) =>
      AUDIO_SAMPLE_PLAYBACK.filter((re) => re.test(text)).map((re) => `${path}: ${re.source}`),
    );
    expect(
      hits,
      guardMessage('G-04', '素材を読んで鳴らす書き方があります（称賛の音は、合成だけ）'),
    ).toEqual([]);
    expect(code.find(({ path }) => path === 'src/fan/sound.ts')?.text).toContain(
      'createOscillator',
    );
  });

  it('音のオン・オフのボタンが、ある（SoundToggle を作り、画面の枠が使っている）', () => {
    const message = guardMessage('G-04', '音のオン・オフのボタンが消えています');
    const toggle = sources.find(({ path }) => path === 'src/fan/components/SoundToggle.tsx');
    expect(toggle, message).toBeDefined();
    expect(toggle?.text, message).toContain('aria-label="称賛の音"');
    const users = sources.filter(
      ({ path, text }) =>
        path !== 'src/fan/components/SoundToggle.tsx' && /<SoundToggle\s*\/>/.test(text),
    );
    expect(users.length, message).toBeGreaterThan(0);
  });

  it('この検査は、音の語・素材の書き方を見つけられる（見張りが働いている）', () => {
    expect(SOUND_WORDS.filter((word) => 'チャリン！ ジャラジャラ'.includes(word))).toEqual([
      'チャリン',
      'ジャラジャラ',
    ]);
    expect(AUDIO_SAMPLE_PLAYBACK.some((re) => re.test('const a = new Audio("x.mp3");'))).toBe(true);
    expect(AUDIO_EXTS.some((ext) => 'coin.MP3'.toLowerCase().endsWith(ext))).toBe(true);
  });
});
