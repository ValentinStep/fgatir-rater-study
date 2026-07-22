/**
 * E2E tests for the FGATIR Rater application.
 *
 * These tests validate UI behavior without requiring actual DICOM data.
 * They test loading states, error handling, form rendering, blinding,
 * and keyboard shortcuts.
 *
 * NOTE: Tests requiring actual DICOM rendering (viewport interaction,
 * slice scrolling, W/L adjustments) should be run locally with
 * `npm run ingest-cases` data present. Those are marked test.skip below.
 */

import { test, expect } from '@playwright/test';

test.describe('Application Loading', () => {
  test('shows loading state on startup', async ({ page }) => {
    // Intercept manifest request to delay it
    await page.route('**/dicom-data/manifest.json', async (route) => {
      // Delay response to ensure we see loading state
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          version: '1.0.0-test',
          cases: [
            {
              subjectId: 'SUB_TEST_001',
              series: [
                {
                  seriesId: 'ser_test_aaa111',
                  sliceCount: 3,
                  rows: 256,
                  columns: 256,
                  bitsAllocated: 16,
                  bitsStored: 12,
                  windowCenter: 40,
                  windowWidth: 80,
                  transferSyntaxUID: '1.2.840.10008.1.2.1',
                },
              ],
            },
          ],
        }),
      });
    });

    await page.goto('/');

    // Should display loading indicator
    const loadingEl = page.getByText(/loading/i);
    await expect(loadingEl).toBeVisible({ timeout: 5000 });
  });

  test('shows error with helpful message if manifest fails to load', async ({ page }) => {
    // Intercept manifest request and return 404
    await page.route('**/dicom-data/manifest.json', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'text/plain',
        body: 'Not Found',
      });
    });

    await page.goto('/');

    // Should display an error state with a helpful message
    const errorEl = page.getByText(/failed|error|not found|could not load/i);
    await expect(errorEl).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Rating Form', () => {
  test.beforeEach(async ({ page }) => {
    // Provide a valid manifest so the app enters viewer state
    await page.route('**/dicom-data/manifest.json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          version: '1.0.0-test',
          cases: [
            {
              subjectId: 'SUB_TEST_001',
              series: [
                {
                  seriesId: 'ser_test_aaa111',
                  sliceCount: 3,
                  rows: 256,
                  columns: 256,
                  bitsAllocated: 16,
                  bitsStored: 12,
                  windowCenter: 40,
                  windowWidth: 80,
                  transferSyntaxUID: '1.2.840.10008.1.2.1',
                },
                {
                  seriesId: 'ser_test_bbb222',
                  sliceCount: 3,
                  rows: 256,
                  columns: 256,
                  bitsAllocated: 16,
                  bitsStored: 12,
                  windowCenter: 40,
                  windowWidth: 80,
                  transferSyntaxUID: '1.2.840.10008.1.2.1',
                },
              ],
            },
          ],
        }),
      });
    });

    // Intercept DICOM file requests (they won't exist in test)
    await page.route('**/dicom-data/**/*.dcm', async (route) => {
      await route.fulfill({
        status: 404,
        body: 'No DICOM files in test environment',
      });
    });

    await page.goto('/');
    // Wait for the app to attempt initialization
    await page.waitForTimeout(2000);
  });

  test('renders rating form with all 5 Likert questions', async ({ page }) => {
    // Check for the 5 required Likert-scale questions
    const questions = [
      'Overall image quality',
      'Perceived image noise',
      'Anatomic sharpness',
      'Artifacts',
      'Diagnostic confidence',
    ];

    for (const question of questions) {
      const questionEl = page.getByText(question);
      await expect(questionEl).toBeVisible({ timeout: 10000 });
    }
  });

  test('submit button is disabled when required fields are not filled', async ({ page }) => {
    // Look for a submit button
    const submitBtn = page.getByRole('button', { name: /submit/i });

    // It should be disabled until all required questions are answered
    await expect(submitBtn).toBeDisabled({ timeout: 10000 });
  });

  test('no "original" or "denoised" text visible in rater interface', async ({ page }) => {
    // Wait for the app to load
    await page.waitForTimeout(3000);

    // Get all visible text on the page
    const bodyText = await page.locator('body').textContent();

    // Ensure blinding: no mention of condition
    expect(bodyText?.toLowerCase()).not.toContain('original');
    expect(bodyText?.toLowerCase()).not.toContain('denoised');
  });
});

test.describe('Diagnostic Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/dicom-data/manifest.json', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          version: '1.0.0-test',
          cases: [
            {
              subjectId: 'SUB_TEST_001',
              series: [
                {
                  seriesId: 'ser_test_aaa111',
                  sliceCount: 3,
                  rows: 256,
                  columns: 256,
                  bitsAllocated: 16,
                  bitsStored: 12,
                  windowCenter: 40,
                  windowWidth: 80,
                  transferSyntaxUID: '1.2.840.10008.1.2.1',
                },
              ],
            },
          ],
        }),
      });
    });

    await page.route('**/dicom-data/**/*.dcm', async (route) => {
      await route.fulfill({ status: 404, body: '' });
    });

    await page.goto('/');
    await page.waitForTimeout(2000);
  });

  test('diagnostic panel can be toggled with Ctrl+Shift+D', async ({ page }) => {
    // Panel should not be visible initially
    const panelHeading = page.getByText(/diagnostic/i);

    // Expect no visible diagnostic panel at start
    const initiallyVisible = await panelHeading.isVisible().catch(() => false);

    // Toggle with Ctrl+Shift+D
    await page.keyboard.press('Control+Shift+D');
    await page.waitForTimeout(500);

    // After toggle, the state should have changed
    const afterToggle = await panelHeading.isVisible().catch(() => false);
    expect(afterToggle).not.toBe(initiallyVisible);

    // Toggle again to reverse
    await page.keyboard.press('Control+Shift+D');
    await page.waitForTimeout(500);

    const afterSecondToggle = await panelHeading.isVisible().catch(() => false);
    expect(afterSecondToggle).toBe(initiallyVisible);
  });
});

test.describe('DICOM Viewport (requires local data)', () => {
  /**
   * These tests require actual DICOM data to be present.
   * Run locally after `npm run ingest-cases` to populate local-data/.
   * In CI, these are skipped since no DICOM files are available.
   */

  test.skip('viewport renders DICOM slices when data is available', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(5000);

    // Verify the viewport canvas is rendered
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 15000 });
  });

  test.skip('scroll changes the current slice number', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(5000);

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 15000 });

    // Scroll on the viewport
    await canvas.hover();
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(500);

    // The slice counter should have updated
    const sliceText = page.getByText(/slice/i);
    await expect(sliceText).toBeVisible();
  });
});
