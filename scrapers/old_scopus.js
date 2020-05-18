const puppeteer = require("puppeteer-extra");
const chalk = require("chalk");
const db = require("../models");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
// const qs = require('querystring');
const { saveRecord } = require("../helpers");

const error = chalk.bold.red;
const success = chalk.keyword("green");

puppeteer.use(StealthPlugin());
let scrape = null;


(async () => {
    const url = `https://www-scopus-com.ezproxy.jyu.fi/results/results.uri?sort=plf-f&src=s&sid=471bf6f3807c80b326c918db8602fa59&sot=a&sdt=a&sl=348&s=%28%22project-based+learning%22+OR+capstone+OR+%22software+project%22+OR+%22software+projects%22+OR+%22team+project%22+OR+%22team+projects%22+OR+%22group+project%22+OR+%22group+projects%22+OR+%22problem+based+learning%22%29+AND+%28%22group+work%22+OR+%22team+work%22+OR+teamwork%29+AND+%28%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22%29+AND+PUBYEAR+%3e+2009&origin=searchadvanced&editSaveSearch=&txGid=60cc778272cd8d05aeaa31d28db8bcb8`;
    scrape = await db.Import.create({
        database: "scopus",
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

        // Go to the first search result
        const waitTime = 2000 + Math.floor(Math.random() * Math.floor(2000));
        await page.waitFor(waitTime);
        await page.waitForSelector("#srchResultsList", { timeout: 0 });
        const link = await page.evaluate(() => {
            const resNode = document.querySelector('#srchResultsList');
            // const pageNode = resNode.querySelector(".searchArea");
            return resNode.querySelector("[data-type='docTitle']").querySelector("a").getAttribute("href");
        });
        await page.goto(link, {
            waitUntil: "domcontentloaded",
            timeout: 0,
        });
        await page.waitFor(waitTime);

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
    // Process the result
    const waitTime = 2000 + Math.floor(Math.random() * Math.floor(2000)); // To look like a human behaviour
    await page.waitFor(waitTime);
    await page.waitForSelector("#profileleftinside", { timeout: 0 });

    let record = await page.evaluate(() => {
        const resNode = document.querySelector('#profileleftinside');
        const titleNode = resNode.querySelector('h2');
        const authorNode = resNode.querySelector('#authorlist');
        const journalNode = resNode.querySelector('#articleTitleInfo');
        const abstractNode = resNode.querySelector('#abstractSection');
        const doiNode = resNode.querySelector('#recordDOI');

        let abstract = null;
        if (abstractNode) {
            for (const p of abstractNode.querySelectorAll("p")) {
                abstract += p.innerText + "\n\n";
            }
        }

        return {
            title: titleNode ? titleNode.innerText : null,
            author: authorNode ? authorNode.innerText + " | " + journalNode.innerText : null,
            abstract: abstract,
            url: doiNode ? `https://doi.org/${doiNode.innerText.trim()}` : document.location.href.substring(0,256),
            alternateUrls: [],
            databases: ["scopus"]
        };
    });
    
    await saveRecord(record, db, scrape);
    

    // Go to next page
    await nextPage(page);
}

async function nextPage(page) {
    await page.waitForSelector(".nextLink", { timeout: 0 });

    const nextLink = await page.evaluate(async () => {
        const resNode = document.querySelector(".nextLink");
        if (resNode) {
            const nextLink = resNode.querySelector("a").getAttribute("href");
            return nextLink;
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