// The icon registry's name set, shared so callers get compile-time-checked glyphs
// (a typo fails svelte-check rather than rendering nothing).
export type IconName =
  | 'sun'
  | 'moon'
  | 'search'
  | 'dashboard'
  | 'sftp'
  | 'terminal'
  | 'close'
  | 'collapse'
  | 'expand'
  | 'check'
  | 'edit'
  | 'trash'
  | 'plus'
  | 'folder'
  | 'file'
  | 'upload'
  | 'download'
  | 'refresh'
  | 'key'
  | 'settings'
  | 'grip';
