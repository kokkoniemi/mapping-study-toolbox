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
        const url = `https://www.tandfonline.com/action/doSearch?field1=AllField&text1=%28%22project-based+learning%22+OR+%22capstone+project%22+OR+%22software+project%22+OR+%22team+projects%22+OR+%22group+projects%22+OR+%22problem+based+learning%22%29+AND+%28%22group+work%22+OR+%22team+work%22%29+AND+%28%22Computer+science+education%22+OR+%22Software+engineering+education%22%29&Ppub=&pageSize=10&subjectTitle=&startPage=0`;
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

            pageResults.push({
                title: urlNode.innerText,
                url: url !== null ? url.href : null,
                author: author,
                description: description,
                databases: ["tandfonline"]
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
        page.waitFor(200);
        await processPage(page);
    }
}