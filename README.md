# Playwright Test Documentation: Winsane Deposit Flows

## Overview

This document explains how the Playwright tests for Winsane deposit flows are structured and written. The tests automate the process of logging into the Winsane staging site, navigating to the dashboard, opening the deposit modal, selecting a payment method, setting an amount, and submitting the deposit.

## Test Structure

### Files
- `winsaneDE-staging-DepositHuch.spec.js` - Test for Pay by Bank payment method
- `winsaneDE-staging-DepositConvertiqSwish.spec.js` - Test for Convertiq Swish payment method
- `playwright.config.js` - Configuration for Playwright (browsers, timeouts, etc.)

### Architecture
The tests use a Page Object Model (POM) pattern with:
- `BasePage` - Common methods for all page interactions
- `WinsanePage` - Winsane-specific selectors and workflows

## Step-by-Step Test Writing Guide

### 1. Setup and Configuration

```javascript
// @ts-check
import { test, expect } from '@playwright/test';

/** @typedef {import('@playwright/test').Page} Page */
/** @typedef {import('@playwright/test').BrowserContext} BrowserContext */
```

- `@ts-check` enables TypeScript checking for JavaScript files
- Import Playwright test utilities and type definitions

### 2. Define Configuration Types

```javascript
/**
 * @typedef {{
 *   baseUrl: string,
 *   selectors: {
 *     loginButton: string,
 *     emailField: string,
 *     passwordField: string,
 *     submitButton: string,
 *     avatarButton: string,
 *     dashboardLink: string,
 *     depositButton: string,
 *     amountInput: string,
 *     submitDepositButton: string,
 *   },
 *   credentials: {
 *     email: string,
 *     password: string,
 *   }
 * }} PageConfig
 */
```

- Defines the structure for site-specific configuration
- Includes selectors for UI elements and login credentials

### 3. Define Constants

```javascript
const TIMING = {
  SHORT: 300,
  MEDIUM: 500,
  LONG: 1000,
};

const TIMEOUTS = {
  ELEMENT_VISIBILITY: 10000,
  NAVIGATION: 15000,
  MODAL_LOAD: 30000,
  POPUP: 20000,
};
```

- `TIMING` - Delays between actions to prevent timing issues
- `TIMEOUTS` - Maximum wait times for various operations

### 4. Create Base Page Class

```javascript
class BasePage {
  constructor(page, context, config = /** @type {PageConfig} */ ({})) {
    this.page = page;
    this.context = context;
    this.config = config;
  }

  async wait(duration) {
    await this.page.waitForTimeout(duration);
  }

  async navigateTo(url) {
    await this.page.goto(url, { waitUntil: 'networkidle' });
  }

  async clickElement(selector, delayAfter = TIMING.MEDIUM) {
    await this.page.click(selector);
    if (delayAfter) await this.wait(delayAfter);
  }

  async fillField(selector, value, delayBefore = 0, delayAfter = TIMING.SHORT) {
    if (delayBefore) await this.wait(delayBefore);
    const field = this.page.locator(selector);
    await field.fill(value);
    if (delayAfter) await this.wait(delayAfter);
  }

  async getErrorMessages() {
    const errorLocator = this.page.locator('text=/invalid|incorrect|failed|error|unauthorized|try again/i');
    if (await errorLocator.count() > 0) {
      const messages = await errorLocator.allTextContents();
      return messages.filter(Boolean).join(' | ');
    }
    return null;
  }

  async debugState(name) {
    await this.page.screenshot({ path: `debug-${name}-${Date.now()}.png` });
    console.log(`URL: ${this.page.url()}`);
    console.log(`Title: ${await this.page.title()}`);
  }
}
```

- Provides reusable methods for common browser interactions
- Includes error handling and debugging utilities

### 5. Create Site-Specific Page Class

```javascript
class WinsanePage extends BasePage {
  constructor(page, context) {
    const config = {
      baseUrl: 'https://staging.winsane.com/',
      selectors: {
        loginButton: '#button_login__main_layout',
        emailField: '#input_email__login_adaptor',
        passwordField: '#input_password__login_adaptor',
        submitButton: '#button_submit__login_adaptor',
        avatarButton: '#button_avatar__quick_user_action',
        dashboardLink: 'a[href="/my-account/dashboard"]',
        depositButton: 'button:has-text("Deposit")',
        amountInput: '#input_amount__default_adaptor',
        submitDepositButton: '#button_submit__internal_payments_modal',
      },
      credentials: {
        email: 'regression-de@softgenius.com',
        password: 'test123',
      },
    };
    super(page, context, config);
  }

  async login(email = this.config.credentials.email, password = this.config.credentials.password) {
    await this.navigateTo(this.config.baseUrl);
    await this.clickElement(this.config.selectors.loginButton);

    const emailField = this.page.locator(this.config.selectors.emailField);
    await emailField.waitFor({ state: 'visible', timeout: TIMEOUTS.ELEMENT_VISIBILITY });
    await this.fillField(this.config.selectors.emailField, email, TIMING.MEDIUM);

    await this.fillField(this.config.selectors.passwordField, password, TIMING.SHORT, TIMING.SHORT);
    await this.clickElement(this.config.selectors.submitButton, TIMING.SHORT);

    try {
      await Promise.race([
        this.page.waitForSelector(this.config.selectors.avatarButton, { state: 'visible', timeout: TIMEOUTS.NAVIGATION }),
        this.page.waitForURL(/my-account\/dashboard/, { timeout: TIMEOUTS.NAVIGATION }),
      ]);
    } catch (error) {
      const errorMsg = await this.getErrorMessages();
      await this.debugState('login-failure');
      throw new Error(`Login failed${errorMsg ? `: ${errorMsg}` : ''}`);
    }
  }

  async navigateToDashboard() {
    const avatarButton = this.page.locator(this.config.selectors.avatarButton);
    await avatarButton.waitFor({ state: 'visible', timeout: TIMEOUTS.MODAL_LOAD });
    await expect(avatarButton).toBeEnabled({ timeout: TIMEOUTS.MODAL_LOAD });
    await this.clickElement(this.config.selectors.avatarButton, TIMING.MEDIUM);

    const dashboardLink = this.page
      .locator(this.config.selectors.dashboardLink)
      .filter({ hasText: /^Dashboard$/i })
      .first();
    await dashboardLink.waitFor({ state: 'visible', timeout: TIMEOUTS.MODAL_LOAD });
    await dashboardLink.click({ force: true });

    await this.page.waitForURL(/my-account\/dashboard/, { timeout: TIMEOUTS.MODAL_LOAD });
    await this.wait(TIMING.MEDIUM);
  }

  async openDepositModal() {
    const depositButton = this.page.locator(this.config.selectors.depositButton);
    await depositButton.waitFor({ state: 'visible', timeout: TIMEOUTS.MODAL_LOAD });
    await expect(depositButton).toBeEnabled({ timeout: TIMEOUTS.MODAL_LOAD });
    await this.clickElement(this.config.selectors.depositButton, TIMING.SHORT);

    await this.page.waitForURL(/#\/deposit/, { timeout: TIMEOUTS.MODAL_LOAD });
    await this.wait(TIMING.MEDIUM);
  }

  async selectPaymentMethod(methodSelector) {
    await this.clickElement(methodSelector, TIMING.MEDIUM);
  }

  async setDepositAmount(amount) {
    await this.fillField(this.config.selectors.amountInput, amount, TIMING.SHORT, TIMING.SHORT);
  }

  async submitDeposit() {
    const [depositPopup] = await Promise.all([
      this.page.waitForEvent('popup', { timeout: TIMEOUTS.POPUP }),
      this.page.click(this.config.selectors.submitDepositButton),
    ]);

    await depositPopup.waitForLoadState('domcontentloaded', { timeout: TIMEOUTS.MODAL_LOAD });
    await this.wait(TIMING.LONG);
    return depositPopup;
  }
}
```

- Extends `BasePage` with Winsane-specific selectors and methods
- Each method performs a specific step in the deposit flow

### 6. Write the Test

```javascript
test('Winsane staging deposit via Pay by Bank', async ({ browser }) => {
  const context = await browser.newContext({
    httpCredentials: { username: 'sg', password: '123' },
    storageState: undefined,
  });

  await context.clearCookies();
  const page = await context.newPage();
  const winsane = new WinsanePage(page, context);

  try {
    // Execute deposit flow
    await winsane.login();
    await page.waitForTimeout(TIMING.MEDIUM);
    
    await winsane.navigateToDashboard();
    await page.waitForTimeout(TIMING.MEDIUM);
    
    await winsane.openDepositModal();
    await page.waitForTimeout(TIMING.MEDIUM);
    
    await winsane.selectPaymentMethod('#card_payment_huch_open_banking__payment_methods_adaptor_1');
    await page.waitForTimeout(TIMING.SHORT);
    
    await winsane.setDepositAmount('10');
    await page.waitForTimeout(TIMING.SHORT);
    
    await winsane.submitDeposit();
  } finally {
    await context.close();
  }
});
```

- Creates a fresh browser context with no cookies
- Instantiates the page object
- Executes the deposit flow step by step
- Ensures context is closed in the `finally` block

## What the Test Does

1. **Setup**: Creates a new browser context with HTTP authentication and clears cookies for a fresh session
2. **Login**: Navigates to Winsane staging, opens login modal, fills credentials, and submits
3. **Navigate to Dashboard**: Clicks avatar button, selects Dashboard link, waits for page load
4. **Open Deposit Modal**: Clicks Deposit button, waits for modal to appear
5. **Select Payment Method**: Clicks the specified payment method card
6. **Set Amount**: Fills the deposit amount field with $10
7. **Submit Deposit**: Clicks submit button and waits for popup window
8. **Cleanup**: Closes the browser context

## Running the Tests

### Run all tests
```bash
npx playwright test
```

### Run specific test file
```bash
npx playwright test tests/winsaneDE-staging-DepositHuch.spec.js
```

### Run with UI mode (for debugging)
```bash
npx playwright test --ui
```

### Run with visible browser
```bash
npx playwright test --headed
```

## Extending for New Payment Methods

1. Create a new test file: `tests/winsaneDE-staging-Deposit[Method].spec.js`
2. Copy the test structure
3. Change the payment method selector in `selectPaymentMethod()` call
4. Update the test name and description

Example:
```javascript
await winsane.selectPaymentMethod('#card_payment_new_method__payment_methods_adaptor_X');
```

## Debugging

- Tests take screenshots on failures
- Use `--headed` flag to see browser actions
- Check HTML report at `playwright-report/index.html`
- Use `debugState()` method for manual debugging

## Best Practices

- Always use fresh browser sessions (no cookies/storage)
- Include appropriate waits between actions
- Use descriptive test names
- Handle errors gracefully with screenshots
- Keep selectors in configuration objects
- Use Page Object Model for maintainability