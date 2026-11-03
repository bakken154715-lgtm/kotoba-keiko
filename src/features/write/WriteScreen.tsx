import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { reviewAnswer } from '../../lib/coach';
import { clearDraft, db, loadDraft, saveDraft, saveEntry } from '../../lib/db';
import { ErrorNote, SessionScreen, errorMessage, goTo } from '../../ui';

export const MIN_ANSWER_LENGTH = 10;

interface WriteProps {
  promptText: string;
  draftKey: string;
  initialText?: string;
  retryOf?: number;
}

export function WriteScreen({ promptText, draftKey, initialText = '', retryOf }: WriteProps) {
  const [text, setText] = useState(initialText);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const edited = useRef(false);

  useEffect(() => {
    loadDraft<string>(draftKey).then((draft) => {
      if (draft && !edited.current) setText(draft);
    });
  }, [draftKey]);

  function change(value: string) {
    edited.current = true;
    setText(value);
    void saveDraft(draftKey, value);
  }

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const review = await reviewAnswer(promptText, text);
      const id = await saveEntry({
        createdAt: new Date().toISOString(),
        mode: 'write',
        promptText,
        text,
        review,
        ...(retryOf ? { retryOf } : {}),
      });
      await clearDraft(draftKey);
      goTo(`entry/${id}`, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  const length = text.trim().length;
  return (
    <SessionScreen title={retryOf ? '書き直す' : '書いて答える'} backTo={retryOf ? `#/entry/${retryOf}` : '#/practice'}>
      <h1 className="session-prompt">{promptText}</h1>
      <textarea
        className="answer"
        aria-label="回答"
        placeholder="考えたことをそのまま書いてみましょう"
        value={text}
        onChange={(event) => change(event.target.value)}
        disabled={busy}
      />
      <div className="answer-foot">
        <span>{length}文字(下書きは自動で保存します)</span>
      </div>
      {error && <ErrorNote message={error} />}
      <button className="button primary wide" disabled={busy || length < MIN_ANSWER_LENGTH} onClick={submit}>
        {busy ? '採点しています' : '採点する'}
      </button>
      {length < MIN_ANSWER_LENGTH && <p className="note">{MIN_ANSWER_LENGTH}文字以上書くと採点できます。</p>}
    </SessionScreen>
  );
}

export function RetryScreen({ entryId }: { entryId: number }) {
  const entry = useLiveQuery(() => db.entries.get(entryId), [entryId], null);
  if (entry === null) return null;
  if (!entry) {
    return (
      <SessionScreen title="書き直す" backTo="#/history">
        <p className="note">この回答は見つかりませんでした。記録から選び直してください。</p>
      </SessionScreen>
    );
  }
  return (
    <WriteScreen
      promptText={entry.promptText}
      draftKey={`retry-${entryId}`}
      initialText={entry.text}
      retryOf={entryId}
    />
  );
}
