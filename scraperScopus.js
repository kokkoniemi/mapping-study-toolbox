const puppeteer = require("puppeteer-extra");
const chalk = require("chalk");
const db = require("./models");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const qs = require('querystring');

const error = chalk.bold.red;
const success = chalk.keyword("green");

puppeteer.use(StealthPlugin());

(async () => {
    let browser = null;
    try {
        browser = await puppeteer.launch({ headless: false });
        let page = await browser.newPage();
        const url = `https://www-scopus-com.ezproxy.jyu.fi/results/results.uri?numberOfFields=0&src=s&clickedLink=&edit=&editSaveSearch=&origin=searchbasic&authorTab=&affiliationTab=&advancedTab=&scint=1&menu=search&tablin=&searchterm1=%28%22project-based+learning%22+OR+%22capstone+project%22+OR+%22software+project%22+OR+%22team+projects%22+OR+%22group+projects%22+OR+%22problem+based+learning%22%29+AND+%28%22group+work%22+OR+%22team+work%22%29+AND+%28%22Computer+science+education%22+OR+%22Software+engineering+education%22%29+AND+student&field1=ALL&dateType=Publication_Date_Type&yearFrom=Before+1960&yearTo=Present&loadDate=7&documenttype=All&accessTypes=All&resetFormLink=&st1=%28%22project-based+learning%22+OR+%22capstone+project%22+OR+%22software+project%22+OR+%22team+projects%22+OR+%22group+projects%22+OR+%22problem+based+learning%22%29+AND+%28%22group+work%22+OR+%22team+work%22%29+AND+%28%22Computer+science+education%22+OR+%22Software+engineering+education%22%29+AND+student&st2=&sot=b&sdt=b&sl=259&s=ALL%28%28%22project-based+learning%22+OR+%22capstone+project%22+OR+%22software+project%22+OR+%22team+projects%22+OR+%22group+projects%22+OR+%22problem+based+learning%22%29+AND+%28%22group+work%22+OR+%22team+work%22%29+AND+%28%22Computer+science+education%22+OR+%22Software+engineering+education%22%29+AND+student%29&sid=af976f2797ccb38594ced0ff3e16a8ef&searchId=af976f2797ccb38594ced0ff3e16a8ef&txGid=536d2b118b38b1090328a0ffafe914fd&sort=plf-f&originationType=b&rr=`;
        await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 0,
        });

        // const urlStr = 'https://www-scopus-com.ezproxy.jyu.fi/redirect/linking.uri?targetURL=https%3a%2f%2fdoi.org%2f10.1590%2f1807-7692bar2019180103&locationID=2&categoryID=4&eid=2-s2.0-85073293772&issn=18077692&linkType=ViewAtPublisher&year=2019&origin=resultslist&dig=18e3c8c6278bc56d3f472cbd69e98647&recordRank=20';
        // const url = new URL(urlStr);
        // console.log({ url: qs.parse(url.search.substring(1)) });
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
    await page.waitForSelector("#srchResultsList", { timeout: 0 });

    let res = await page.evaluate(() => {
        const resNode = document.querySelector('#srchResultsList');
        const pageNodes = resNode.querySelectorAll(".searchArea");
        const pageResults = [];
        for (let i = 0; i < pageNodes.length; i++) {
            const node = pageNodes[i];
            const nodeActions = node.nextElementSibling; // for url
            const childNodes = node.querySelectorAll("td");
            const [titleNode, authorNode, yearNode, sourceNode] = childNodes;
            const urlNode = nodeActions.querySelector("a.outwardTextLink");
            const url = new URL(urlNode.getAttribute("href"));

            pageResults.push({
                title: titleNode.innerText,
                url: url !== null ? url.search.substring(1) : null,
                author: authorNode.innerText,
                description: yearNode.innerText + " | " + sourceNode.innerText,
                databases: ["scopus"]
            });
        }
        return pageResults;
    });

    console.log(res);

    res.forEach(async (record) => {
        record.url = qs.parse(record.url).targetURL;
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
    await page.waitForSelector(".pagination", { timeout: 0 });

    const isNext = await page.evaluate(async () => {
        const resNode = document.querySelector(".pagination");
        const nextBtn = resNode.querySelector("[title='Next page']");
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