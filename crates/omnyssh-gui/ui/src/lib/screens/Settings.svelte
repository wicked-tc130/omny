<script lang="ts">
  // Local-build settings: appearance, privacy, and dashboard refresh preferences.
  // Upstream update checks are intentionally absent so this customized build can
  // never replace itself with an official OmnySSH release.
  import { Surface, Icon } from '$lib/theme';
  import { theme } from '$lib/stores/theme';
  import { streamerMode } from '$lib/stores/streamer';
  import { refreshInterval, REFRESH_OPTIONS } from '$lib/stores/settings';

  const formatInterval = (secs: number): string => (secs < 60 ? `${secs}s` : `${secs / 60}m`);

  const seg =
    'rounded-lg px-3 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';
  const segState = (active: boolean): string =>
    active ? 'bg-accent text-accent-fg' : 'text-muted hover:bg-surface-inset hover:text-fg';
</script>

<section class="mx-auto h-full max-w-2xl p-6">
  <h1 class="mb-5 text-lg font-semibold tracking-tight">Settings</h1>

  <div class="space-y-4">
    <!-- Appearance -->
    <Surface class="p-5">
      <h2 class="mb-3 text-sm font-semibold">Appearance</h2>
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-sm">Theme</p>
          <p class="text-xs text-muted">Mirrors the sidebar toggle.</p>
        </div>
        <div class="flex gap-1 rounded-xl bg-surface-inset p-1">
          <button
            type="button"
            class="{seg} {segState($theme === 'light')}"
            aria-pressed={$theme === 'light'}
            onclick={() => theme.set('light')}
          >
            <span class="flex items-center gap-1.5"><Icon name="sun" size={14} /> Light</span>
          </button>
          <button
            type="button"
            class="{seg} {segState($theme === 'dark')}"
            aria-pressed={$theme === 'dark'}
            onclick={() => theme.set('dark')}
          >
            <span class="flex items-center gap-1.5"><Icon name="moon" size={14} /> Dark</span>
          </button>
        </div>
      </div>
    </Surface>

    <!-- Privacy -->
    <Surface class="p-5">
      <h2 class="mb-3 text-sm font-semibold">Privacy</h2>
      <div class="flex items-center justify-between gap-4">
        <div class="min-w-0">
          <p class="text-sm">Streamer mode</p>
          <p class="text-xs text-muted">
            Mask host addresses with realistic fakes, so real IPs stay off-screen while recording.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={$streamerMode}
          aria-label="Streamer mode"
          onclick={() => streamerMode.toggle()}
          class="relative h-6 w-11 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus {$streamerMode
            ? 'bg-accent'
            : 'bg-surface-inset'}"
        >
          <span
            class="absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow-soft transition-[left] {$streamerMode
              ? 'left-[1.375rem]'
              : 'left-0.5'}"
          ></span>
        </button>
      </div>
    </Surface>

    <!-- Dashboard -->
    <Surface class="p-5">
      <h2 class="mb-3 text-sm font-semibold">Dashboard</h2>
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-sm">Auto-refresh interval</p>
          <p class="text-xs text-muted">How often the dashboard forces a metric refresh.</p>
        </div>
        <div class="flex flex-wrap justify-end gap-1 rounded-xl bg-surface-inset p-1">
          {#each REFRESH_OPTIONS as secs (secs)}
            <button
              type="button"
              class="{seg} tabular-nums {segState($refreshInterval === secs)}"
              aria-pressed={$refreshInterval === secs}
              onclick={() => refreshInterval.set(secs)}
            >
              {formatInterval(secs)}
            </button>
          {/each}
        </div>
      </div>
    </Surface>

  </div>
</section>
