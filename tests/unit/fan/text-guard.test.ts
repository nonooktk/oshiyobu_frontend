// ファン向けの文言の検査（上層: I-28・I-102・SP-30・SP-34・決定 25・26）。
import { describe, expect, it } from 'vitest';
import { ARTIST_IDS } from '../../../src/fan/core';
import { THANKS } from '../../../src/fan/text/thanks';
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
      const sentences = THANKS[id]
        .join('')
        .split(/(?<=[。！？])/)
        .filter(Boolean);
      expect(sentences.length, id).toBeGreaterThanOrEqual(3);
      expect(sentences.length, id).toBeLessThanOrEqual(4);
    }
  });

  it('5 組の文は、すべて違う', () => {
    const all = ARTIST_IDS.map((id) => THANKS[id].join(''));
    expect(new Set(all).size).toBe(5);
  });

  it('使わない語・約束に読める語・金額の語を含まない。りじちょーは「あれっす！」で始まり「っす！」で終わる', () => {
    for (const id of ARTIST_IDS) {
      const text = THANKS[id].join('');
      for (const w of [...FORBIDDEN, ...PROMISE, ...MONEY])
        expect(text.includes(w), `${id}: ${w}`).toBe(false);
    }
    expect(THANKS.riji[0]).toBe('あれっす！');
    expect(THANKS.riji.at(-1)?.endsWith('っす！')).toBe(true);
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

  it('使わない語を含まない。あと N 人と市の名前が差し込まれる', () => {
    for (const id of ARTIST_IDS) {
      const v = VOICES[id];
      const lines = [
        ...Object.values(v.home).flatMap((f) => f(18, '久留米市')),
        v.say.join('久留米市'),
        v.say.share(),
        v.say.friend(),
        v.say.quit(),
        v.say.gift('特典 1/3'),
      ];
      for (const line of lines)
        for (const w of FORBIDDEN) expect(line.includes(w), `${id}: ${line}`).toBe(false);
    }
    expect(VOICES.tech0.home.pre(18, '久留米市').join('')).toContain('あと18人');
    expect(VOICES.tech0.home.pre(18, '久留米市').join('')).toContain('久留米市');
  });

  it('りじちょーの口調は「あれっす！」で始まり、語尾は「っす！」。ホームの 1 つのセリフは、折り返しの区切りごとに持つ', () => {
    const lines = VOICES.riji.home.post(18, '久留米市');
    expect(lines[0]).toBe('あれっす！');
    expect(lines.length).toBeGreaterThan(1);
    expect(VOICES.tech0.who).toBe('カマヤーン');
    expect(VOICES.krs48.who).toBeUndefined();
  });
});
