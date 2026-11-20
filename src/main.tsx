import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { applyPrefs, networkIsConstrained, readPrefs } from './features/preferences/PreferencesProvider';
import './styles/index.css';

// Apply theme before first paint to avoid a light/dark flash.
const prefs = readPrefs();
applyPrefs(prefs, prefs.lowData === 'on' || (prefs.lowData === 'auto' && networkIsConstrained()));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
