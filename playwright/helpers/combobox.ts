import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Helpers for `app-select`: a `role="combobox"` button that opens a modal
 * `<dialog>` with a `role="listbox"`. It is not a native `<select>`, so
 * `selectOption` and `option` locators do not apply.
 */

function listOf(page: Page): Locator {
  return page.locator('dialog.select-dialog [role="listbox"]');
}

/** Opens the combobox and clicks the option whose visible label is exactly `label`. */
export async function chooseOption(trigger: Locator, label: string): Promise<void> {
  const page = trigger.page();
  await trigger.click();
  const option = listOf(page)
    .getByRole('option')
    .filter({ has: page.locator('.option-label').getByText(label, { exact: true }) });
  await option.click();
  await expect(page.locator('dialog.select-dialog')).toHaveCount(0);
}

/** Opens the combobox, reads the option labels in order and closes it again. */
export async function optionLabels(trigger: Locator): Promise<string[]> {
  const page = trigger.page();
  await trigger.click();
  await expect(listOf(page).getByRole('option').first()).toBeVisible();
  const labels = await listOf(page).locator('.option-label').allTextContents();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog.select-dialog')).toHaveCount(0);
  return labels.map((text) => text.trim());
}
