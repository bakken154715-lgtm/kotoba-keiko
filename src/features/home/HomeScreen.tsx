import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type CSSProperties } from 'react';
import { PROMPTS, randomPrompt } from '../../data/prompts';
import { db } from '../../lib/db';
import { getSettings } from '../../lib/settings';
import { dayIndex, streakDays } from '../../lib/stats';
import { totalScore } from '../../lib/types';
import { forVertical, formatDate } from '../../ui';

/** 最後の1文字だけが次の列に落ちないよう、長いお題は2列に分ける前提で文字サイズを決める */
function charsPerColumn(text: string): number {
  return text.length > 12 ? Math.ceil(text.length / 2) + 1 : text.length + 1;
}

export function HomeScreen() {
  const today = new Date();
  const [prompt, setPrompt] = useState(() => PROMPTS[dayIndex(today, PROMPTS.length)]);
  const entries = useLiveQuery(() => db.entries.orderBy('createdAt').reverse().toArray(), []);
  const settings = getSettings();

  const streak = entries ? streakDays(entries.map((entry) => entry.createdAt), today) : 0;
  const latest = entries?.find((entry) => entry.review && !entry.review.isSample);

  return (
    <>
      <section className="today">
        <div className="today-side">
          <p className="today-date">{formatDate(today.toISOString())}のお題</p>
          <p className="today-stat">{streak > 0 ? `${streak}日続いています` : '今日から始めましょう'}</p>
          {latest?.review && <p className="today-stat">前回 {totalScore(latest.review)}点</p>}
          <button className="text-button" onClick={() => setPrompt(randomPrompt(prompt.id))}>
            別のお題にする
          </button>
        </div>
        <h1 className="vertical-prompt" style={{ '--chars-per-column': charsPerColumn(prompt.text) } as CSSProperties}>
          {forVertical(prompt.text)}
        </h1>
      </section>
      <div className="actions">
        <a className="button primary" href={`#/write/${encodeURIComponent(prompt.id)}`}>
          書いて答える
        </a>
        <a className="button" href={`#/voice/${encodeURIComponent(prompt.id)}`}>
          話して答える
        </a>
      </div>
      {!settings.apiKey && !settings.sampleMode && (
        <p className="note">
          AI採点には無料のAPIキーが必要です。<a href="#/settings">設定でキーを入力する</a>
        </p>
      )}
    </>
  );
}
