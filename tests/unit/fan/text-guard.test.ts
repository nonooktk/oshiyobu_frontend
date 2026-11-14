// ファン向けの文言の検査（上層: I-28・I-102・SP-30・SP-34・決定 25・26）。
import { describe, expect, it } from 'vitest';
import { ARTIST_IDS } from '../../../src/core';
import { CITY_NAMES } from '../../../src/core';
import { CITY_MARK, THANKS, thanksOf } from '../../../src/fan/text/thanks';
import { VOICES } from '../../../src/fan/text/voices';

const FORBIDDEN = [
  '新しい口座を開く',
  '口座開設',
  '確約',
  '参加',
  '応援レース',
  '応募資格',
  '上位の体験',
];
// 約束・煽り・金額に読める語（感謝の文に入れない。マイメロディの案の自己点検と同じ）
const PROMISE = [
  '会おう',
  '会えるよ',
  '会いましょう',
  '待ってい',
  '必ず',
  '絶対',
  '約束',
  'もうすぐ',
];
const MONEY = ['円', '預金', '口座', '払'];

describe('感謝のメッセージ（I-28）', () => {
  it('5 組すべてにあり、各 3〜4 文（「。」「！」「？」で区切る）', () => {
    expect(Object.keys(THANKS).sort()).toEqual([...ARTIST_IDS].sort());
    for (const id of ARTIST_IDS) {
      const sentences = thanksOf(id, '久留米市')
        .join('')
        .split(/(?<=[。！？])/)
        .filter(Boolean);
      expect(sentences.length, id).toBeGreaterThanOrEqual(3);
      expect(sentences.length, id).toBeLessThanOrEqual(4);
    }
  });

  it('5 組の文は、すべて違う', () => {
    const all = ARTIST_IDS.map((id) => thanksOf(id, '久留米市').join(''));
    expect(new Set(all).size).toBe(5);
  });

  it('使わない語・約束に読める語・金額の語を含まない。りじちょーは「あれっす！」で始まり「っす！」で終わる', () => {
    for (const id of ARTIST_IDS) {
      const text = thanksOf(id, '久留米市').join('');
      for (const w of [...FORBIDDEN, ...PROMISE, ...MONEY])
        expect(text.includes(w), `${id}: ${w}`).toBe(false);
    }
    expect(THANKS.riji[0]).toBe('あれっす！');
    expect(thanksOf('riji', '久留米市').at(-1)?.endsWith('っす！')).toBe(true);
  });
});

describe('推しのセリフ（SP-30・決定 26）', () => {
  it('5 組すべてが、ホームのコメント 7 種と、行動のひとこと（join・share・friend・quit・gift）を持つ', () => {
    for (const id of ARTIST_IDS) {
      const v = VOICES[id];
      expect(Object.keys(v.home).sort()).toEqual([
        'friend',
        'gathered',
        'post',
        'postSoon',
        'pre',
        'preSoon',
        'reached',
      ]);
      expect(Object.keys(v.say).sort()).toEqual(['friend', 'gift', 'join', 'quit', 'share']);
    }
  });

  it('使わない 3 種（main・deposit・teiki のひとこと）を持たない', () => {
    for (const id of ARTIST_IDS) {
      for (const key of ['main', 'deposit', 'teiki'])
        expect(key in VOICES[id].say, `${id}.say.${key}`).toBe(false);
    }
  });

  it('使わない語を含まない。人数・割合の数字を言わない。市の名前が差し込まれる', () => {
    for (const id of ARTIST_IDS) {
      const v = VOICES[id];
      const lines = [
        ...([1, 2, 3, 4, 5] as const).flatMap((stage) =>
          Object.values(v.home).flatMap((f) => f(stage, '久留米市')),
        ),
        v.say.join('久留米市'),
        v.say.share(),
        v.say.friend(),
        v.say.quit(),
        v.say.gift('特典 1/3'),
      ];
      for (const line of lines) {
        for (const w of FORBIDDEN) expect(line.includes(w), `${id}: ${line}`).toBe(false);
        expect(line, `${id}: ${line}`).not.toMatch(/\d+人|\d+%|あと\d|達成率|最低人数/);
      }
    }
    expect(VOICES.tech0.home.pre(1, '久留米市').join('')).toContain('久留米市');
  });

  it('りじちょーの口調は「あれっす！」で始まり、語尾は「っす！」。ホームの 1 つのセリフは、折り返しの区切りごとに持つ', () => {
    const lines = VOICES.riji.home.post(4, '久留米市');
    expect(lines[0]).toBe('あれっす！');
    expect(lines.length).toBeGreaterThan(1);
    expect(VOICES.tech0.who).toBe('カマヤーン');
    expect(VOICES.krs48.who).toBeUndefined();
  });
});

describe('感謝のメッセージの市の差し込み', () => {
  it('9 市のどれでも、印 `{市}` が残らず、市の名前が入る（りじちょーの文）。ほかの組は、市を使わない', () => {
    for (const city of CITY_NAMES) {
      for (const id of ARTIST_IDS) {
        const text = thanksOf(id, city).join('');
        expect(text.includes(CITY_MARK), `${id}・${city}`).toBe(false);
      }
      expect(thanksOf('riji', city).join('')).toContain(`${city}で会えたら`);
    }
    for (const id of ['tech0', 'krs48', 'terao', 'heisei'] as const) {
      expect(THANKS[id].join('').includes(CITY_MARK), id).toBe(false);
    }
  });

  it('市の差し込みで増える字数は、最も長い市（4 字）でも 1 字（3 字の市との差）。全体は 130 字以内', () => {
    const lens = CITY_NAMES.map((c) => thanksOf('riji', c).join('').length);
    expect(Math.max(...lens) - Math.min(...lens)).toBe(1);
    expect(Math.max(...lens)).toBeLessThanOrEqual(130);
  });
});
