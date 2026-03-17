import { test, expect } from '@playwright/test';

async function openMultiplayer(page) {
    await page.goto('/');
    await page.click('#menuOpenMultiplayerBtn');
    await expect(page.locator('#panelMultiplayer')).toBeVisible();
}

async function createRoom(page, playerName) {
    await page.fill('#playerNameInput', playerName);
    await page.click('#createRoomBtn');

    var status = page.locator('#roomStatus');
    await status.waitFor();
    var text = await status.textContent();
    if (text && /Sunucuya bağlanıyor/i.test(text)) {
        await expect(status).toContainText(/Bağlantı kuruldu|oda/i);
        await page.click('#createRoomBtn');
    }
    await expect(status).toContainText(/Oda:/);
    var finalText = await status.textContent();
    var match = finalText && finalText.match(/Oda:\s*([A-Z0-9]{5})/);
    return match ? match[1] : '';
}

async function joinRoom(page, playerName, roomCode) {
    await page.fill('#playerNameInput', playerName);
    await page.fill('#joinRoomCodeInput', roomCode);
    await page.click('#joinRoomBtn');

    var status = page.locator('#roomStatus');
    var text = await status.textContent();
    if (text && /Sunucuya bağlanıyor/i.test(text)) {
        await expect(status).toContainText(/Bağlantı kuruldu|oda/i);
        await page.click('#joinRoomBtn');
    }
    await expect(status).toContainText(/Oda:/);
}

test('host and joiner can create, join, and start a multiplayer room', async ({ browser }) => {
    var hostPage = await browser.newPage();
    var guestPage = await browser.newPage();

    await openMultiplayer(hostPage);
    await openMultiplayer(guestPage);

    var roomCode = await createRoom(hostPage, 'HostAlpha');
    await expect(hostPage.locator('#startRoomBtn')).toBeVisible();
    await expect(hostPage.locator('#startRoomBtn')).toBeDisabled();
    await expect(roomCode).toHaveLength(5);

    await joinRoom(guestPage, 'GuestBeta', roomCode);
    await expect(hostPage.locator('#startRoomBtn')).toBeEnabled();

    await hostPage.click('#startRoomBtn');
    await expect(hostPage.locator('#hud')).toBeVisible();
    await expect(guestPage.locator('#hud')).toBeVisible();

    await hostPage.close();
    await guestPage.close();
});
