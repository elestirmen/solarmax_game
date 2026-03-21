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

async function expectPanelTopmost(page, selector) {
    var topmost = await page.locator(selector).evaluate(function (panel) {
        var rect = panel.getBoundingClientRect();
        var x = rect.left + Math.min(rect.width / 2, Math.max(8, rect.width - 8));
        var y = rect.top + Math.min(rect.height / 2, Math.max(8, rect.height - 8));
        var top = document.elementFromPoint(x, y);
        return !!top && (top === panel || panel.contains(top));
    });
    expect(topmost).toBeTruthy();
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

test('room chat works before the match starts', async ({ browser }) => {
    var hostPage = await browser.newPage();
    var guestPage = await browser.newPage();

    await openMultiplayer(hostPage);
    await openMultiplayer(guestPage);

    var roomCode = await createRoom(hostPage, 'HostAlpha');
    await joinRoom(guestPage, 'GuestBeta', roomCode);

    await expect(hostPage.locator('#chatPanel')).toBeVisible();
    await expect(guestPage.locator('#chatPanel')).toBeVisible();
    await expect(hostPage.locator('#multiplayerChatDock > #chatPanel')).toBeVisible();
    await expect(guestPage.locator('#multiplayerChatDock > #chatPanel')).toBeVisible();

    await hostPage.fill('#chatInput', 'hazir misin');
    await hostPage.click('#chatSendBtn');

    await expect(hostPage.locator('#chatMessages')).toContainText('HostAlpha: hazir misin');
    await expect(guestPage.locator('#chatMessages')).toContainText('HostAlpha: hazir misin');

    await hostPage.close();
    await guestPage.close();
});

test('chat stays visible during the match and chat button focuses the input', async ({ browser }) => {
    var hostPage = await browser.newPage();
    var guestPage = await browser.newPage();

    await openMultiplayer(hostPage);
    await openMultiplayer(guestPage);

    var roomCode = await createRoom(hostPage, 'HostAlpha');
    await joinRoom(guestPage, 'GuestBeta', roomCode);

    await hostPage.click('#startRoomBtn');
    await expect(hostPage.locator('#hud')).toBeVisible();
    await expect(guestPage.locator('#hud')).toBeVisible();
    await expect(hostPage.locator('#chatPanel')).toBeVisible();
    await expect(hostPage.locator('#hudChatDock > #chatPanel')).toBeVisible();

    await hostPage.click('#chatToggle');
    await expect(hostPage.locator('#chatInput')).toBeFocused();
    await expectPanelTopmost(hostPage, '#chatPanel');

    await hostPage.fill('#chatInput', 'oyun ici test');
    await hostPage.press('#chatInput', 'Enter');

    await expect(hostPage.locator('#chatMessages')).toContainText('HostAlpha: oyun ici test');
    await expect(guestPage.locator('#chatMessages')).toContainText('HostAlpha: oyun ici test');

    await hostPage.close();
    await guestPage.close();
});
