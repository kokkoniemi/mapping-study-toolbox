const puppeteer = require("puppeteer-extra");
const chalk = require("chalk");
const db = require("../models");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const { saveRecord } = require("../helpers");

const error = chalk.bold.red;
const success = chalk.keyword("green");

puppeteer.use(StealthPlugin());
let scrape = null;

(async () => {
    const url = `https://www.tandfonline.com/action/doSearch?text1=%28%22project-based+learning%22+OR+%22project+based+learning%22+OR+pbl+OR+capstone+OR+%22student+project%22+OR+%22student+projects%22+OR+%22team+project%22+OR+%22team+projects%22+OR+%22group+project%22+OR+%22group+projects%22+OR+%22problem-based+learning%22+OR+%22problem+based+learning%22%29+AND+%28%22group+work%22+OR+%22team+work%22+OR+teamwork%29+AND+%28%22computing%22+OR+%22computer+science%22+OR+%22software+engineering%22%29&ConceptID=4261&ConceptID=4451&AfterYear=2010&BeforeYear=2020`;
    scrape = await db.Import.create({
        database: "tandfonline",
        query: url,
        total: 0,
        dublicates: 0,
        namesakes: []
    });

    let browser = null;
    try {
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
    await page.waitForSelector("#allTabsContainer", { timeout: 0 });

    let res = await page.evaluate(() => {
        const resNode = document.querySelector('#allTabsContainer');
        const pageNodes = resNode.querySelectorAll(".searchResultItem");
        const pageResults = [];
        for (let i = 0; i < pageNodes.length; i++) {
            const node = pageNodes[i];
            const titleNode = node.querySelector(".art_title");
            const urlNode = titleNode.querySelector("a");
            const url = urlNode !== null ? new URL("https://www.tandfonline.com" + urlNode.getAttribute("href")) : null;
            const authorNode = node.querySelector(".author");
            const detailNodes = node.querySelectorAll(".publication-meta");
            let description = '';
            for (let j = 0; j < detailNodes.length; j++) {
                description += detailNodes[j].innerText + "; ";
            }
            const author = (authorNode !== null ? authorNode.innerText.trim() : "");
            const pathname = url.pathname.split("/");
            pageResults.push({
                title: urlNode.innerText,
                url: url !== null ? url.href : null,
                author: author,
                description: description,
                alternateUrls: [
                    ...(pathname[pathname.length - 3] === "full" 
                    ? [`https://www.tandfonline.com/doi/abs/${pathname[pathname.length - 2]}/${pathname[pathname.length - 1]}`]
                    : [`https://www.tandfonline.com/doi/full/${pathname[pathname.length - 2]}/${pathname[pathname.length - 1]}`]),
                    `https://doi.org/${pathname[pathname.length - 2]}/${pathname[pathname.length - 1]}`
                ],
                databases: ["tandfonline"]
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
    await page.waitForSelector(".paginationLinkContainer", { timeout: 0 });

    const isNext = await page.evaluate(async () => {
        const resNode = document.querySelector(".paginationLinkContainer");
        const nextBtn = resNode.querySelector(".nextPage");
        if (nextBtn) {
            nextBtn.click();
            return true;
        }
        return false;
    });
    if (isNext) {
        await page.waitFor(10000); // might process same page twice if wait time is too short
        await processPage(page);
    }
}