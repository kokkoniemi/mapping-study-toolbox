const puppeteer = require("puppeteer-extra");
const chalk = require("chalk");
const db = require("./models");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

const error = chalk.bold.red;
const success = chalk.keyword("green");

puppeteer.use(StealthPlugin());

(async () => {
    let browser = null;
    try {
        browser = await puppeteer.launch({ headless: false });
        let page = await browser.newPage();
        const url = `https://scholar.google.fi/scholar?hl=fi&as_sdt=0%2C5&q=%22programming+language%22+%28intitle%3Ahermeneutics+OR+intitle%3Ahermeneutical+OR+intitle%3A%22literature+review%22+OR+intitle%3A%22meta-analysis%22+OR+intitle%3A%22meta-analytical%22+OR+intitle%3Aphenomenological+OR+intitle%3Aphenomenology%29&btnG=`;
        await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 0,
        });

        await processPage(page);

        await browser.close();
        console.log(success("Browser Closed"));
    } catch (err) {
        console.log(error(err));
        await browser.close();
        console.log(error("Browser Closed"));
    }
})();

async function processPage(page) {
    const waitTime = 2000 + Math.floor(Math.random() * Math.floor(2000)); // To look like a human behaviour
    await page.waitFor(waitTime);
    await page.waitForSelector("#gs_res_ccl_mid", { timeout: 0 });
    await page.waitForSelector(".gs_r", { timeout: 0 });
    await page.waitForSelector("#gs_res_ccl_bot", { timeout: 0 });

    let res = await page.evaluate(() => {
        const resNode = document.querySelector("#gs_res_ccl_mid");
        const pageNodes = resNode.querySelectorAll(".gs_r");
        const pageResults = [];
        for (let i = 0; i < pageNodes.length; i++) {
            const node = pageNodes[i];
            const titleNode = node.querySelector("h3.gs_rt");
            if (titleNode.querySelector(".gs_ctu") !== null
                || node.querySelector("div.gs_a") === null
                || node.querySelector("div.gs_rs") === null
                || titleNode === null
            ) {
                continue;
            }
            const url = titleNode.querySelector("a").getAttribute("href");
            const author = node.querySelector("div.gs_a").innerText.trim();
            const description = node.querySelector("div.gs_rs").innerText.trim();
            pageResults.push({
                title: titleNode.innerText,
                url: url,
                author: author,
                description: description
            });
        }
        return pageResults;
    });

    res.forEach(async (record) => {
        const hasRecord = await db.Record.count({ where: { title: record.title, author: record.author }});
        if (!hasRecord) {
            db.Record.create({ ...record });
        }
    });

    await nextPage(page);
}

async function nextPage(page) {
    await page.waitForSelector("#gs_res_ccl_bot", { timeout: 0 });

    const nextLink = await page.evaluate(async () => {
        const resNode = document.querySelector("#gs_res_ccl_bot");
        const nextBtn = resNode.querySelector(".gs_ico_nav_next");
        if (nextBtn) {
            return nextBtn.parentNode.getAttribute("href");
        }
        return null;
    });
    console.log(nextLink);
    if (nextLink) {
        await page.goto("https://scholar.google.fi" + nextLink, {
            waitUntil: 'domcontentloaded',
            timeout: 0,
        });
        await processPage(page);
    }
}