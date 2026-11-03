import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { totalScore, type Mode } from '../../lib/types';
import { formatDate } from '../../ui';
import { ReviewView } from '../write/ReviewView';

export const MODE_LABELS: Record<Mode, string> = {
  write: '書く',
  voice: '話す',
  sprint: '瞬発力',
  dialogue: '深掘り',
};

export function EntryScreen({ entryId }: { entryId: number }) {
  const entry = useLiveQuery(() => db.entries.get(entryId), [entryId], null);
  const previous = useLiveQuery(
    async () => (entry?.retryOf ? db.entries.get(entry.retryOf) : undefined),
    [entry?.retryOf],
  );

  if (entry === null) return null;
  if (!entry) {
    return <p className="note">この回答は見つかりませんでした。<a href="#/history">記録に戻る</a></p>;
  }

  return (
    <>
      <p className="entry-meta">
        <a href="#/history">記録</a>
        <span>
          {formatDate(entry.createdAt)}の{MODE_LABELS[entry.mode]}
        </span>
      </p>
      <h1 className="session-prompt">{entry.promptText}</h1>

      {entry.review && (
        <ReviewView review={entry.review} previousTotal={previous?.review ? totalScore(previous.review) : undefined} />
      )}

      {entry.mode === 'sprint' ? (
        <>
          <h2 className="section-title">
            {entry.sprintSeconds}秒で{entry.sprintItems?.length ?? 0}個
          </h2>
          <ul className="sprint-items">
            {entry.sprintItems?.map((item) => <li key={item}>{item}</li>)}
          </ul>
          {entry.sprintComment && <p className="rewrite">{entry.sprintComment}</p>}
        </>
      ) : (
        <>
          <h2 className="section-title">{entry.mode === 'dialogue' ? '自分のまとめ' : '自分の回答'}</h2>
          <p className="my-answer">{entry.text}</p>
          <a className="button primary wide" href={`#/retry/${entry.id}`}>
            書き直す
          </a>
        </>
      )}

      {entry.turns && (
        <details className="turns">
          <summary>対話を読み返す</summary>
          <div className="chat">
            {entry.turns.map((turn, index) => (
              <p key={index} className={turn.role === 'ai' ? 'turn ai' : 'turn me'}>
                {turn.text}
              </p>
            ))}
          </div>
        </details>
      )}
    </>
  );
}
