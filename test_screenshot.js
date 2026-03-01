econst puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    await page.goto('file:///C:/Users/sean/Documents/github/traveller_magnus/hex_map.html');
    await page.waitForTimeout(500);

    await page.evaluate(() => {
        zoom = 1.5;
        cameraX = -200;
        cameraY = -100;

        // Select first cluster and set to SYSTEM PRESENT
        selectedHexes.add("A 0101");
        selectedHexes.add("A 0202");
        updateActionPanel();
        document.getElementById('btn-system').click();

        // Clear selection
        selectedHexes.clear();

        // Select second cluster and set to EMPTY
        selectedHexes.add("A 0401");
        selectedHexes.add("A 0402");
        updateActionPanel();
        document.getElementById('btn-empty').click();

        // Clear selection to see the final result cleanly
        selectedHexes.clear();
        updateActionPanel();

        // Select one hex to keep the Action Menu visible in the screenshot
        selectedHexes.add("A 0303");
        updateActionPanel();

        draw();
    });

    await page.waitForTimeout(500);
    await page.screenshot({ path: 'C:/Users/sean/.gemini/antigravity/brain/4f712d82-cc01-46a0-8d4c-a5c12fb3f0df/populate_demo.png' });
    await browser.close();
})();
