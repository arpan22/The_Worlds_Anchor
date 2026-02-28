import { useEffect, useState } from 'react';
import GroqChatPanel from './GroqChatPanel';
import { getGroqStatus } from '../services/groqClient';
import './GroqChatWidget.css';

export default function GroqChatWidget({ newsBriefing = '' }) {
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      try {
        const status = await getGroqStatus();
        if (!cancelled) setConfigured(Boolean(status.configured));
      } catch {
        if (!cancelled) setConfigured(false);
      }
    }

    loadStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <GroqChatPanel configured={configured} newsBriefing={newsBriefing} embedded />
  );
}
