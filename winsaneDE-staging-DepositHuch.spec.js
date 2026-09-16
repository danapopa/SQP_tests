// @ts-check
import { test, expect } from '@playwright/test';

/** @typedef {import('@playwright/test').Page} Page */
/** @typedef {import('@playwright/test').BrowserContext} BrowserContext */
/**
 * @typedef {{
 *   baseUrl: string,
 *   selectors: {
 *     loginButton: string,
 *     emailField: string,
 *     passwordField: string,
 *     submitButton: string,
 *     alternateLoginLink?: string,
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

/**
 * Configuration constants for timing and UI interactions
 */
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

/**
 * Base page class with common methods for all page objects
 */
class BasePage {
  /**
   * @param {Page} page
   * @param {BrowserContext} context
   * @param {PageConfig} [config={}] - Configuration object with site-specific settings
   */
  constructor(page, context, config = /** @type {PageConfig} */ ({})) {
    this.page = page;
    this.context = context;
    this.config = config;
  }

  /**
   * Wait for a specified duration
   * @param {number} duration - Duration in milliseconds
   */
  async wait(duration) {
    await this.page.waitForTimeout(duration);
  }

  /**
   * Navigate to a URL
   * @param {string} url - URL to navigate to
   */
  async navigateTo(url) {
    await this.page.goto(url, { waitUntil: 'networkidle' });
  }

  /**
   * Click an element with optional delay
   * @param {string} selector - Element selector
   * @param {number} delayAfter - Delay in ms after click
   */
  async clickElement(selector, delayAfter = TIMING.MEDIUM) {
    await this.page.click(selector);
    if (delayAfter) await this.wait(delayAfter);
  }

  /**
   * Fill a form field with optional delays
   * @param {string} selector - Field selector
   * @param {string} value - Value to fill
   * @param {number} delayBefore - Delay before filling
   * @param {number} delayAfter - Delay after filling
   */
  async fillField(selector, value, delayBefore = 0, delayAfter = TIMING.SHORT) {
    if (delayBefore) await this.wait(delayBefore);
    const field = this.page.locator(selector);
    await field.fill(value);
    if (delayAfter) await this.wait(delayAfter);
  }

  /**
   * Wait for an element and interact with it
   * @param {string} selector - Element selector
   * @param {string} action - Action to perform ('click', 'fill', etc.)
   * @param {any} actionParam - Parameter for the action
   */
  async waitAndPerform(selector, action, actionParam = null) {
    const locator = this.page.locator(selector);
    await locator.waitFor({ state: 'visible', timeout: TIMEOUTS.ELEMENT_VISIBILITY });
    
    if (action === 'click') {
      await locator.click({ force: true });
    } else if (action === 'fill') {
      await locator.fill(actionParam);
    }
  }

  /**
   * Get error messages from the page
   * @returns {Promise<string|null>} Error message text or null when none found
   */
  async getErrorMessages() {
    const errorLocator = this.page.locator('text=/invalid|incorrect|failed|error|unauthorized|try again/i');
    if (await errorLocator.count() > 0) {
      const messages = await errorLocator.allTextContents();
      return messages.filter(Boolean).join(' | ');
    }
    return null;
  }

  /**
   * Debug helper - take screenshot and log state
   * @param {string} name - Screenshot name
   */
  async debugState(name) {
    await this.page.screenshot({ path: `debug-${name}-${Date.now()}.png` });
    console.log(`URL: ${this.page.url()}`);
    console.log(`Title: ${await this.page.title()}`);
  }
}

/**
 * Winsane-specific page object for deposit flows
 * Extends BasePage with Winsane-specific selectors and workflows
 */
class WinsanePage extends BasePage {
  /**
   * @param {Page} page
   * @param {BrowserContext} context
   */
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

  /**
   * Log into Winsane with error handling
   * @param {string} email - Optional custom email
   * @param {string} password - Optional custom password
   */
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

  /**
   * Navigate to dashboard
   */
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

  /**
   * Open the deposit modal
   */
  async openDepositModal() {
    const depositButton = this.page.locator(this.config.selectors.depositButton);
    await depositButton.waitFor({ state: 'visible', timeout: TIMEOUTS.MODAL_LOAD });
    await expect(depositButton).toBeEnabled({ timeout: TIMEOUTS.MODAL_LOAD });
    await this.clickElement(this.config.selectors.depositButton, TIMING.SHORT);

    await this.page.waitForURL(/#\/deposit/, { timeout: TIMEOUTS.MODAL_LOAD });
    await this.wait(TIMING.MEDIUM);
  }

  /**
   * Select a payment method
   * @param {string} methodSelector - Selector for the payment method card
   */
  async selectPaymentMethod(methodSelector) {
    await this.clickElement(methodSelector, TIMING.MEDIUM);
  }

  /**
   * Set deposit amount
   * @param {string} amount - Amount to deposit
   */
  async setDepositAmount(amount) {
    await this.fillField(this.config.selectors.amountInput, amount, TIMING.SHORT, TIMING.SHORT);
  }

  /**
   * Submit deposit and return popup page
   * @returns {Promise<Page>} The popup page
   */
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
