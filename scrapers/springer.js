const puppeteer = require("puppeteer-extra");
const chalk = require("chalk");
const db = require("../models");
const { saveRecord } = require("../helpers");
// const StealthPlugin = require("puppeteer-extra-plugin-stealth");

const error = chalk.bold.red;
const success = chalk.keyword("green");

// puppeteer.use(StealthPlugin());

let scrape = null;
let browser = null;

(async () => {
    try {
        const url = `https://link.springer.com/search?date-facet-mode=between&facet-start-year=2010&query=%28%22project-based+learning%22++OR++%22project+based+learning%22++OR++pbl+OR++capstone++OR++%22student+project%22++OR++%22student+projects%22++OR++%22team+project%22++OR++%22team+projects%22++OR++%22group+project%22++OR++%22group+projects%22++OR++%22problem-based+learning%22++OR++%22problem+based+learning%22%29++AND++%28%22group+work%22++OR++%22team+work%22++OR++teamwork%29++AND+%28%22computing%22++OR++%22computer+science%22++OR++%22software+engineering%22%29&facet-discipline=%22Education%22&facet-sub-discipline=%22Higher+Education%22&facet-end-year=2020`;

        browser = await puppeteer.launch({ headless: false });
        let page = await browser.newPage();


        scrape = await db.Import.create({
            database: "springer",
            query: url,
            total: 0,
            dublicates: 0,
            namesakes: []
        });
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
    await page.waitForSelector(".content-item-list", { timeout: 0 });

    let res = await page.evaluate(() => {
        const resNode = document.querySelector(".content-item-list");
        const pageNodes = resNode.querySelectorAll("li");
        const pageResults = [];
        for (let i = 0; i < pageNodes.length; i++) {
            const node = pageNodes[i];
            const titleNode = node.querySelector("h2");
            const urlNode = titleNode.querySelector("a");
            const url = urlNode !== null ? new URL("https://link.springer.com" + urlNode.getAttribute("href")) : null;
            const authorNode = node.querySelector(".meta");

            pageResults.push({
                title: titleNode.innerText,
                url: url !== null ? url.href : null,
                author: authorNode.innerText,
                databases: ["springer"]
            });
        }
        return pageResults;
    });
    console.log(res);

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

        try {
            await recordPage.waitForSelector(".Abstract", {
                timeout: 5000,
            });
        } catch (err) { }

        const url = new URL(record.url);
        let abstract = null;
        if (url.pathname.substring(0, 8) === "/chapter" || url.pathname.substring(0, 9) === "/protocol") {
            // journal
            try {
                await recordPage.waitForSelector(".Abstract", { timeout: 5000 });
                abstract = await recordPage.evaluate(async () => {
                    const resNode = document.querySelector(".Abstract");
                    return resNode.innerText;
                });
            } catch (err) {
                console.log(error(err));
            }
        } else if (url.pathname.substring(0, 8) === "/article") {
            // html article
            try {
                await recordPage.waitForSelector(".Abs1-section", { timeout: 5000 });
                abstract = await recordPage.evaluate(async () => {
                    const resNode = document.querySelector(".Abs1-section");
                    return resNode.innerText;
                });
            } catch (err) {
                try {
                    await recordPage.waitForSelector("#Abs1-section", { timeout: 5000 });
                    abstract = await recordPage.evaluate(() => {
                        const resNode = document.querySelector("#Abs1-section");
                        return resNode.innerText;
                    });
                } catch (err) { }
            }
        } else if (url.pathname.substring(0, 19) === "/referenceworkentry") {
            // Living reference work entry
            abstract = null;
        } else {
            continue;
        }
        let currentPn = url.pathname.split("/");

        const info = {
            abstract,
            alternateUrls: [
                `https://doi.org/${currentPn[currentPn.length - 2]}/${currentPn[currentPn.length - 1]}`
            ],
        };

        record = { ...record, ...info };
        console.log(record);
        await saveRecord(record, db, scrape);
    }
    recordPage.close();

    await nextPage(page);
}

async function nextPage(page) {
    await page.waitForSelector(".pagination", { timeout: 0 });

    const nextLink = await page.evaluate(async () => {
        const resNode = document.querySelector(".pagination");
        const nextBtn = resNode.querySelector(".next");
        if (nextBtn) {
            return nextBtn.getAttribute("href");
        }
        return null;
    });

    if (nextLink) {
        await page.goto("https://link.springer.com" + nextLink, {
            waitUntil: 'domcontentloaded',
            timeout: 0,
        });
        await processPage(page);
    }
}