const puppeteer = require("puppeteer-extra");
const chalk = require("chalk");
const db = require("../models");
const { saveRecord } = require("../helpers");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

const error = chalk.bold.red;
const success = chalk.keyword("green");

puppeteer.use(StealthPlugin());

let scrape = null;
let browser = null;

(async () => {
    try {
        const urls = [
            `https://www.sciencedirect.com/search/advanced?qs=%28%22project-based%20learning%22%20%20OR%20%20%22project%20based%20learning%22%20%20OR%20%20pbl%20%20OR%20%20%22problem-based%20learning%22%20%20OR%20%20%22problem%20based%20learning%22%29%20%20AND%20%20%28%22group%20work%22%20%20OR%20%20%22team%20work%22%20%20OR%20%20teamwork%29%20%20AND%20%28%22computing%22%20%20OR%20%20%22computer%20science%22%20%20OR%20%20%22software%20engineering%22%29&date=2010-2020&articleTypes=FLA%2CABS%2CCRP%2CDIS%2CPGL%2CRPL%2CSCO`,
            `https://www.sciencedirect.com/search/advanced?qs=%28capstone%20%20OR%20%20%22student%20project%22%20%20%20OR%20%20%22team%20project%22%20%20OR%20%20%22group%20project%22%29%20%20AND%20%20%28%22group%20work%22%20%20OR%20%20%22team%20work%22%20%20OR%20%20teamwork%29%20%20AND%20%28%22computing%22%20%20OR%20%20%22computer%20science%22%20%20OR%20%20%22software%20engineering%22%29&date=2010-2020&articleTypes=FLA%2CABS%2CCRP%2CDIS%2CPGL%2CRPL%2CSCO`,
            `https://www.sciencedirect.com/search/advanced?qs=%28%22student%20projects%22%20%20OR%20%20%22team%20projects%22%20%20OR%20%20%22group%20projects%22%29%20%20AND%20%20%28%22group%20work%22%20%20OR%20%20%22team%20work%22%20%20OR%20%20teamwork%29%20%20AND%20%28%22computing%22%20%20OR%20%20%22computer%20science%22%20%20OR%20%20%22software%20engineering%22%29&date=2010-2020&articleTypes=FLA%2CABS%2CCRP%2CDIS%2CPGL%2CRPL%2CSCO`
        ];

        browser = await puppeteer.launch({ headless: false });
        let page = await browser.newPage();

        for (const url of urls) {
            scrape = await db.Import.create({
                database: "sciencedirect",
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
        }
        
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
    await page.waitForSelector(".ResultItem", { timeout: 0 });
    await page.waitForSelector("#srp-results-list", { timeout: 0 });

    let res = await page.evaluate(() => {
        const pageNodes = document.querySelectorAll(".ResultItem");
        const pageResults = [];
        for (let i = 0; i < pageNodes.length; i++) {
            const node = pageNodes[i];
            const titleNode = node.querySelector("h2");
            const urlNode = titleNode.querySelector("a");
            const url = urlNode !== null ? new URL("https://www.sciencedirect.com" + urlNode.getAttribute("href")) : null;
            const authorNode = node.querySelector("ol.Authors");
            const detailNode = node.querySelector(".SubType");
            const author = (authorNode !== null ? authorNode.innerText.trim() : "")
                + " | " + (detailNode !== null ? detailNode.innerText.trim() : "");

            pageResults.push({
                title: titleNode.innerText,
                url: url !== null ? url.href : null,
                author: author,
                databases: ["sciencedirect"]
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

        try {
            await recordPage.waitForSelector("#abstracts", {
                timeout: 5000,
            });
        } catch (err) { }


        const info = await recordPage.evaluate(async () => {
            const abstractNode = document.querySelector("#abstracts");
            const doiNode = document.querySelector("#doi-link");
            await new Promise(function (resolve) { setTimeout(resolve, 200) });
            let pdfLink = document.querySelector("#pdfLink");
            if (pdfLink !== null && ["Download full text in PDF", "Download PDF"].includes(pdfLink.querySelector(".button-text").innerText.trim())) {
                pdfLink.click();
                await new Promise(function (resolve) { setTimeout(resolve, 2000) }); // wait 2000 ms
                const popover = document.querySelector("#popover-content-download-pdf-popover");
                pdfLink = popover ? popover.querySelector(".link-button-primary") : null;
            }
            let abstract = '';
            if (abstractNode) {
                for (let n of abstractNode.querySelectorAll(".abstract")) {
                    for (let nn of n.querySelectorAll("div")) {
                        abstract += nn.innerText + "\n\n";
                    }
                }
            }

            return {
                abstract,
                alternateUrls: [
                    ...(doiNode !== null ? [doiNode.querySelector("a").getAttribute("href")] : []),
                    ...(pdfLink !== null ? [`https://www.sciencedirect.com${pdfLink.getAttribute("href")}`] : []),
                ],
            };
        });

        record = { ...record, ...info };
        console.log(record);
        await saveRecord(record, db, scrape);
    }
    recordPage.close();

    await nextPage(page);
}

async function nextPage(page) {
    await page.waitForSelector(".Pagination", { timeout: 0 });

    const nextLink = await page.evaluate(async () => {
        const resNode = document.querySelector(".Pagination");
        const nextBtn = resNode.querySelector(".next-link");
        if (nextBtn) {
            return nextBtn.querySelector("a").getAttribute("href");
        }
        return null;
    });

    if (nextLink) {
        await page.goto("https://www.sciencedirect.com" + nextLink, {
            waitUntil: 'domcontentloaded',
            timeout: 0,
        });
        await processPage(page);
    }
}