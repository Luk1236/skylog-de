import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ladeTheme, wendeAn } from './services/theme';
import { ErrorBoundary } from './components/ErrorBoundary';

// Theme vor dem ersten Render setzen, damit es nicht kurz hell aufblitzt.
wendeAn(ladeTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
