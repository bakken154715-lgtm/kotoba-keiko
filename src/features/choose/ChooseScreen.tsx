import { useState } from 'react';
import { GENRES, PROMPTS, type Genre } from '../../data/prompts';
import { SessionScreen } from '../../ui';

export function ChooseScreen({ target }: { target: 'write' | 'voice' }) {
  const [genre, setGenre] = useState<Genre>(GENRES[0]);
  return (
    <SessionScreen title={target === 'write' ? 'お題を選ぶ(書く)' : 'お題を選ぶ(話す)'} backTo="#/practice">
      <div className="chips" role="group" aria-label="ジャンル">
        {GENRES.map((name) => (
          <button key={name} className="chip" aria-pressed={genre === name} onClick={() => setGenre(name)}>
            {name}
          </button>
        ))}
      </div>
      <ul className="link-list">
        {PROMPTS.filter((prompt) => prompt.genre === genre).map((prompt) => (
          <li key={prompt.id}>
            <a href={`#/${target}/${encodeURIComponent(prompt.id)}`}>
              <span className="prompt-line">{prompt.text}</span>
            </a>
          </li>
        ))}
      </ul>
    </SessionScreen>
  );
}
