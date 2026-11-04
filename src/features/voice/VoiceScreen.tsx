import { useEffect, useRef, useState } from 'react';
import type { Prompt } from '../../data/prompts';
import { reviewAnswer, transcribeOrSample } from '../../lib/coach';
import { clearDraft, loadDraft, saveDraft, saveEntry } from '../../lib/db';
import { transcribeAudio } from '../../lib/gemini';
import { canRecord, startRecording, type Recording } from '../../lib/recorder';
import { ErrorNote, SessionScreen, errorMessage, goTo } from '../../ui';
import { MIN_ANSWER_LENGTH } from '../write/WriteScreen';

const MAX_SECONDS = 180;
type Phase = 'idle' | 'recording' | 'transcribing' | 'editing' | 'reviewing';

export function VoiceScreen({ prompt }: { prompt: Prompt }) {
  const draftKey = `voice-${prompt.id}`;
  const recordable = canRecord();
  const [phase, setPhase] = useState<Phase>(recordable ? 'idle' : 'editing');
  const [text, setText] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [lastAudio, setLastAudio] = useState<Blob | null>(null);
  const recording = useRef<Recording | null>(null);
  const timer = useRef<number>();

  useEffect(() => {
    loadDraft<string>(draftKey).then((draft) => {
      if (draft) {
        setText(draft);
        setPhase('editing');
      }
    });
    return () => {
      clearInterval(timer.current);
      recording.current?.cancel();
    };
  }, [draftKey]);

  async function transcribe(blob: Blob) {
    setPhase('transcribing');
    setError('');
    try {
      const transcript = await transcribeOrSample(() => transcribeAudio(blob));
      setText(transcript);
      void saveDraft(draftKey, transcript);
      setLastAudio(null);
      setPhase('editing');
    } catch (err) {
      setLastAudio(blob);
      setError(errorMessage(err));
      setPhase('idle');
    }
  }

  async function start() {
    setError('');
    try {
      recording.current = await startRecording((blob) => {
        clearInterval(timer.current);
        void transcribe(blob);
      });
    } catch {
      setError('マイクを使えませんでした。iPhoneの設定でマイクを許可するか、キーボードの音声入力で答えてください。');
      return;
    }
    setSeconds(0);
    setPhase('recording');
    const startedAt = Date.now();
    timer.current = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setSeconds(elapsed);
      if (elapsed >= MAX_SECONDS) recording.current?.stop();
    }, 250);
  }

  async function submit() {
    setPhase('reviewing');
    setError('');
    try {
      const review = await reviewAnswer(prompt.text, text, { voice: true });
      const id = await saveEntry({
        createdAt: new Date().toISOString(),
        mode: 'voice',
        promptText: prompt.text,
        text,
        review,
      });
      await clearDraft(draftKey);
      goTo(`entry/${id}`, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setPhase('editing');
    }
  }

  const length = text.trim().length;
  return (
    <SessionScreen title="話して答える" backTo="#/practice">
      <h1 className="session-prompt">{prompt.text}</h1>

      {(phase === 'idle' || phase === 'recording' || phase === 'transcribing') && (
        <div className="recorder">
          {phase === 'idle' && (
            <button className="record-button" onClick={start}>
              録音を始める
            </button>
          )}
          {phase === 'recording' && (
            <button className="record-button recording" onClick={() => recording.current?.stop()}>
              録音を止める
            </button>
          )}
          {phase === 'recording' && (
            <p className="timer" role="timer">
              {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')} / 3:00
            </p>
          )}
          {phase === 'transcribing' && <p className="note">文字にしています</p>}
          {phase === 'idle' && (
            <p className="note">
              最長3分です。録音はAIで文字にするためGoogleへ送られ、端末には残しません。
            </p>
          )}
        </div>
      )}

      {error && <ErrorNote message={error} />}

      {phase === 'idle' && lastAudio && (
        <button className="button wide" onClick={() => transcribe(lastAudio)}>
          もう一度文字にする
        </button>
      )}
      {phase === 'idle' && (
        <button className="text-button" onClick={() => setPhase('editing')}>
          キーボードの音声入力で答える
        </button>
      )}

      {(phase === 'editing' || phase === 'reviewing') && (
        <>
          {!recordable && <p className="note">この環境では録音できません。キーボードのマイクで入力してください。</p>}
          <textarea
            className="answer"
            aria-label="話した内容"
            placeholder="キーボードのマイクボタンを押して話してください"
            value={text}
            disabled={phase === 'reviewing'}
            onChange={(event) => {
              setText(event.target.value);
              void saveDraft(draftKey, event.target.value);
            }}
          />
          <button
            className="button primary wide"
            disabled={phase === 'reviewing' || length < MIN_ANSWER_LENGTH}
            onClick={submit}
          >
            {phase === 'reviewing' ? '採点しています' : '採点する'}
          </button>
          {recordable && phase === 'editing' && (
            <button
              className="text-button"
              onClick={() => {
                setText('');
                void clearDraft(draftKey);
                setPhase('idle');
              }}
            >
              録音からやり直す
            </button>
          )}
        </>
      )}
    </SessionScreen>
  );
}
