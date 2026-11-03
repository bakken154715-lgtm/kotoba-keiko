import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseReview } from './coach';
import { db, exportBackup, importBackup, saveEntry } from './db';
import { GeminiError, generate, geminiAudioType, userText } from './gemini';
import { updateSettings } from './settings';
import { dayIndex, streakDays } from './stats';
import { totalScore } from './types';

const validReview = {
  scores: { specificity: 10, logic: 12, structure: 14, vocabulary: 16, clarity: 18 },
  strengths: ['良い点'],
  improvements: [{ quote: '引用', advice: '助言' }],
  rewrite: '書き換え',
};

describe('parseReview', () => {
  it('reads a valid response and totals the five axes', () => {
    const review = parseReview(JSON.stringify(validReview));
    expect(totalScore(review)).toBe(70);
    expect(review.improvements[0].advice).toBe('助言');
  });

  it('clamps scores into 0-20', () => {
    const review = parseReview(
      JSON.stringify({ ...validReview, scores: { ...validReview.scores, logic: 99, clarity: -3 } }),
    );
    expect(review.scores.logic).toBe(20);
    expect(review.scores.clarity).toBe(0);
  });

  it('rejects broken JSON and missing scores', () => {
    expect(() => parseReview('not json')).toThrow();
    expect(() => parseReview('{}')).toThrow();
    expect(() => parseReview(JSON.stringify({ ...validReview, scores: { logic: 'x' } }))).toThrow();
  });
});

describe('streakDays', () => {
  const today = new Date(2026, 10, 3, 12);
  const at = (day: number) => new Date(2026, 10, day, 9).toISOString();

  it('counts back from today', () => {
    expect(streakDays([at(3), at(2), at(1)], today)).toBe(3);
  });

  it('keeps the streak when today is not done yet', () => {
    expect(streakDays([at(2), at(1)], today)).toBe(2);
  });

  it('stops at a gap and counts one per day', () => {
    expect(streakDays([at(3), at(3), at(1)], today)).toBe(1);
    expect(streakDays([], today)).toBe(0);
    expect(streakDays([at(1)], today)).toBe(0);
  });

  it('crosses month boundaries', () => {
    expect(streakDays([new Date(2026, 10, 1, 9).toISOString(), new Date(2026, 9, 31, 9).toISOString()], new Date(2026, 10, 1, 20))).toBe(2);
  });
});

describe('dayIndex', () => {
  it('is stable within a day and stays in range', () => {
    expect(dayIndex(new Date(2026, 10, 3, 1), 7)).toBe(dayIndex(new Date(2026, 10, 3, 23), 7));
    expect(dayIndex(new Date(2026, 10, 3), 7)).toBeLessThan(7);
  });
});

describe('backup', () => {
  beforeEach(async () => {
    await db.entries.clear();
  });

  it('round-trips entries', async () => {
    await saveEntry({ createdAt: '2026-11-03T00:00:00.000Z', mode: 'write', promptText: 'お題', text: '回答' });
    const json = await exportBackup();
    await db.entries.clear();
    expect(await importBackup(json)).toBe(1);
    expect((await db.entries.toArray())[0].text).toBe('回答');
  });

  it('rejects files from elsewhere without touching data', async () => {
    await saveEntry({ createdAt: '2026-11-03T00:00:00.000Z', mode: 'write', promptText: 'お題', text: '回答' });
    await expect(importBackup('nope')).rejects.toThrow();
    await expect(importBackup('{"entries":[]}')).rejects.toThrow();
    await expect(importBackup('{"app":"kotoba-keiko","entries":[{"mode":"write"}]}')).rejects.toThrow();
    expect(await db.entries.count()).toBe(1);
  });
});

describe('generate', () => {
  const ok = (text: string) =>
    new Response(JSON.stringify({ candidates: [{ content: { parts: [{ thought: true, text: '考え中' }, { text }] } }] }));

  beforeEach(() => updateSettings({ apiKey: 'test-key', model: 'gemini-3.8-flash' }));
  afterEach(() => vi.unstubAllGlobals());

  it('sends the key in a header, not the URL, and skips thought parts', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => ok('答え'));
    vi.stubGlobal('fetch', fetchMock);
    expect(await generate({ contents: [userText('質問')] })).toBe('答え');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).not.toContain('test-key');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key');
  });

  it('falls back to the lighter model on 429', async () => {
    const fetchMock = vi.fn(async (url: string, _init: RequestInit) =>
      url.includes('3.8') ? new Response('{}', { status: 429 }) : ok('軽量の答え'),
    );
    vi.stubGlobal('fetch', fetchMock);
    expect(await generate({ contents: [userText('質問')] })).toBe('軽量の答え');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports quota when both models are limited, and does not retry a bad key', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429 })));
    await expect(generate({ contents: [userText('質問')] })).rejects.toMatchObject({ kind: 'quota' });

    const badKey = vi.fn(async () => new Response('API_KEY_INVALID', { status: 400 }));
    vi.stubGlobal('fetch', badKey);
    await expect(generate({ contents: [userText('質問')] })).rejects.toBeInstanceOf(GeminiError);
    expect(badKey).toHaveBeenCalledTimes(1);
  });

  it('asks for a key before calling the network', async () => {
    updateSettings({ apiKey: '' });
    await expect(generate({ contents: [userText('質問')] })).rejects.toMatchObject({ kind: 'no-key' });
  });
});

describe('geminiAudioType', () => {
  it('maps iPhone recordings to a listed type', () => {
    expect(geminiAudioType('audio/mp4;codecs=mp4a.40.2')).toBe('audio/m4a');
    expect(geminiAudioType('audio/webm;codecs=opus')).toBe('audio/webm');
  });
});
