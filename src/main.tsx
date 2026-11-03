import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// iOSが保存データを消しにくくなるよう、可能なら永続保存を求める
navigator.storage?.persist?.().catch(() => undefined);

createRoot(document.getElementById('root')!).render(<App />);
