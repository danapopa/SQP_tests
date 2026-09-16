import { expect, test } from '@playwright/test';
import { credentials } from '../Test-data/credentials.js';

test('Login SquarePay', async ({ page }) => {

  await page.goto('https://staging.payments.redagora.io/auth');

  const auth0PagePromise = page.context().waitForEvent('page');
  await page.getByRole('button', { name: 'Sign in' }).click();
  const auth0Page = await auth0PagePromise;

  await auth0Page.waitForURL(/sgidentity-staging\.eu\.auth0\.com\/u\/login/);
  await auth0Page.locator('#username').waitFor({ state: 'visible' });

  await auth0Page.locator('#username').fill(credentials.username);
  await auth0Page.locator('#password').fill(credentials.password);

  await auth0Page.getByRole('button', { name: 'Continue', exact: true }).click();

  const rulesItem = page.locator('div.v-list-item-title', { hasText: 'Rules' });
  await expect(rulesItem).toBeVisible({ timeout: 15000 });
  await rulesItem.click();

});