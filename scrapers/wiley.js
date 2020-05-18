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
        const url = `https://onlinelibrary.wiley.com/action/doSearch?AfterMonth=1&AfterYear=2010&BeforeMonth=12&BeforeYear=2020&ConceptID=48&Ppub=&PubType=journal&field1=AllField&field2=AllField&field3=AllField&pageSize=100&text1=%28%22project-based+learning%22++OR++%22project+based+learning%22++OR++pbl+OR++capstone++OR++%22student+project%22++OR++%22student+projects%22++OR++%22team+project%22++OR++%22team+projects%22++OR++%22group+project%22++OR++%22group+projects%22++OR++%22problem-based+learning%22++OR++%22problem+based+learning%22%29++AND++%28%22group+work%22++OR++%22team+work%22++OR++teamwork%29++AND+%28%22computing%22++OR++%22computer+science%22++OR++%22software+engineering%22%29&text2=&text3=&startPage=&target=default&content=articlesChapters`;

        browser = await puppeteer.launch({ headless: false });
        let page = await browser.newPage();


        scrape = await db.Import.create({
            database: "wiley",
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
    await page.waitForSelector(".search__item", { timeout: 0 });
    await page.waitForSelector(".items-results", { timeout: 0 });

    let res = await page.evaluate(() => {
        const resNode = document.querySelector(".items-results");
        const pageNodes = resNode.querySelectorAll(".search__item");
        const pageResults = [];
        for (let i = 0; i < pageNodes.length; i++) {
            const node = pageNodes[i];
            const titleNode = node.querySelector("h2");
            const urlNode = titleNode.querySelector("a");
            const url = urlNode !== null ? new URL("https://onlinelibrary.wiley.com" + urlNode.getAttribute("href")) : null;
            const authorNode = node.querySelector(".meta__authors");
            const detailNode = node.querySelector(".meta__details");
            const author = (authorNode !== null ? authorNode.innerText.trim() : "")
                + " | " + (detailNode !== null ? detailNode.innerText.trim() : "");

            pageResults.push({
                title: titleNode.innerText,
                url: url !== null ? url.href : null,
                author: author,
                databases: ["wiley"]
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
        } catch (err) {
            // do nothing
        }


        const info = await recordPage.evaluate(async () => {
            const abstractNode = document.querySelector(".article-section__content");
            const doiNode = document.querySelector("a.epub-doi");
            await new Promise(function (resolve) { setTimeout(resolve, 200) });
            let pdfLink = document.querySelector(".pdf-download");


            return {
                abstract: abstractNode ? abstractNode.innerText : null,
                alternateUrls: [
                    ...(doiNode !== null ? [doiNode.getAttribute("href")] : []),
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