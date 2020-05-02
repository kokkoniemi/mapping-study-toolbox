const puppeteer = require("puppeteer-extra");
// const puppeteer = require("puppeteer-firefox");
const chalk = require("chalk");
const db = require("./models");
// const StealthPlugin = require("puppeteer-extra-plugin-stealth");

const error = chalk.bold.red;
const success = chalk.keyword("green");

// puppeteer.use(StealthPlugin());

(async () => {
    let browser = null;
    try {
        browser = await puppeteer.launch({ headless: false });
        let page = await browser.newPage();

        let rowCount = await db.Record.count({});
        for (let i = 0; i < rowCount; i++) {
            const record = await db.Record.findOne({
                offset: i,
            });
            if (record.abstract === null && !!record.url) {
                const url = new URL(record.url);

                const abstract = await async function () {
                    switch (url.host) {
                        case "ieeexplore.ieee.org":
                            return await scrapeIEEE(page, url);
                        case "www.sciencedirect.com":
                            return await scrapeScienceDirect(page, url);
                        case "link.springer.com":
                            return await scrapeSpringer(page, url);
                        case "dl.acm.org":
                            return await scrapeAcm(page, url);
                        case "idp.springer.com":
                            return await scrapeSpringer(page, url);
                        case "www.tandfonline.com":
                            return await scrapeTandfonline(page, url);
                        case "onlinelibrary.wiley.com":
                            return await scrapeWiley(page, url);
                        case "arxiv.org":
                            return await scrapeArxiv(page, url);
                        default:
                            return null;
                    }
                }();
                record.set("abstract", abstract);
                record.save();
            }
        }
        await browser.close();
        console.log(success("Browser Closed"));
    } catch (err) {
        console.log(error(err));
        await browser.close();
        console.log(error("Browser Closed"));
    }
})();

async function scrapeIEEE(page, url) {
    await page.goto(url.href, {
        waitUntil: "domcontentloaded",
        timeout: 0,
    });
    const waitTime = 500 + Math.floor(Math.random() * Math.floor(2000)); // To look like a human behaviour
    await page.waitFor(waitTime);
    await page.waitForSelector(".abstract-text", { timeout: 0 });
    const res = await page.evaluate(() => {
        const resNode = document.querySelector(".abstract-text");
        return resNode.innerText;
    });
    return res;
}

async function scrapeScienceDirect(page, url) {
    await page.goto(url.href, {
        waitUntil: "domcontentloaded",
        timeout: 0,
    });
    const waitTime = 500 + Math.floor(Math.random() * Math.floor(2000)); // To look like a human behaviour
    await page.waitFor(waitTime);
    try {
        await page.waitForSelector("#abstracts", { timeout: 5000 });
        const res = await page.evaluate(() => {
            const resNode = document.querySelector("#abstracts");
            return resNode.innerText;
        });
        return res;
    } catch (err) {
        return null;
    }

}

async function scrapeSpringer(page, url) {
    await page.goto(url.href, {
        waitUntil: "domcontentloaded",
        timeout: 0,
    });
    const waitTime = 500 + Math.floor(Math.random() * Math.floor(2000)); // To look like a human behaviour
    await page.waitFor(waitTime);
    const currentUrl = new URL(page.url()); // might have changed


    let res = null;
    if (currentUrl.pathname.substring(0, 8) === "/chapter" || currentUrl.pathname.substring(0, 9) === "/protocol") {
        // journal
        try {
            await page.waitForSelector(".Abstract", { timeout: 5000 });
            res = await page.evaluate(() => {
                const resNode = document.querySelector(".Abstract");
                return resNode.innerText;
            });
        } catch (err) {
            res = null;
        }
    } else if (currentUrl.pathname.substring(0, 8) === "/article") {
        // html article
        try {
            await page.waitForSelector(".Abs1-section", { timeout: 5000 });
            res = await page.evaluate(() => {
                const resNode = document.querySelector(".Abs1-section");
                return resNode.innerText;
            });
        } catch (error) {
            await page.waitForSelector("#Abs1-section", { timeout: 5000 });
            res = await page.evaluate(() => {
                const resNode = document.querySelector("#Abs1-section");
                return resNode.innerText;
            });
        }

    } else if (currentUrl.pathname.substring(0, 8) === "/content") {
        // these are most probably pdf-files. Too complex to scrape
        return null;
    }
    return res;
}

async function scrapeAcm(page, url) {
    if (url.pathname.substring(0, 8) === "/doi/pdf") {
        return null;
    }
    await page.goto(url.href, {
        waitUntil: "domcontentloaded",
        timeout: 0,
    });
    const waitTime = 500 + Math.floor(Math.random() * Math.floor(2000)); // To look like a human behaviour
    await page.waitFor(waitTime);
    try {
        await page.waitForSelector(".abstractSection", { timeout: 5000 });
        const res = await page.evaluate(() => {
            const resNode = document.querySelector(".abstractSection");
            return resNode.innerText;
        });
        return res;
    } catch (err) {
        return null;
    }
}

async function scrapeTandfonline(page, url) {
    await page.goto(url.href, {
        waitUntil: "domcontentloaded",
        timeout: 0,
    });
    const waitTime = 500 + Math.floor(Math.random() * Math.floor(2000)); // To look like a human behaviour
    await page.waitFor(waitTime);
    try {
        await page.waitForSelector(".abstractSection", { timeout: 5000 });
        const res = await page.evaluate(() => {
            const resNode = document.querySelector(".abstractSection");
            return resNode.innerText;
        });
        return res;
    } catch (error) {
        return null;
    }
}

async function scrapeWiley(page, url) {
    await page.goto(url.href, {
        waitUntil: "domcontentloaded",
        timeout: 0,
    });
    const waitTime = 500 + Math.floor(Math.random() * Math.floor(2000)); // To look like a human behaviour
    await page.waitFor(waitTime);
    let res = null;
    try {
        await page.waitForSelector(".abstract-group", { timeout: 5000 });
        res = await page.evaluate(() => {
            const resNode = document.querySelector(".abstract-group");
            return resNode.innerText;
        });
    } catch (err) {
        await page.waitForSelector(".article__body", { timeout: 5000 });
        res = await page.evaluate(() => {
            const resNode = document.querySelector(".article__body");
            return resNode.innerText;
        });
    }

    return res;
}

async function scrapeArxiv(page, url) {
    if (url.pathname.substring(0, 4) !== "/abs") {
        return null;
    }
    await page.goto(url.href, {
        waitUntil: "domcontentloaded",
        timeout: 0,
    });
    const waitTime = 500 + Math.floor(Math.random() * Math.floor(2000)); // To look like a human behaviour
    await page.waitFor(waitTime);
    await page.waitForSelector(".abstract", { timeout: 0 });
    const res = await page.evaluate(() => {
        const resNode = document.querySelector(".abstract");
        return resNode.innerText;
    });
    return res;
}
