const puppeteer = require("puppeteer-extra");
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
        const url = `https://ieeexplore.ieee.org/search/searchresult.jsp?newsearch=true&queryText=(%22project-based%20learning%22%20OR%20%22capstone%20project%22%20OR%20%22software%20project%22%20OR%20%22team%20projects%22%20OR%20%22group%20projects%22%20OR%20%22problem%20based%20learning%22)%20AND%20(%22group%20work%22%20OR%20%22team%20work%22)`;
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
                + " | " + (detailNode !== null ?detailNode.innerText.trim() : "");

            pageResults.push({
                title: titleNode.innerText,
                url: url !== null ? url.href : null,
                author: author,
                description: null,
                databases: ["ieeexplore"]
            });
        }
        return pageResults;
    });

    console.log(res);

    res.forEach(async (record) => {
        const recordInstance = await db.Record.findOne({
            where: {
                url: record.url
            }
        });
        if (recordInstance &&
            recordInstance.databases &&
            !recordInstance.databases.includes(record.databases[0])
        ) {
            recordInstance.set('databases', [...recordInstance.databases, ...record.databases]);
            recordInstance.save()
        } else if (!recordInstance) {
            db.Record.create({ ...record });
        }
    });

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