import { useRef, useState, type ChangeEvent } from 'react';
import { exportBackup, importBackup } from '../../lib/db';
import { MODELS, getSettings, updateSettings } from '../../lib/settings';
import { ErrorNote, errorMessage } from '../../ui';

async function deliverBackup(json: string) {
  const name = `kotoba-keiko-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([json], name, { type: 'application/json' });
  // iPhoneのホーム画面起動ではダウンロードより共有シートのほうが確実
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function SettingsScreen() {
  const [settings, setSettings] = useState(getSettings);
  const [showKey, setShowKey] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function change(patch: Parameters<typeof updateSettings>[0]) {
    setSettings(updateSettings(patch));
  }

  async function onExport() {
    setError('');
    setMessage('');
    try {
      await deliverBackup(await exportBackup());
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function onImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    setMessage('');
    if (!window.confirm('同じ番号の回答は、ファイルの内容で上書きされます。読み込みますか?')) return;
    try {
      const count = await importBackup(await file.text());
      setMessage(`${count}件の回答を読み込みました。`);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      <h1 className="page-title">設定</h1>

      <section className="settings-group">
        <h2>AI</h2>
        <label className="field">
          Gemini APIキー
          <span className="key-row">
            <input
              type={showKey ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              value={settings.apiKey}
              onChange={(event) => change({ apiKey: event.target.value.trim() })}
            />
            <button type="button" className="button" onClick={() => setShowKey(!showKey)}>
              {showKey ? '隠す' : '表示'}
            </button>
          </span>
        </label>
        <p className="note">
          キーは<a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio</a>
          で無料で作れます。この端末の中だけに保存します。
        </p>
        <label className="field">
          使うモデル
          <select value={settings.model} onChange={(event) => change({ model: event.target.value })}>
            {MODELS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.sampleMode}
            onChange={(event) => change({ sampleMode: event.target.checked })}
          />
          見本の採点を使う(AIに送らず、画面の流れだけ試せます)
        </label>
        <p className="note warning">
          無料枠で送った文章や録音は、Googleの製品改善に使われます。仕事の機密や個人情報は書かないでください。
        </p>
      </section>

      <section className="settings-group">
        <h2>データ</h2>
        <p className="note">
          記録はこの端末のブラウザの中だけにあります。iPhoneが消す場合に備えて、ときどき書き出してください。
        </p>
        <div className="actions">
          <button className="button" onClick={onExport}>
            記録を書き出す
          </button>
          <button className="button" onClick={() => fileRef.current?.click()}>
            記録を読み込む
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onImport} />
        {message && <p className="note" role="status">{message}</p>}
        {error && <ErrorNote message={error} />}
      </section>
    </>
  );
}
