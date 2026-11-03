import { AXES, totalScore, type Review } from '../../lib/types';

export function ReviewView({ review, previousTotal }: { review: Review; previousTotal?: number }) {
  const total = totalScore(review);
  return (
    <section className="review" aria-label="採点結果">
      {review.isSample && <p className="sample-flag">これは見本の採点です。回答の内容は評価していません。</p>}
      <div className="score">
        <div className="score-mark">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <path
              pathLength={1}
              d="M62 13C34 11 12 32 12 60c0 28 22 49 49 48 27-1 48-22 47-50C107 32 88 14 57 16"
            />
          </svg>
          <span className="score-number">
            {total}
            <small>点</small>
          </span>
        </div>
        <dl className="axes">
          {AXES.map((axis) => (
            <div key={axis.key}>
              <dt>{axis.label}</dt>
              <dd>
                <span className="axis-bar" aria-hidden="true">
                  <span style={{ width: `${(review.scores[axis.key] / 20) * 100}%` }} />
                </span>
                <span className="axis-value">{review.scores[axis.key]}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
      {previousTotal !== undefined && (
        <p className="compare">
          {total === previousTotal
            ? `前回と同じ${total}点です`
            : `前回 ${previousTotal}点から${Math.abs(total - previousTotal)}点${total > previousTotal ? '上がりました' : '下がりました'}`}
        </p>
      )}

      {review.strengths.length > 0 && (
        <>
          <h2>良かった点</h2>
          <ul className="plain">
            {review.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}

      {review.speechNotes && (
        <>
          <h2>話し方</h2>
          <p>{review.speechNotes}</p>
        </>
      )}

      {review.improvements.length > 0 && (
        <>
          <h2>直すと効くところ</h2>
          <ol className="fixes">
            {review.improvements.map((item, index) => (
              <li key={index}>
                {item.quote && <p className="quote">{item.quote}</p>}
                <p className="advice">{item.advice}</p>
              </li>
            ))}
          </ol>
        </>
      )}

      {review.rewrite && (
        <>
          <h2>書き換え例</h2>
          <p className="rewrite">{review.rewrite}</p>
        </>
      )}
    </section>
  );
}
