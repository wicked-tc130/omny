import { describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

// A fresh module graph per test isolates the sessions id counter and the active
// entity singleton (tech-gui.md §2). navigation, sessions and activeEntity share
// the graph, so re-importing all three keeps them consistent.
async function fresh() {
  vi.resetModules();
  const nav = await import('./navigation');
  const { sessions } = await import('./sessions');
  const { activeEntity } = await import('./activeEntity');
  return { ...nav, sessions, activeEntity };
}

describe('navigation actions', () => {
  it('spawning a session appends it and makes it active', async () => {
    const { spawnSession, sessions, activeEntity } = await fresh();
    const s = spawnSession('terminal', 'web-1');
    expect(get(sessions)).toHaveLength(1);
    expect(get(activeEntity)).toEqual({ kind: 'session', id: s.id });
  });

  it('allocates unique, monotonic ids', async () => {
    const { spawnSession } = await fresh();
    const a = spawnSession('terminal', 'a');
    const b = spawnSession('sftp', 'b');
    expect(b.id).toBeGreaterThan(a.id);
  });

  it('opens independent terminal tabs for repeated sh clicks on the same host', async () => {
    const { spawnSession, sessions, activeEntity } = await fresh();
    const first = spawnSession('terminal', 'web');
    spawnSession('sftp', 'other');
    const again = spawnSession('terminal', 'web');
    expect(again.id).not.toBe(first.id);
    expect(get(sessions).filter((s) => s.kind === 'terminal' && s.hostName === 'web')).toEqual([
      first,
      again
    ]);
    expect(get(activeEntity)).toEqual({ kind: 'session', id: again.id });
  });

  it('still reactivates an existing live SFTP tab for the same host', async () => {
    const { spawnSession, sessions, activeEntity } = await fresh();
    const first = spawnSession('sftp', 'web');
    spawnSession('terminal', 'other');
    const again = spawnSession('sftp', 'web');
    expect(again.id).toBe(first.id);
    expect(get(sessions).filter((s) => s.kind === 'sftp' && s.hostName === 'web')).toHaveLength(1);
    expect(get(activeEntity)).toEqual({ kind: 'session', id: first.id });
  });

  it('replaces a failed tab when the user clicks sh again', async () => {
    const { spawnSession, sessions } = await fresh();
    const failed = spawnSession('terminal', 'web');
    sessions.setStatus(failed.id, 'failed');
    const retry = spawnSession('terminal', 'web');
    expect(retry.id).not.toBe(failed.id);
    expect(get(sessions).filter((s) => s.hostName === 'web')).toEqual([retry]);
  });

  it('closing the active session removes only it and activates its neighbour', async () => {
    const { spawnSession, closeSession, sessions, activeEntity } = await fresh();
    const a = spawnSession('terminal', 'a');
    const b = spawnSession('sftp', 'b'); // b becomes the active session
    closeSession(b.id);
    expect(get(sessions).map((s) => s.id)).toEqual([a.id]);
    expect(get(activeEntity)).toEqual({ kind: 'session', id: a.id });
  });

  it('closes the active session for the desktop close-tab shortcut', async () => {
    const { spawnSession, closeActiveSession, sessions, activeEntity } = await fresh();
    const a = spawnSession('terminal', 'a');
    const b = spawnSession('terminal', 'b');
    activeEntity.activateSession(a.id);

    expect(closeActiveSession()).toBe(true);
    expect(get(sessions).map((session) => session.hostName)).toEqual(['b']);
    expect(get(activeEntity)).toEqual({ kind: 'session', id: b.id });
  });

  it('falls back to the dashboard after closing the last session', async () => {
    const { spawnSession, closeActiveSession, activeEntity } = await fresh();
    spawnSession('terminal', 'only');
    expect(closeActiveSession()).toBe(true);
    expect(get(activeEntity)).toEqual({ kind: 'dashboard' });
  });

  it('does not consume the close shortcut when no session is active', async () => {
    const { closeActiveSession, activeEntity } = await fresh();
    activeEntity.selectDashboard();
    expect(closeActiveSession()).toBe(false);
  });

  it('closing an inactive session leaves the active entity untouched', async () => {
    const { spawnSession, closeSession, activeEntity } = await fresh();
    const a = spawnSession('terminal', 'a');
    const b = spawnSession('sftp', 'b'); // b active
    closeSession(a.id);
    expect(get(activeEntity)).toEqual({ kind: 'session', id: b.id });
  });
});
