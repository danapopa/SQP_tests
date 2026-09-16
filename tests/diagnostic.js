import { test } from '@playwright/test';

test('Debug Login', async ({ page }) => {
  await page.goto('https://staging.payments.redagora.io/auth');

  console.log('URL:', await page.url());

  const inputs = await page.locator('input').count();
  console.log('INPUTS:', inputs);

  const iframes = await page.locator('iframe').count();
  console.log('IFRAMES:', iframes);

  console.log('Frames found:');
  page.frames().forEach(frame => {
    console.log(frame.url());
  });

  await page.pause();
});
