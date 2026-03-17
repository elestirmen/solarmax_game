import { test, expect } from '@playwright/test';

test('menu panels, help overlay, and local match start work', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#mainMenu')).toBeVisible();
    await expect(page.locator('#startBtn')).toBeVisible();

    await page.click('#menuOpenToolsBtn');
    await expect(page.locator('#panelTools')).toBeVisible();

    await page.click('#howToPlayBtn');
    await expect(page.locator('#howToPlayOverlay')).toBeVisible();
    await page.click('#closeHowToPlayBtn');
    await expect(page.locator('#howToPlayOverlay')).toBeHidden();

    await page.click('#menuBackBtn');
    await expect(page.locator('#menuHubView')).toBeVisible();
    await page.click('#menuCustomizeBtn');
    await expect(page.locator('#panelSingleCustomize')).toBeVisible();

    await page.click('#customStartBtn');
    await expect(page.locator('#hud')).toBeVisible();
    await expect(page.locator('#pauseBtn')).toBeVisible();
    await expect(page.locator('#gameCanvas')).toBeVisible();
});

test('host setup panel updates locked inputs by room type', async ({ page }) => {
    await page.goto('/');

    await page.click('#menuOpenMultiplayerBtn');
    await expect(page.locator('#panelMultiplayer')).toBeVisible();

    await page.click('#hostSetupBtn');
    await expect(page.locator('#panelHostSetup')).toBeVisible();

    await page.selectOption('#multiRoomTypeSelect', 'daily');
    await expect(page.locator('#multiSeedInput')).toBeDisabled();
    await expect(page.locator('#multiPlaylistSelect')).toBeDisabled();

    await page.selectOption('#multiRoomTypeSelect', 'standard');
    await expect(page.locator('#multiSeedInput')).toBeEnabled();
    await expect(page.locator('#multiPlaylistSelect')).toBeEnabled();
});
