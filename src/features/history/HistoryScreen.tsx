import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import { db } from '../../lib/db';
import { streakDays } from '../../lib/stats';
import { AXES, totalScore, type Entry } from '../../lib/types';
import { formatDate } from '../../ui';
import { MODE_LABELS } from './EntryScreen';

const CHART_POINTS = 30;
const WIDTH = 320;
const HEIGHT = 130;
const PAD = { left: 26, right: 10, top: 10, bottom: 8 };

function ScoreChart({ entries }: { entries: Entry[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const scores = entries.map((entry) => totalScore(entry.review!));
  const x = (i: number) => PAD.left + (i / Math.max(1, scores.length - 1)) * (WIDTH - PAD.left - PAD.right);
  const y = (score: number) => PAD.top + (1 - score / 100) * (HEIGHT - PAD.top - PAD.bottom);
  const active = selected ?? scores.length - 1;

  function pick(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const ratio = (svgX - PAD.left) / (WIDTH - PAD.left - PAD.right);
    setSelected(Math.max(0, Math.min(scores.length - 1, Math.round(ratio * (scores.length - 1)))));
  }

  function onKey(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === 'ArrowLeft') setSelected(Math.max(0, active - 1));
    if (event.key === 'ArrowRight') setSelected(Math.min(scores.length - 1, active + 1));
  }

  return (
    <figure className="chart">
      <figcaption>
        {formatDate(entries[active].createdAt)}は{scores[active]}点
      </figcaption>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`直近${scores.length}回の点数の推移。最新は${scores[scores.length - 1]}点`}
        tabIndex={0}
        onPointerDown={pick}
        onPointerMove={(event) => event.buttons > 0 && pick(event)}
        onKeyDown={onKey}
      >
        {[0, 50, 100].map((tick) => (
          <g key={tick}>
            <line className="chart-grid" x1={PAD.left} x2={WIDTH - PAD.right} y1={y(tick)} y2={y(tick)} />
            <text className="chart-tick" x={PAD.left - 6} y={y(tick) + 3.5} textAnchor="end">
              {tick}
            </text>
          </g>
        ))}
        <line className="chart-cross" x1={x(active)} x2={x(active)} y1={PAD.top} y2={HEIGHT - PAD.bottom} />
        <polyline className="chart-line" points={scores.map((score, i) => `${x(i)},${y(score)}`).join(' ')} />
        <circle className="chart-dot" cx={x(active)} cy={y(scores[active])} r={4.5} />
      </svg>
    </figure>
  );
}

function Weakest({ entries }: { entries: Entry[] }) {
  const recent = entries.slice(-10);
  const averages = AXES.map((axis) => ({
    label: axis.label,
    value: recent.reduce((sum, entry) => sum + entry.review!.scores[axis.key], 0) / recent.length,
  })).sort((a, b) => a.value - b.value);
  return (
    <p className="note">
      直近{recent.length}回で一番低いのは{averages[0].label}(平均{averages[0].value.toFixed(1)}点 / 20点)です。
    </p>
  );
}

export function HistoryScreen() {
  const entries = useLiveQuery(() => db.entries.orderBy('createdAt').reverse().toArray(), []);
  if (!entries) return null;

  const scored = entries
    .filter((entry) => entry.review && !entry.review.isSample)
    .slice(0, CHART_POINTS)
    .reverse();

  return (
    <>
      <h1 className="page-title">記録</h1>
      {entries.length === 0 ? (
        <p className="note">
          まだ記録がありません。<a href="#/home">今日のお題に答える</a>
        </p>
      ) : (
        <>
          <p className="history-summary">
            {entries.length}回練習しました。{streakDays(entries.map((entry) => entry.createdAt))}日続いています。
          </p>
          {scored.length >= 2 ? (
            <>
              <ScoreChart entries={scored} />
              <Weakest entries={scored} />
            </>
          ) : (
            <p className="note">AIの採点が2回たまると、点数の推移が表示されます。</p>
          )}
          <ul className="link-list history">
            {entries.map((entry) => (
              <li key={entry.id}>
                <a href={`#/entry/${entry.id}`}>
                  <span className="history-meta">
                    {formatDate(entry.createdAt)} {MODE_LABELS[entry.mode]}
                  </span>
                  <span className="prompt-line">{entry.promptText}</span>
                  <span className="history-score">
                    {entry.review
                      ? `${totalScore(entry.review)}点${entry.review.isSample ? '(見本)' : ''}`
                      : `${entry.sprintItems?.length ?? 0}個`}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
