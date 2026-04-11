import { test, expect } from '@playwright/test';

test.describe('Payment and Gift Card Flows', () => {
  test('home page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/en/); // Should redirect to locale
    await expect(page.locator('body')).toBeVisible();
  });

  test('gift cards page loads', async ({ page }) => {
    await page.goto('/en/gift-cards');
    await expect(page.locator('body')).toBeVisible();
    // Check for gift card related content
    const pageContent = await page.content();
    expect(pageContent.toLowerCase()).toContain('gift');
  });

  test('store page loads', async ({ page }) => {
    await page.goto('/en/store');
    await expect(page.locator('body')).toBeVisible();
  });

  test('order flow page loads', async ({ page }) => {
    await page.goto('/en/order');
    await expect(page.locator('body')).toBeVisible();
  });

  test('payment page structure', async ({ page }) => {
    // Navigate to payment page directly
    await page.goto('/en/order/payment');
    await expect(page.locator('body')).toBeVisible();

    // The payment page should render (may redirect or show login)
    const content = await page.content();
    // Page should have loaded without critical errors
    expect(content.length).toBeGreaterThan(100);
  });

  test('gift card purchase page loads', async ({ page }) => {
    await page.goto('/en/gift-cards/purchase');
    await expect(page.locator('body')).toBeVisible();
  });

  test('store checkout flow exists', async ({ page }) => {
    await page.goto('/en/store/checkout');
    await expect(page.locator('body')).toBeVisible();
  });

  test('store cart page loads', async ({ page }) => {
    await page.goto('/en/store/cart');
    await expect(page.locator('body')).toBeVisible();
  });
});
