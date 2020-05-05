const puppeteer = require("puppeteer-extra");
const chalk = require("chalk");
const db = require("../models");
const { saveRecord } = require("../helpers");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

const error = chalk.bold.red;
const success = chalk.keyword("green");

puppeteer.use(StealthPlugin());
let scrape = null;

(async () => {
    let browser = null;
    try {
        const url = `https://scholar.google.fi/scholar?q=%28%22project-based+learning%22+OR+%22capstone+project%22+OR+%22software+project%22+OR+%22team+projects%22+OR+%22group+projects%22+OR+%22problem+based+learning%22%29+AND+%28%22group+work%22+OR+%22team+work%22%29+AND+%28%22Computer+science+education%22+OR+%22Software+engineering+education%22%29+AND+student&hl=fi&as_sdt=0%2C5&as_ylo=2010&as_yhi=2020`;
        scrape = await db.Import.create({
            database: "scholar",
            query: url,
            total: 0,
            dublicates: 0,
            namesakes: []
        });
        browser = await puppeteer.launch({ headless: false });
        let page = await browser.newPage();
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
            const url = new URL(titleNode.querySelector("a").getAttribute("href"));
            const author = node.querySelector("div.gs_a").innerText.trim();
            const description = node.querySelector("div.gs_rs").innerText.trim();

            pageResults.push({
                title: titleNode.innerText,
                url: url.href,
                author: author,
                description: description,
                databases: ["scholar"]
            });
        }
        return pageResults;
    });

    for (let i = 0; i < res.length; i++) {
        const record = res[i];
        await saveRecord(record, db, scrape);
    }

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