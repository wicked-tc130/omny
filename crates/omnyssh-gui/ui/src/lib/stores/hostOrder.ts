import { writable } from 'svelte/store';

const LOCAL_KEY = 'omny-dashboard-host-order';

function readOrder(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((name): name is string => typeof name === 'string') : [];
  } catch {
    return [];
  }
}

function persist(order: string[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(order));
  } catch {
    // A hardened webview may block localStorage; ordering still works for this run.
  }
}

/** Apply a preferred name sequence, keeping unknown/new items in their source order. */
export function orderedByNames<T>(items: T[], nameOf: (item: T) => string, preferred: string[]): T[] {
  const rank = new Map(preferred.map((name, index) => [name, index]));
  return items
    .map((item, sourceIndex) => ({ item, sourceIndex, rank: rank.get(nameOf(item)) }))
    .sort((a, b) => {
      if (a.rank != null && b.rank != null) return a.rank - b.rank;
      if (a.rank != null) return -1;
      if (b.rank != null) return 1;
      return a.sourceIndex - b.sourceIndex;
    })
    .map(({ item }) => item);
}

/** Move one name to the target's current position. Invalid/no-op drags are identity. */
export function reorderNames(names: string[], moving: string, target: string): string[] {
  const from = names.indexOf(moving);
  const to = names.indexOf(target);
  if (from < 0 || to < 0 || from === to) return names;
  const next = names.filter((name) => name !== moving);
  next.splice(to, 0, moving);
  return next;
}

function createHostOrder() {
  let current = readOrder();
  const { subscribe, set } = writable<string[]>(current);

  return {
    subscribe,
    move(availableNames: string[], moving: string, target: string): void {
      const ordered = orderedByNames(availableNames, (name) => name, current);
      current = reorderNames(ordered, moving, target);
      set(current);
      persist(current);
    },
    rename(previousName: string, nextName: string): void {
      if (previousName === nextName || !current.includes(previousName)) return;
      current = current.map((name) => (name === previousName ? nextName : name));
      set(current);
      persist(current);
    }
  };
}

export const hostOrder = createHostOrder();
