// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { orderedByNames, reorderNames } from './hostOrder';

describe('dashboard host ordering', () => {
  beforeEach(() => localStorage.clear());

  it('applies saved names and keeps new hosts in source order at the end', () => {
    const hosts = [{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'new' }];
    expect(orderedByNames(hosts, (host) => host.name, ['c', 'a', 'missing', 'b']).map((h) => h.name)).toEqual([
      'c',
      'a',
      'b',
      'new'
    ]);
  });

  it('moves forward and backward to the target position', () => {
    expect(reorderNames(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a']);
    expect(reorderNames(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']);
  });

  it('does nothing for unknown names or the same card', () => {
    const names = ['a', 'b'];
    expect(reorderNames(names, 'a', 'a')).toBe(names);
    expect(reorderNames(names, 'missing', 'a')).toBe(names);
  });

  it('persists a drag and restores it in a fresh module graph', async () => {
    vi.resetModules();
    const first = await import('./hostOrder');
    first.hostOrder.move(['a', 'b'], 'a', 'b');
    expect(localStorage.getItem('omny-dashboard-host-order')).toBe('["b","a"]');

    vi.resetModules();
    const second = await import('./hostOrder');
    let restored: string[] = [];
    const stop = second.hostOrder.subscribe((order) => (restored = order));
    expect(restored).toEqual(['b', 'a']);
    stop();
  });

  it('keeps a renamed host in its saved dashboard position', async () => {
    vi.resetModules();
    localStorage.setItem('omny-dashboard-host-order', '["b","a"]');
    const { hostOrder } = await import('./hostOrder');
    hostOrder.rename('b', 'renamed');
    expect(localStorage.getItem('omny-dashboard-host-order')).toBe('["renamed","a"]');
  });
});
