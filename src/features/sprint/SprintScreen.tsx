import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { SPRINT_PROMPTS } from '../../data/prompts';
import { commentOnSprint, sprintItemsFromAudio } from '../../lib/coach';
import { db, saveEntry } from '../../lib/db';
import { canRecord, startRecording, type Recording } from '../../lib/recorder';
import { ErrorNote, SessionScreen, errorMessage } from '../../ui';

const DURATIONS = [30, 60, 90];
type Phase = 'setup' | 'running' | 'transcribing' | 'done';

function pick(except?: string): string {
  const pool = SPRINT_PROMPTS.filter((text) => text !== except);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function SprintScreen() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [prompt, setPrompt] = useState(() => pick());
  const [duration, setDuration] = useState(60);
  const [voice, setVoice] = useState(false);
  const [lastAudio, setLastAudio] = useState<Blob | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [items, setItems] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [entryId, setEntryId] = useState<number>();
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const latest = useRef({ items, input });
  latest.current = { items, input };
  const inputRef = useRef<HTMLInputElement>(null);
  const recording = useRef<Recording | null>(null);

  const best = useLiveQuery(async () => {
    const entries = await db.entries.where('mode').equals('sprint').toArray();
    return entries
      .filter((entry) => entry.sprintSeconds === duration && !!entry.sprintVoice === voice && entry.id !== entryId)
      .reduce((max, entry) => Math.max(max, entry.sprintItems?.length ?? 0), 0);
  }, [duration, voice, entryId]);

  useEffect(() => () => recording.current?.cancel(), []);

  useEffect(() => {
    if (phase !== 'running') return;
    inputRef.current?.focus();
    const deadline = Date.now() + duration * 1000;
    setRemaining(duration);
    const timer = window.setInterval(() => {
      const left = Math.ceil((deadline - Date.now()) / 1000);
      setRemaining(Math.max(0, left));
      if (left <= 0) {
        clearInterval(timer);
        void finish();
      }
    }, 200);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, duration]);

  async function begin() {
    setError('');
    if (voice) {
      try {
        recording.current = await startRecording((blob) => void transcribe(blob));
      } catch {
        setError('マイクを使えませんでした。iPhoneの設定でマイクを許可するか、打って答えてください。');
        return;
      }
    }
    setPhase('running');
  }

  async function finish() {
    if (voice) {
      setPhase('transcribing');
      recording.current?.stop();
      return;
    }
    const pending = latest.current.input.trim();
    const all = pending && !latest.current.items.includes(pending) ? [...latest.current.items, pending] : latest.current.items;
    setInput('');
    await complete(all);
  }

  async function transcribe(audio: Blob) {
    setError('');
    setLastAudio(null);
    try {
      await complete(await sprintItemsFromAudio(prompt, audio));
    } catch (err) {
      setLastAudio(audio);
      setError(errorMessage(err));
    }
  }

  async function complete(all: string[]) {
    setItems(all);
    setPhase('done');
    if (all.length > 0) {
      const id = await saveEntry({
        createdAt: new Date().toISOString(),
        mode: 'sprint',
        promptText: prompt,
        text: all.join('\n'),
        sprintSeconds: duration,
        sprintItems: all,
        ...(voice ? { sprintVoice: true } : {}),
      });
      setEntryId(id);
    }
  }

  function add() {
    const value = input.trim();
    if (value && !items.includes(value)) setItems([...items, value]);
    setInput('');
    inputRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // 日本語変換を確定するEnterでは追加しない
    if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    add();
  }

  async function askComment() {
    setBusy(true);
    setError('');
    try {
      const text = await commentOnSprint(prompt, items);
      setComment(text);
      if (entryId) await db.entries.update(entryId, { sprintComment: text });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function restart() {
    setPrompt(pick(prompt));
    setItems([]);
    setEntryId(undefined);
    setComment('');
    setError('');
    setLastAudio(null);
    setPhase('setup');
  }

  return (
    <SessionScreen title="瞬発力" backTo="#/practice">
      <h1 className="session-prompt">{prompt}</h1>

      {phase === 'setup' && (
        <>
          <div className="chips" role="group" aria-label="制限時間">
            {DURATIONS.map((seconds) => (
              <button key={seconds} className="chip" aria-pressed={duration === seconds} onClick={() => setDuration(seconds)}>
                {seconds}秒
              </button>
            ))}
          </div>
          {canRecord() && (
            <div className="chips" role="group" aria-label="答え方">
              <button className="chip" aria-pressed={!voice} onClick={() => setVoice(false)}>
                打って答える
              </button>
              <button className="chip" aria-pressed={voice} onClick={() => setVoice(true)}>
                話して答える
              </button>
            </div>
          )}
          {voice && (
            <p className="note">
              時間いっぱい話してください。終わると言葉ごとに分けて数えます。録音はAIで文字にするためGoogleへ送られ、端末には残しません。
            </p>
          )}
          {error && <ErrorNote message={error} />}
          <button className="button primary wide" onClick={begin}>
            始める
          </button>
          <button className="text-button" onClick={() => setPrompt(pick(prompt))}>
            別のお題にする
          </button>
        </>
      )}

      {phase === 'running' && (
        <>
          <div className="sprint-status">
            <span className="sprint-time" role="timer">
              {remaining}
              <small>秒</small>
            </span>
            {voice ? <span>録音しています</span> : <span>{items.length}個</span>}
          </div>
          {!voice && (
            <>
              <div className="sprint-input">
                <input
                  ref={inputRef}
                  aria-label="思いついた言葉"
                  enterKeyHint="next"
                  autoComplete="off"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={onKeyDown}
                />
                <button className="button" onClick={add}>
                  追加
                </button>
              </div>
              <ul className="sprint-items">
                {[...items].reverse().map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          )}
          <button className="text-button" onClick={() => void finish()}>
            ここで終える
          </button>
        </>
      )}

      {phase === 'transcribing' && (
        <>
          {!error && <p className="note">話した言葉を数えています</p>}
          {error && <ErrorNote message={error} />}
          {lastAudio && (
            <button className="button wide" onClick={() => transcribe(lastAudio)}>
              もう一度文字にする
            </button>
          )}
          {lastAudio && (
            <button className="text-button" onClick={restart}>
              この録音を捨てて次のお題へ進む
            </button>
          )}
        </>
      )}

      {phase === 'done' && (
        <>
          <p className="sprint-result">
            {duration}秒で{items.length}個
          </p>
          {!!best && <p className="note">これまでの最高は{best}個です。</p>}
          {items.length === 0 && <p className="note">言葉が出なかったので記録していません。短いお題でもう一度試してみましょう。</p>}
          <ul className="sprint-items">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {comment && <p className="rewrite">{comment}</p>}
          {error && <ErrorNote message={error} />}
          {items.length > 0 && !comment && (
            <button className="button wide" disabled={busy} onClick={askComment}>
              {busy ? 'AIが見ています' : 'AIにコメントをもらう'}
            </button>
          )}
          <button className="button primary wide" onClick={restart}>
            次のお題へ進む
          </button>
        </>
      )}
    </SessionScreen>
  );
}
