const puppeteer = require("puppeteer-extra");
const chalk = require("chalk");
const db = require("./models");
const { saveRecord } = require("./helpers");
// const StealthPlugin = require("puppeteer-extra-plugin-stealth");

const error = chalk.bold.red;
const success = chalk.keyword("green");

// puppeteer.use(StealthPlugin());

let scrape = null;
let browser = null;

(async () => {
    try {
        const url = `https://ieeexplore.ieee.org/search/searchresult.jsp?newsearch=true&queryText=(%22project-based%20learning%22%20OR%20%22capstone%20project%22%20OR%20%22software%20project%22%20OR%20%22team%20projects%22%20OR%20%22group%20projects%22%20OR%20%22problem%20based%20learning%22)%20AND%20(%22group%20work%22%20OR%20%22team%20work%22)`;
        scrape = await db.Import.create({
            database: "ieeexplore",
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
    await page.waitForSelector(".result-item", { timeout: 0 });

    let res = await page.evaluate(() => {
        const pageNodes = document.querySelectorAll(".result-item");
        const pageResults = [];
        for (let i = 0; i < pageNodes.length; i++) {
            const node = pageNodes[i];
            const titleNode = node.querySelector("h2");
            const urlNode = titleNode.querySelector("a");
            const url = urlNode !== null ? new URL("https://ieeexplore.ieee.org" + urlNode.getAttribute("href")) : null;
            const authorNode = node.querySelector("p.author");
            const detailNode = node.querySelector(".description");
            const author = (authorNode !== null ? authorNode.innerText.trim() : "")
                + " | " + (detailNode !== null ? detailNode.innerText.trim() : "");

            pageResults.push({
                title: titleNode.innerText,
                url: url !== null ? url.href : null,
                author: author,
                databases: ["ieeexplore"]
            });
        }
        return pageResults;
    });

    let recordPage = await browser.newPage();
    for (let i = 0; i < res.length; i++) {
        let record = res[i];
        if (!record.url) {
            continue;
        }
        await recordPage.goto(record.url, {
            waitUntil: "domcontentloaded",
            timeout: 0,
        });
        await recordPage.waitFor(1000);

        await recordPage.waitForSelector(".abstract-desktop-div");

        const info = await recordPage.evaluate(() => {
            const abstractNode = document.querySelector(".abstract-desktop-div");
            const doiNode = document.querySelector(".stats-document-abstract-doi");
            const url = new URL(document.location.href);
            const pathname = url.pathname.split("/");
            return {
                abstract: abstractNode.querySelector(".u-mb-1").querySelector("div").innerText.trim(),
                alternateUrls: [
                    ...(doiNode !== null ? [doiNode.querySelector("a").getAttribute("href")] : []),
                    `https://ieeexplore.ieee.org/abstract/document/${pathname[pathname.length - 1]}`,
                    `https://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=${pathname[pathname.length - 1]}`
                ],
            };
        });

        record = {...record, ...info};
        console.log(record);
        await saveRecord(record, db, scrape);
    }
    recordPage.close();

    await nextPage(page);
}

async function nextPage(page) {
    await page.waitForSelector(".pagination-bar", { timeout: 0 });

    const isNext = await page.evaluate(async () => {
        const resNode = document.querySelector(".pagination-bar");
        const nextBtn = resNode.querySelector(".next-btn");
        if (nextBtn) {
            nextBtn.querySelector("a").click();
            return true;
        }
        return false;
    });
    if (isNext) {
        page.waitFor(200);
        await processPage(page);
    }
}