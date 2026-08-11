import { get } from 'svelte/store';
import { activeEntity } from './activeEntity';
import { sessions, type Session, type SessionKind } from './sessions';

// Composed navigation actions that keep the sessions list and the active entity in
// step (tech-gui.md §2). A spawn appends a session and makes it active (both spawn
// paths do this). Terminal spawns are intentionally never deduplicated: multiple
// shells to the same host are a normal workflow. SFTP keeps one live tab per host.
// Closing an active tab selects its nearest neighbour, or Dashboard when none remain.
export function spawnSession(kind: SessionKind, hostName: string): Session {
  const matches = get(sessions).filter((session) => session.kind === kind && session.hostName === hostName);
  if (kind === 'sftp') {
    const reusable = matches.find((session) => session.status !== 'failed');
    if (reusable) {
      activeEntity.activateSession(reusable.id);
      return reusable;
    }
  }
  // A synchronous open failure leaves its tab available for diagnosis. A second
  // click is an explicit retry: discard failed copies so the new TerminalView runs
  // `terminal_open` again instead of merely reactivating a dead tab.
  for (const failed of matches.filter((session) => session.status === 'failed')) {
    sessions.close(failed.id);
  }
  const session = sessions.spawn(kind, hostName);
  activeEntity.activateSession(session.id);
  return session;
}

export function closeSession(id: number): void {
  const active = get(activeEntity);
  const current = get(sessions);
  const closingIndex = current.findIndex((session) => session.id === id);
  const remaining = current.filter((session) => session.id !== id);
  sessions.close(id);
  if (active.kind === 'session' && active.id === id) {
    const neighbour = remaining[Math.min(Math.max(closingIndex, 0), remaining.length - 1)];
    if (neighbour) activeEntity.activateSession(neighbour.id);
    else activeEntity.selectDashboard();
  }
}

/** Close whichever session is currently visible. Returns whether the shortcut was
 *  consumed, so callers can leave the platform's normal window-close behaviour
 *  untouched when Dashboard or Settings is active. */
export function closeActiveSession(): boolean {
  const active = get(activeEntity);
  if (active.kind !== 'session') return false;
  closeSession(active.id);
  return true;
}
