const { test, expect } = require('@playwright/test');

test('Login SquarePay', async ({ browser }) => {

  const context = await browser.newContext();
  const page = await context.newPage();

  // Deschide aplicația
  await page.goto('https://staging.payments.redagora.io/auth');

  // Verifică că butonul este afișat
  const signInButton = page.getByRole('button', { name: 'Sign in' });

  await expect(signInButton).toBeVisible();

  // Click pe Sign in
  await signInButton.click();

});
