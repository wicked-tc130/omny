import { expect, test, type Page } from '@playwright/test';

const HOSTS = [
  { name: 'web-1', hostname: 'web-1.example.com', user: 'deploy', port: 22, tags: [], source: 'manual', hasKey: true }
];

async function boot(page: Page): Promise<void> {
  await page.addInitScript((hosts) => {
    let cbid = 0;
    (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {
      invoke: (cmd: string) =>
        cmd === 'list_hosts' ? Promise.resolve(hosts) : Promise.resolve(null),
      transformCallback: (cb: unknown) => {
        const id = ++cbid;
        (window as unknown as Record<string, unknown>)[`__cb${id}`] = cb;
        return id;
      }
    };
  }, HOSTS);
  await page.goto('/');
  await expect(page.getByText('web-1', { exact: true })).toBeVisible();
}

test('Settings controls theme, streamer mode, and dashboard refresh', async ({ page }) => {
  await boot(page);

  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

  await page.getByRole('button', { name: 'Light', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  const streamer = page.getByRole('switch', { name: 'Streamer mode' });
  const initialStreamerState = await streamer.getAttribute('aria-checked');
  await streamer.click();
  await expect(streamer).toHaveAttribute(
    'aria-checked',
    initialStreamerState === 'true' ? 'false' : 'true'
  );

  const tenSec = page.getByRole('button', { name: '10s', exact: true });
  await tenSec.click();
  await expect(tenSec).toHaveAttribute('aria-pressed', 'true');
});
