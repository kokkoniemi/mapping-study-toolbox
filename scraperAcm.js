const puppeteer = require("puppeteer-extra");
const chalk = require("chalk");
const db = require("./models");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

const error = chalk.bold.red;
const success = chalk.keyword("green");

puppeteer.use(StealthPlugin());

let scrape = null;
let dublicates = [];

(async () => {
    let browser = null;
    try {
        const url = `https://dl.acm.org/action/doSearch?AllField=%28%22project-based+learning%22+OR+%22capstone+project%22+OR+%22software+project%22+OR+%22team+projects%22+OR+%22group+projects%22+OR+%22problem+based+learning%22%29+AND+%28%22group+work%22+OR+%22team+work%22%29+AND+%28%22Computer+science+education%22+OR+%22Software+engineering+education%22%29+AND+student`;
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
        dublicates.forEach(d => {
            d.dublicates.forEach(dd => {
                console.log(d, dd.id, dd.title);
            });
        });
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
        // 1. Check if there is dublicates
        const recordInstances = await db.Record.getAllByUrls([record.url, ...record.alternateUrls]);

        if (recordInstances.length) {
            await scrape.set('dublicates', scrape.dublicates + 1);
            await scrape.save();
            dublicates.push({ record, dublicates: recordInstances.map(item => ({ title: item.title, id: item.id })) });
        }

        for (let j = 0; j < recordInstances.length; j++) {
            recordInstance = recordInstances[j];
            if (recordInstance.databases && !recordInstance.databases.includes(record.databases[0])) {
                await recordInstance.set('databases', [...recordInstance.databases, ...record.databases]);
                await recordInstance.save();
            }
        }

        if (!recordInstances.length) {
            // 2. Create a new record even if there is a namesake, since it might not be a dublicate
            const recordInstance = await db.Record.create({ ...record });

            // 3. If dublicates not found, check if there is namesakes, since those might also be dublicates
            const namesakes = await db.Record.findAll({
                where: {
                    title: recordInstance.title,
                    id: { [db.Sequelize.Op.ne]: recordInstance.id }
                }
            });
            await namesakes.forEach(namesake => {
                scrape.set('namesakes', [...scrape.namesakes, [namesake.id, recordInstance.id]]);
            });
        }
        // 4. log the total amount
        await scrape.set('total', scrape.total + 1);
        await scrape.save();
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
    console.log(nextLink);
    if (nextLink) {
        await page.goto(nextLink, {
            waitUntil: 'domcontentloaded',
            timeout: 0,
        });
        await processPage(page);
    }
}