import { useState } from 'react';
import type { PlayerCard } from '../types';
import type { ClubSnapshot } from '../cloudPersistence';
import {
  isCloudPersistenceConfigured,
  loadCloudClub,
  saveCloudClub
} from '../cloudPersistence';
import { useAccount } from '../AccountContext';
import { openAuthentication } from '../authNavigation';

export function CloudSavePanel({
  roster,
  startingFive,
  onRestore
}: {
  roster: PlayerCard[];
  startingFive: PlayerCard[];
  onRestore: (snapshot: ClubSnapshot) => boolean;
}) {
  const { session } = useAccount();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  if (!isCloudPersistenceConfigured()) {
    return (
      <section className="cm-panel">
        <div className="cm-panel-header">
          <span>Cloud Roster Backup (Optional)</span>
          <span className="cm-badge cm-badge-blue">Local Browser Storage Active</span>
        </div>
        <div className="cm-panel-body text-xs text-[#313a48]">
          Cloud backup is currently unavailable. Your practice roster remains saved in this browser.
        </div>
      </section>
    );
  }

  const upload = async () => {
    if (!session) return;
    setBusy(true);
    setMessage('');
    try {
      const saved = await saveCloudClub(session, roster, startingFive);
      setMessage(`Cloud roster saved (${saved.roster.length} cards).`);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (!session) return;
    setBusy(true);
    setMessage('');
    try {
      const snapshot = await loadCloudClub(session);
      if (!snapshot) setMessage('No cloud roster has been saved for this account yet.');
      else if (onRestore(snapshot)) setMessage(`Restored ${snapshot.roster.length} cards from cloud.`);
      else setMessage('The cloud lineup was invalid and was not applied locally.');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="cm-panel">
      <div className="cm-panel-header">
        <span>Practice roster backup</span>
        {session && <span className="text-xs text-slate-400">{session.user.name}</span>}
      </div>
      <div className="cm-panel-body space-y-3 text-xs">
        <p className="text-[#313a48]">
          Save or restore your practice collection with your account. Your official club roster is managed in Matchday.
        </p>
        {!session ? <button type="button" className="cm-btn" onClick={() => openAuthentication('sign-in', 'settings')}>Go to sign-in</button> : <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void upload()} className="cm-btn cm-btn-primary">Save practice roster</button>
          <button type="button" disabled={busy} onClick={() => void restore()} className="cm-btn">Restore practice roster</button>
        </div>}
        {message && (
          <p role="status" className="text-xs font-bold text-[#0b1f44]">
            {message}
          </p>
        )}
      </div>
    </section>
  );
}
