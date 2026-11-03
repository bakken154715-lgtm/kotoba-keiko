import type { ReactNode } from 'react';

const TABS = [
  { id: 'home', label: '今日' },
  { id: 'practice', label: '練習' },
  { id: 'history', label: '記録' },
  { id: 'settings', label: '設定' },
];

export function TabBar({ current }: { current: string }) {
  return (
    <nav className="tabbar" aria-label="メイン">
      {TABS.map((tab) => (
        <a key={tab.id} href={`#/${tab.id}`} aria-current={current === tab.id ? 'page' : undefined}>
          {tab.label}
        </a>
      ))}
    </nav>
  );
}

/** 練習中の画面。集中のためタブを隠し、戻る操作だけを置く */
export function SessionScreen({ title, backTo, children }: { title: string; backTo: string; children: ReactNode }) {
  return (
    <main className="screen">
      <header className="session-head">
        <a className="back" href={backTo}>
          戻る
        </a>
        <span>{title}</span>
      </header>
      {children}
    </main>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p className="error" role="alert">
      {message}
    </p>
  );
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '処理に失敗しました。もう一度試してください。';
}

export function goTo(path: string, options: { replace?: boolean } = {}) {
  if (options.replace) window.location.replace(`#/${path}`);
  else window.location.hash = `#/${path}`;
}

/** 縦書きで半角の記号が横倒しにならないよう全角にする */
export function forVertical(text: string): string {
  return text.replace(/\?/g, '？').replace(/!/g, '！');
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}
