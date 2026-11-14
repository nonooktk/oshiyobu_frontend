// 推しのセリフの言い方（統括の決定 2026-11-14）。
//   ① 推しが利用者を呼ぶ語は「あなた」（「きみ」「君」は使わない）
//   ② カマヤーン（Tech0）は「大好きだよ。」をよく言う（場面の半分以上。1 つの場面には 1 回まで。全部の場面には入れない）
//   ③ セリフの中で、段階の名前（FEVER・ヒートアップなど）を言わない。「盛り上がってきた」を、それぞれの口調で言い、
//      段階が進むほど、度合いが上がる言い方にする
// 画面の段階の名前（ゲージ）と、称賛の演出の文字・褒めことば（praise.ts）は、統括が決めた名前で、ここでは見ない。
import { describe, expect, it } from 'vitest';
import { ARTIST_IDS } from '../../../src/core';
import type { ArtistId } from '../../../src/core';
import { STAGE_NAMES } from '../../../src/fan/domain/heat';
import type { HeatStage } from '../../../src/fan/domain/heat';
import { VOICES } from '../../../src/fan/text/voices';
import type { HomeKey } from '../../../src/fan/text/voices';

const CITY = '久留米市';
const STAGES = [1, 2, 3, 4, 5] as const satisfies readonly HeatStage[];
const HOME_KEYS = [
  'reached',
  'gathered',
  'pre',
  'preSoon',
  'post',
  'postSoon',
  'friend',
] as const satisfies readonly HomeKey[];

/** 1 つの推しが言う場面ごとの文（折り返しの区切りは、つなげる）。 */
type Scene = { name: string; text: string };

/** 場面の一覧。ホームのコメントは、その場面で出る熱量の段階ごと（出ない段階は数えない）。ひとことは、5 種。 */
function scenesOf(id: ArtistId): Scene[] {
  const v = VOICES[id];
  const home = (key: HomeKey, stage: HeatStage): Scene => ({
    name: `${key}（段階 ${stage}）`,
    text: v.home[key](stage, CITY).join(''),
  });
  return [
    home('reached', 5),
    home('gathered', 4),
    home('pre', 1),
    home('pre', 2),
    home('pre', 3),
    home('preSoon', 4),
    home('post', 2),
    home('postSoon', 4),
    home('friend', 3),
    { name: 'say.join', text: v.say.join(CITY) },
    { name: 'say.share', text: v.say.share() },
    { name: 'say.friend', text: v.say.friend() },
    { name: 'say.quit', text: v.say.quit() },
    { name: 'say.gift', text: v.say.gift('特典 1/3') },
  ];
}

/** 出うる全部の文（ホームのコメント × 全段階 ＋ ひとこと）。 */
function everyLine(id: ArtistId): string[] {
  const v = VOICES[id];
  return [
    ...STAGES.flatMap((s) => HOME_KEYS.map((key) => v.home[key](s, CITY).join(''))),
    v.say.join(CITY),
    v.say.share(),
    v.say.friend(),
    v.say.quit(),
    v.say.gift('特典 1/3'),
  ];
}

describe('① 利用者を呼ぶ語は「あなた」', () => {
  it('「きみ」「キミ」「君」を、どの推しのセリフにも使わない', () => {
    for (const id of ARTIST_IDS)
      for (const line of everyLine(id)) expect(line, `${id}: ${line}`).not.toMatch(/きみ|キミ|君/);
  });

  it('呼びかけるセリフは「あなた」（カマヤーンの申し込む前・てらお少年の申し込む前）', () => {
    expect(VOICES.tech0.home.pre(1, CITY).join('')).toContain('あなたを待っているよ');
    expect(VOICES.terao.home.pre(1, CITY).join('')).toContain('あなたを待っています');
  });

  it('「みなさん」「お友だち」「仲間」は、利用者そのものではないので、そのまま（言い換えない）', () => {
    expect(VOICES.terao.home.reached(5, CITY).join('')).toContain('みなさん');
    expect(VOICES.terao.home.friend(3, CITY).join('')).toContain('お友だち');
    expect(VOICES.tech0.home.post(2, CITY).join('')).toContain('仲間');
  });
});

describe('② カマヤーンは「大好きだよ。」をよく言う', () => {
  const scenes = scenesOf('tech0');
  const has = (s: Scene) => s.text.includes('大好きだよ。');

  it('場面の半分以上で言う（14 場面のうち 7 以上）。全部の場面には入れない（くどくしない）', () => {
    const n = scenes.filter(has).length;
    expect(
      n,
      scenes
        .filter((s) => !has(s))
        .map((s) => s.name)
        .join('・'),
    ).toBeGreaterThanOrEqual(Math.ceil(scenes.length / 2));
    expect(n).toBeLessThan(scenes.length);
  });

  it('1 つの場面で、2 回は言わない', () => {
    for (const s of scenes)
      expect(s.text.split('大好きだよ。').length - 1, s.name).toBeLessThanOrEqual(1);
  });

  it('申し込みの礼のあと（ホームの post・postSoon と、特典 1/3 のひとこと）に入る', () => {
    const byName = Object.fromEntries(scenes.map((s) => [s.name, s]));
    expect(byName['post（段階 2）']?.text).toMatch(/申し込みありがとう。大好きだよ。/);
    expect(byName['postSoon（段階 4）']?.text).toMatch(/申し込みありがとう。大好きだよ。/);
    expect(byName['say.join']?.text).toMatch(/ありがとう。大好きだよ。/);
  });

  it('ほかの 4 組は、この言い方を使わない（カマヤーンの口調）', () => {
    for (const id of ['krs48', 'riji', 'terao', 'heisei'] as const)
      for (const line of everyLine(id)) expect(line, `${id}: ${line}`).not.toContain('大好き');
  });
});

describe('③ 段階の名前を言わず、「盛り上がってきた」を、それぞれの口調で言う', () => {
  it('段階の名前（点火・あたたまってきた・ヒートアップ・FEVER 目前・FEVER）と「FEVER」「目前」を、どの推しのセリフにも使わない', () => {
    const banned = [...Object.values(STAGE_NAMES), 'FEVER', 'ヒートアップ', '目前'];
    for (const id of ARTIST_IDS)
      for (const line of everyLine(id))
        for (const word of banned)
          expect(line.includes(word), `${id}: ${word}「${line}」`).toBe(false);
  });

  // 口調ごとの「盛り上がってきた」。KRS48 だけは、「わいわいしてきた」（口調の目印）
  const WORD: Record<ArtistId, RegExp> = {
    tech0: /盛り上がってきたね/,
    krs48: /わいわいしてきた/,
    riji: /盛り上がってきたっす！/,
    terao: /盛り上がってきました/,
    heisei: /盛り上がってきたじゃん/,
  };
  it.each(ARTIST_IDS)(
    '%s は、申し込む前（段階 3）と、申し込んだあと（段階 2）に、自分の口調で「盛り上がってきた」を言う',
    (id) => {
      const v = VOICES[id];
      expect(v.home.pre(3, CITY).join(''), `${id} pre`).toMatch(WORD[id]);
      expect(v.home.post(2, CITY).join(''), `${id} post`).toMatch(WORD[id]);
    },
  );

  it.each(ARTIST_IDS)(
    '%s は、段階が進むほど度合いが上がる（申し込む前の段階 1・2・3 と、熱量が高いときは、すべて違う言い方）',
    (id) => {
      const v = VOICES[id];
      const texts = [
        v.home.pre(1, CITY).join(''),
        v.home.pre(2, CITY).join(''),
        v.home.pre(3, CITY).join(''),
        v.home.preSoon(4, CITY).join(''),
      ];
      expect(new Set(texts).size).toBe(4);
    },
  );

  it.each(ARTIST_IDS)(
    '%s は、熱量が高いとき（段階 4 以上）に、度合いを上げる言い方（すごく・めちゃ・すっごく・めっちゃ）を使う',
    (id) => {
      const v = VOICES[id];
      const INTENSIFIER = /すごく|すっごく|めちゃ|めっちゃ/;
      for (const key of ['preSoon', 'postSoon', 'gathered'] as const)
        expect(v.home[key](4, CITY).join(''), `${id} ${key}`).toMatch(INTENSIFIER);
      expect(v.home.friend(4, CITY).join(''), `${id} friend`).toMatch(INTENSIFIER);
      // 段階が低いときは、度合いを上げる言い方を使わない
      expect(v.home.friend(3, CITY).join(''), `${id} friend 段階 3`).not.toMatch(INTENSIFIER);
      expect(v.home.pre(2, CITY).join(''), `${id} pre 段階 2`).not.toMatch(INTENSIFIER);
    },
  );
});

describe('申し込む前（推し活定期をはじめる前・預金を積み増す前を含む）のセリフは、申し込めるとは言わない', () => {
  it('pre・preSoon の全段階で、「申し込」を含まない', () => {
    for (const id of ARTIST_IDS)
      for (const s of STAGES)
        for (const key of ['pre', 'preSoon'] as const)
          expect(VOICES[id].home[key](s, CITY).join(''), `${id} ${key} 段階 ${s}`).not.toMatch(
            /申し込/,
          );
  });
});
