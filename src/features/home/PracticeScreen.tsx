const MODES = [
  { href: '#/choose/write', title: '書いて答える', body: 'お題に文章で答えて、5つの観点で採点と添削を受けます。' },
  { href: '#/choose/voice', title: '話して答える', body: '声で答えた内容を文字にして、話し方の指摘と一緒に採点します。' },
  { href: '#/sprint', title: '瞬発力', body: '制限時間内に言葉をできるだけ出します。打っても話しても答えられます。' },
  { href: '#/dialogue', title: '深掘り対話', body: 'モヤモヤをAIの質問で掘り下げ、最後に自分の言葉でまとめます。' },
];

export function PracticeScreen() {
  return (
    <>
      <h1 className="page-title">練習</h1>
      <ul className="link-list">
        {MODES.map((mode) => (
          <li key={mode.href}>
            <a href={mode.href}>
              <strong>{mode.title}</strong>
              <span>{mode.body}</span>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
