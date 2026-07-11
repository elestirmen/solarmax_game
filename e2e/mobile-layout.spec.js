import { test, expect } from '@playwright/test';

test.use({
    viewport: { width: 375, height: 667 },
    isMobile: true,
    hasTouch: true,
});

async function visibleRects(page, selectors) {
    return page.evaluate((selectors) => {
        function isVisible(el) {
            var rect = el.getBoundingClientRect();
            var style = window.getComputedStyle(el);
            return rect.width > 0
                && rect.height > 0
                && style.display !== 'none'
                && style.visibility !== 'hidden'
                && !el.classList.contains('hidden');
        }

        var rects = [];
        var seen = [];
        selectors.forEach(function (selector) {
            var nodes = Array.prototype.slice.call(document.querySelectorAll(selector));
            nodes.forEach(function (node, index) {
                if (seen.indexOf(node) >= 0) return;
                if (!isVisible(node)) return;
                seen.push(node);
                var rect = node.getBoundingClientRect();
                rects.push({
                    selector: nodes.length > 1 ? selector + '[' + index + ']' : selector,
                    left: rect.left,
                    top: rect.top,
                    right: rect.right,
                    bottom: rect.bottom,
                    width: rect.width,
                    height: rect.height,
                });
            });
        });
        return rects;
    }, selectors);
}

function overlapArea(a, b) {
    var width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    var height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return width * height;
}

async function expectNoTopLevelOverlap(page) {
    var rects = await visibleRects(page, [
        '#hud',
        '#powerSidebar',
        '#minimap',
        '#campaignMissionHud',
        '.game-toast',
        '.achievement-toast',
        '#chatFeed',
        '#tuneOpenBtn',
    ]);
    for (var i = 0; i < rects.length; i++) {
        for (var j = i + 1; j < rects.length; j++) {
            var area = overlapArea(rects[i], rects[j]);
            expect(area, rects[i].selector + ' overlaps ' + rects[j].selector).toBeLessThanOrEqual(4);
        }
    }
}

test('mobile menu and match HUD do not overlap key controls', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#mainMenu')).toBeVisible();
    await expect(page.locator('#startBtn')).toBeVisible();

    var horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(horizontalOverflow).toBeLessThanOrEqual(1);

    await page.click('#menuCustomizeBtn');
    await expect(page.locator('#panelSingleCustomize')).toBeVisible();
    horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(horizontalOverflow).toBeLessThanOrEqual(1);

    await page.click('#customStartBtn');
    await expect(page.locator('#hud')).toBeVisible();
    await page.waitForTimeout(300);
    await expectNoTopLevelOverlap(page);

    await page.click('#hudMobileCommandsBtn');
    await page.waitForTimeout(100);
    await expect(page.locator('#hudRight')).toBeVisible();
    await expectNoTopLevelOverlap(page);

    await page.click('#hudMobileStatusBtn');
    await page.waitForTimeout(100);
    await expect(page.locator('#hudCenter')).toBeVisible();
    await expectNoTopLevelOverlap(page);
});

test('mobile campaign keeps mission and tactical power panels separated', async ({ page }) => {
    await page.goto('/');
    await page.click('#menuOpenContentBtn');
    await expect(page.locator('#panelContent')).toBeVisible();
    await page.click('#contentCampaignStartBtn');

    await expect(page.locator('#hud')).toBeVisible();
    await expect(page.locator('#campaignMissionHud')).toBeVisible();
    await expect(page.locator('#powerSidebar')).toBeVisible();
    await page.waitForTimeout(350);
    await expectNoTopLevelOverlap(page);
});

test('compact landscape match keeps the command deck, minimap, and tactical panel usable', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/');
    await page.click('#startBtn');
    await expect(page.locator('#hud')).toBeVisible();
    await page.waitForTimeout(350);
    await expectNoTopLevelOverlap(page);

    var canvasSpace = await page.locator('#gameCanvas').evaluate(function (canvas) {
        var hud = document.querySelector('#hud').getBoundingClientRect();
        var power = document.querySelector('#powerSidebar').getBoundingClientRect();
        return Math.max(hud.top - power.bottom, hud.top);
    });
    expect(canvasSpace).toBeGreaterThan(100);
});
