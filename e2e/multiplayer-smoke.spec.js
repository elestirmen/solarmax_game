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

async function expectAnchoredLeft(page, selector) {
    var box = await page.locator(selector).boundingBox();
    expect(box).toBeTruthy();
    expect(box.x).toBeLessThan(40);
}

async function expectCentered(page, selector) {
    var metrics = await page.locator(selector).evaluate(function (el) {
        var rect = el.getBoundingClientRect();
        return {
            centerX: rect.left + rect.width / 2,
            centerY: rect.top + rect.height / 2,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
        };
    });
    expect(Math.abs(metrics.centerX - metrics.viewportWidth / 2)).toBeLessThan(28);
    expect(Math.abs(metrics.centerY - metrics.viewportHeight / 2)).toBeLessThan(28);
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

test('online host setup refreshes the default seed when the user has not pinned one', async ({ page }) => {
    await openMultiplayer(page);

    await page.click('#hostSetupBtn');
    var firstSeed = await page.locator('#multiSeedInput').inputValue();
    await expect(page.locator('#multiSeedInput')).not.toHaveValue('42');

    await page.click('#hostSetupBackBtn');
    await page.click('#hostSetupBtn');
    var secondSeed = await page.locator('#multiSeedInput').inputValue();

    expect(secondSeed).not.toBe(firstSeed);
});

test('room chat works before the match starts', async ({ browser }) => {
    var hostPage = await browser.newPage();
    var guestPage = await browser.newPage();

    await openMultiplayer(hostPage);
    await openMultiplayer(guestPage);

    var roomCode = await createRoom(hostPage, 'HostAlpha');
    await joinRoom(guestPage, 'GuestBeta', roomCode);

    await expect(hostPage.locator('#chatFeed')).toBeVisible();
    await expect(guestPage.locator('#chatFeed')).toBeVisible();
    await expect(hostPage.locator('#menuChatToggle')).toBeVisible();
    await expect(guestPage.locator('#menuChatToggle')).toBeVisible();
    await expectAnchoredLeft(hostPage, '#chatFeed');
    await expectAnchoredLeft(guestPage, '#chatFeed');

    await hostPage.click('#menuChatToggle');
    await expect(hostPage.locator('#chatComposer')).toBeVisible();
    await expectCentered(hostPage, '#chatComposer');
    await expect(hostPage.locator('#chatInput')).toBeFocused();
    await hostPage.fill('#chatInput', 'hazir misin');
    await hostPage.click('#chatSendBtn');
    await expect(hostPage.locator('#chatComposer')).toBeHidden();

    await expect(hostPage.locator('#chatMessages')).toContainText('HostAlpha: hazir misin');
    await expect(guestPage.locator('#chatMessages')).toContainText('HostAlpha: hazir misin');
    await expect(guestPage.locator('#gameToastMsg')).toContainText('HostAlpha: hazir misin');

    await hostPage.close();
    await guestPage.close();
});

test('chat feed stays visible during the match and chat button opens the input composer', async ({ browser }) => {
    var hostPage = await browser.newPage();
    var guestPage = await browser.newPage();

    await openMultiplayer(hostPage);
    await openMultiplayer(guestPage);

    var roomCode = await createRoom(hostPage, 'HostAlpha');
    await joinRoom(guestPage, 'GuestBeta', roomCode);

    await hostPage.click('#startRoomBtn');
    await expect(hostPage.locator('#hud')).toBeVisible();
    await expect(guestPage.locator('#hud')).toBeVisible();
    await expect(hostPage.locator('#chatFeed')).toBeVisible();
    await expect(guestPage.locator('#chatFeed')).toBeVisible();
    await expectAnchoredLeft(hostPage, '#chatFeed');

    await hostPage.click('#chatToggle');
    await expect(hostPage.locator('#chatComposer')).toBeVisible();
    await expectCentered(hostPage, '#chatComposer');
    await expect(hostPage.locator('#chatInput')).toBeFocused();

    await hostPage.fill('#chatInput', 'oyun ici test');
    await hostPage.press('#chatInput', 'Enter');
    await expect(hostPage.locator('#chatComposer')).toBeHidden();

    await expect(hostPage.locator('#chatMessages')).toContainText('HostAlpha: oyun ici test');
    await expect(guestPage.locator('#chatMessages')).toContainText('HostAlpha: oyun ici test');
    await expect(guestPage.locator('#gameToastMsg')).toContainText('HostAlpha: oyun ici test');

    await hostPage.close();
    await guestPage.close();
});
