import { useEffect, useState } from 'react';
import { findPrompt } from './data/prompts';
import { ChooseScreen } from './features/choose/ChooseScreen';
import { DialogueScreen } from './features/dialogue/DialogueScreen';
import { EntryScreen } from './features/history/EntryScreen';
import { HistoryScreen } from './features/history/HistoryScreen';
import { HomeScreen } from './features/home/HomeScreen';
import { PracticeScreen } from './features/home/PracticeScreen';
import { SettingsScreen } from './features/settings/SettingsScreen';
import { SprintScreen } from './features/sprint/SprintScreen';
import { VoiceScreen } from './features/voice/VoiceScreen';
import { RetryScreen, WriteScreen } from './features/write/WriteScreen';
import { TabBar } from './ui';

function useRoute(): string[] {
  const read = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => {
      setRoute(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export default function App() {
  const [page = 'home', param] = useRoute();
  const prompt = param ? findPrompt(decodeURIComponent(param)) : undefined;

  switch (page) {
    case 'write':
      if (prompt) return <WriteScreen key={prompt.id} promptText={prompt.text} draftKey={`write-${prompt.id}`} />;
      break;
    case 'voice':
      if (prompt) return <VoiceScreen key={prompt.id} prompt={prompt} />;
      break;
    case 'retry':
      return <RetryScreen key={param} entryId={Number(param)} />;
    case 'sprint':
      return <SprintScreen />;
    case 'dialogue':
      return <DialogueScreen />;
    case 'choose':
      return <ChooseScreen target={param === 'voice' ? 'voice' : 'write'} />;
  }

  const tabs: Record<string, JSX.Element> = {
    home: <HomeScreen />,
    practice: <PracticeScreen />,
    history: <HistoryScreen />,
    settings: <SettingsScreen />,
  };
  const tabPage = page === 'entry' ? <EntryScreen key={param} entryId={Number(param)} /> : tabs[page] ?? <HomeScreen />;
  return (
    <>
      <main className="screen with-tabs">{tabPage}</main>
      <TabBar current={page === 'entry' ? 'history' : page} />
    </>
  );
}
