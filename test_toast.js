const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    // Catch console logs
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));

    await page.goto('file:///C:/Users/sean/Documents/github/traveller_magnus/hex_map.html');

    // give it time to load
    await new Promise(r => setTimeout(r, 500));

    await page.evaluate(() => {
        // Try calling the function
        showToast("Test Toast Message");
    });

    // Wait 500ms for it to appear
    await new Promise(r => setTimeout(r, 500));

    await page.screenshot({ path: 'C:/Users/sean/.gemini/antigravity/brain/662c948c-ec49-470d-8915-687aea6c0fb7/test_toast.png' });
    await browser.close();
    console.log("Done");
})();
