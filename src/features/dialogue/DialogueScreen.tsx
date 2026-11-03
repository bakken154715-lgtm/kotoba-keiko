import { useEffect, useRef, useState } from 'react';
import { nextQuestion, reviewAnswer } from '../../lib/coach';
import { clearDraft, loadDraft, saveDraft, saveEntry } from '../../lib/db';
import type { Turn } from '../../lib/types';
import { ErrorNote, SessionScreen, errorMessage, goTo } from '../../ui';
import { MIN_ANSWER_LENGTH } from '../write/WriteScreen';

const DRAFT_KEY = 'dialogue';

interface DialogueState {
  theme: string;
  turns: Turn[];
  summary: string;
  summarizing: boolean;
}

const EMPTY: DialogueState = { theme: '', turns: [], summary: '', summarizing: false };

export function DialogueScreen() {
  const [state, setState] = useState<DialogueState>(EMPTY);
  const [themeInput, setThemeInput] = useState('');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadDraft<DialogueState>(DRAFT_KEY).then((draft) => {
      if (draft?.theme) setState(draft);
    });
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [state.turns.length, busy]);

  function update(next: DialogueState) {
    setState(next);
    void saveDraft(DRAFT_KEY, next);
  }

  async function ask(next: DialogueState) {
    setBusy(true);
    setError('');
    try {
      const question = await nextQuestion(next.theme, next.turns);
      update({ ...next, turns: [...next.turns, { role: 'ai', text: question }] });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function begin() {
    const next = { ...EMPTY, theme: themeInput.trim() };
    update(next);
    void ask(next);
  }

  function send() {
    const next = { ...state, turns: [...state.turns, { role: 'me' as const, text: reply.trim() }] };
    update(next);
    setReply('');
    void ask(next);
  }

  async function submitSummary() {
    setBusy(true);
    setError('');
    try {
      const review = await reviewAnswer(state.theme, state.summary);
      const id = await saveEntry({
        createdAt: new Date().toISOString(),
        mode: 'dialogue',
        promptText: state.theme,
        text: state.summary,
        review,
        turns: state.turns,
      });
      await clearDraft(DRAFT_KEY);
      goTo(`entry/${id}`, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  function reset() {
    setState(EMPTY);
    setThemeInput('');
    setReply('');
    setError('');
    void clearDraft(DRAFT_KEY);
  }

  if (!state.theme) {
    return (
      <SessionScreen title="深掘り対話" backTo="#/practice">
        <h1 className="session-prompt">今モヤモヤしていることは?</h1>
        <textarea
          className="answer short"
          aria-label="モヤモヤしていること"
          placeholder="うまくまとまっていなくて大丈夫です"
          value={themeInput}
          onChange={(event) => setThemeInput(event.target.value)}
        />
        <button className="button primary wide" disabled={!themeInput.trim()} onClick={begin}>
          質問してもらう
        </button>
      </SessionScreen>
    );
  }

  const answered = state.turns.filter((turn) => turn.role === 'me').length;
  const needsQuestion = state.turns[state.turns.length - 1]?.role !== 'ai';

  return (
    <SessionScreen title="深掘り対話" backTo="#/practice">
      <h1 className="session-prompt">{state.theme}</h1>
      <div className="chat">
        {state.turns.map((turn, index) => (
          <p key={index} className={turn.role === 'ai' ? 'turn ai' : 'turn me'}>
            {turn.text}
          </p>
        ))}
        {busy && !state.summarizing && <p className="note">考えています</p>}
        <div ref={endRef} />
      </div>
      {error && <ErrorNote message={error} />}
      {needsQuestion && !busy && !state.summarizing && (
        <button className="button wide" onClick={() => void ask(state)}>
          もう一度質問してもらう
        </button>
      )}

      {!state.summarizing && !needsQuestion && (
        <>
          <textarea
            className="answer short"
            aria-label="質問への答え"
            value={reply}
            disabled={busy}
            onChange={(event) => setReply(event.target.value)}
          />
          <button className="button primary wide" disabled={busy || !reply.trim()} onClick={send}>
            答えを送る
          </button>
          {answered >= 1 && (
            <button className="button wide" disabled={busy} onClick={() => update({ ...state, summarizing: true })}>
              自分の言葉でまとめる
            </button>
          )}
        </>
      )}

      {state.summarizing && (
        <>
          <h2 className="section-title">ここまでで分かった自分の考えは?</h2>
          <textarea
            className="answer"
            aria-label="まとめ"
            value={state.summary}
            disabled={busy}
            onChange={(event) => update({ ...state, summary: event.target.value })}
          />
          <button
            className="button primary wide"
            disabled={busy || state.summary.trim().length < MIN_ANSWER_LENGTH}
            onClick={submitSummary}
          >
            {busy ? '採点しています' : '採点する'}
          </button>
          <button className="text-button" disabled={busy} onClick={() => update({ ...state, summarizing: false })}>
            対話に戻る
          </button>
        </>
      )}
      <button className="text-button" disabled={busy} onClick={reset}>
        この対話を捨てて最初から始める
      </button>
    </SessionScreen>
  );
}
