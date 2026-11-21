import { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function ConnectionBanner() {
  const online = useOnline();
  const [showBack, setShowBack] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  useEffect(() => {
    if (!online) setWasOffline(true);
    else if (wasOffline) {
      setShowBack(true);
      const t = setTimeout(() => setShowBack(false), 3500);
      return () => clearTimeout(t);
    }
  }, [online, wasOffline]);
  if (online && !showBack) return null;
  return (
    <div role="status" className={online ? 'bg-growth-600 text-white' : 'bg-ink-950 text-white'}>
      <div className="container-page flex items-center gap-2 py-2 text-sm">
        {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
        {online ? 'Back online — syncing your progress.' : 'You are offline. Saved lessons are still available; progress will sync when you reconnect.'}
      </div>
    </div>
  );
}
