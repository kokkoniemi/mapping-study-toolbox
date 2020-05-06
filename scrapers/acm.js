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
        const url = `https://dl.acm.org/action/doSearch?AllField=%28%22project-based+learning%22+OR+%22capstone+project%22+OR+%22software+project%22+OR+%22team+projects%22+OR+%22group+projects%22+OR+%22problem+based+learning%22%29+AND+%28%22group+work%22+OR+%22team+work%22%29+AND+%28%22Computer+science+education%22+OR+%22Software+engineering+education%22%29+AND+student&AfterYear=2010&BeforeYear=2020&pageSize=20&expand=all`;
        // initialize a scrape log
        scrape = await db.Import.create({
            database: "acm",
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
    const waitTime = 5000 + Math.floor(Math.random() * Math.floor(2000)); // To look like a human behaviour
    await page.waitFor(waitTime);
    await page.waitForSelector(".items-results", { timeout: 0 });
    await page.waitForSelector(".search__item", { timeout: 0 });

    let res = await page.evaluate(() => {
        const resNode = document.querySelector(".items-results");
        const pageNodes = resNode.querySelectorAll(".search__item");
        const pageResults = [];
        for (let i = 0; i < pageNodes.length; i++) {
            const node = pageNodes[i];
            const titleNode = node.querySelector("h5.issue-item__title");
            const url = new URL("https://dl.acm.org" + titleNode.querySelector("a").getAttribute("href"));
            const authorNode = node.querySelector(".rlist--inline");
            const detailNode = node.querySelector(".issue-item__detail");
            const author = (authorNode !== null ? authorNode.innerText.trim() : "")
                + " | " + (detailNode !== null ? node.querySelector(".issue-item__detail").innerText : '');
            const description = node.querySelector(".issue-item__abstract");

            const pathname = url.pathname.split("/");
            const alternateUrls = [
                `https://dl.acm.org/doi/${pathname[pathname.length - 2]}/${pathname[pathname.length - 1]}`,
                `https://dl.acm.org/doi/pdf/${pathname[pathname.length - 2]}/${pathname[pathname.length - 1]}`,
                `https://dl.acm.org/citation.cfm?id=${pathname[pathname.length - 1]}`,
                `https://doi.org/${pathname[pathname.length - 2]}/${pathname[pathname.length - 1]}`
            ];

            pageResults.push({
                title: titleNode.innerText,
                url: url.href,
                author: author,
                description: description !== null ? description.innerText.trim() : null,
                databases: ["acm"],
                alternateUrls
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
    await page.waitForSelector(".pagination", { timeout: 0 });

    const nextLink = await page.evaluate(async () => {
        const resNode = document.querySelector(".pagination");
        const nextBtn = resNode.querySelector(".pagination__btn--next");
        if (nextBtn) {
            return nextBtn.getAttribute("href");
        }
        return null;
    });
    if (nextLink) {
        await page.goto(nextLink, {
            waitUntil: 'domcontentloaded',
            timeout: 0,
        });
        await processPage(page);
    }
}