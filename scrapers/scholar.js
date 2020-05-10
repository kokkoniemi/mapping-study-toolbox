const puppeteer = require("puppeteer");
const chalk = require("chalk");
const db = require("../models");
const { saveRecord } = require("../helpers");
// const StealthPlugin = require("puppeteer-extra-plugin-stealth");

const error = chalk.bold.red;
const success = chalk.keyword("green");

// puppeteer.use(StealthPlugin());
let scrape = null;

(async () => {
    let browser = null;
    try {
        const urls = [
            `https://scholar.google.fi/scholar?as_vis=1&q=(%22software+project%22+OR+%22team+project%22+OR+%22group+project%22)+AND+(%22group+work%22+OR+%22team+work%22+OR+teamwork)+AND+(%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22)&hl=fi&as_sdt=1,5&as_ylo=2010&as_yhi=2010`,
            `https://scholar.google.fi/scholar?as_vis=1&q=(%22software+project%22+OR+%22team+project%22+OR+%22group+project%22)+AND+(%22group+work%22+OR+%22team+work%22+OR+teamwork)+AND+(%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22)&hl=fi&as_sdt=1,5&as_ylo=2011&as_yhi=2011`,
            `https://scholar.google.fi/scholar?as_vis=1&q=(%22software+project%22+OR+%22team+project%22+OR+%22group+project%22)+AND+(%22group+work%22+OR+%22team+work%22+OR+teamwork)+AND+(%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22)&hl=fi&as_sdt=1,5&as_ylo=2012&as_yhi=2012`,
            `https://scholar.google.fi/scholar?as_vis=1&q=(%22software+project%22+OR+%22team+project%22+OR+%22group+project%22)+AND+(%22group+work%22+OR+%22team+work%22+OR+teamwork)+AND+(%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22)&hl=fi&as_sdt=1,5&as_ylo=2013&as_yhi=2013`,
            `https://scholar.google.fi/scholar?as_vis=1&q=(%22software+project%22+OR+%22team+project%22+OR+%22group+project%22)+AND+(%22group+work%22+OR+%22team+work%22+OR+teamwork)+AND+(%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22)&hl=fi&as_sdt=1,5&as_ylo=2014&as_yhi=2014`,
            `https://scholar.google.fi/scholar?as_vis=1&q=(%22software+project%22+OR+%22team+project%22+OR+%22group+project%22)+AND+(%22group+work%22+OR+%22team+work%22+OR+teamwork)+AND+(%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22)&hl=fi&as_sdt=1,5&as_ylo=2015&as_yhi=2015`,
            `https://scholar.google.fi/scholar?as_vis=1&q=(%22software+project%22+OR+%22team+project%22+OR+%22group+project%22)+AND+(%22group+work%22+OR+%22team+work%22+OR+teamwork)+AND+(%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22)&hl=fi&as_sdt=1,5&as_ylo=2016&as_yhi=2016`,
            `https://scholar.google.fi/scholar?as_vis=1&q=(%22software+project%22+OR+%22team+project%22+OR+%22group+project%22)+AND+(%22group+work%22+OR+%22team+work%22+OR+teamwork)+AND+(%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22)&hl=fi&as_sdt=1,5&as_ylo=2017&as_yhi=2017`,
            `https://scholar.google.fi/scholar?as_vis=1&q=(%22software+project%22+OR+%22team+project%22+OR+%22group+project%22)+AND+(%22group+work%22+OR+%22team+work%22+OR+teamwork)+AND+(%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22)&hl=fi&as_sdt=1,5&as_ylo=2018&as_yhi=2018`,
            `https://scholar.google.fi/scholar?as_vis=1&q=(%22software+project%22+OR+%22team+project%22+OR+%22group+project%22)+AND+(%22group+work%22+OR+%22team+work%22+OR+teamwork)+AND+(%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22)&hl=fi&as_sdt=1,5&as_ylo=2019&as_yhi=2019`,
            `https://scholar.google.fi/scholar?as_vis=1&q=(%22software+project%22+OR+%22team+project%22+OR+%22group+project%22)+AND+(%22group+work%22+OR+%22team+work%22+OR+teamwork)+AND+(%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22)&hl=fi&as_sdt=1,5&as_ylo=2020&as_yhi=2020`
        ];
        const urls2 = [
            `https://scholar.google.fi/scholar?q=%28%22software+projects%22+OR+%22team+projects%22+OR+%22group+projects%22%29+AND+%28%22group+work%22+OR+%22team+work%22+OR+teamwork%29+AND+%28%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22%29&hl=fi&as_sdt=1%2C5&as_vis=1&as_ylo=2010&as_yhi=2010`,
            `https://scholar.google.fi/scholar?q=%28%22software+projects%22+OR+%22team+projects%22+OR+%22group+projects%22%29+AND+%28%22group+work%22+OR+%22team+work%22+OR+teamwork%29+AND+%28%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22%29&hl=fi&as_sdt=1%2C5&as_vis=1&as_ylo=2011&as_yhi=2011`,
            `https://scholar.google.fi/scholar?q=%28%22software+projects%22+OR+%22team+projects%22+OR+%22group+projects%22%29+AND+%28%22group+work%22+OR+%22team+work%22+OR+teamwork%29+AND+%28%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22%29&hl=fi&as_sdt=1%2C5&as_vis=1&as_ylo=2012&as_yhi=2012`,
            `https://scholar.google.fi/scholar?q=%28%22software+projects%22+OR+%22team+projects%22+OR+%22group+projects%22%29+AND+%28%22group+work%22+OR+%22team+work%22+OR+teamwork%29+AND+%28%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22%29&hl=fi&as_sdt=1%2C5&as_vis=1&as_ylo=2013&as_yhi=2013`,
            `https://scholar.google.fi/scholar?q=%28%22software+projects%22+OR+%22team+projects%22+OR+%22group+projects%22%29+AND+%28%22group+work%22+OR+%22team+work%22+OR+teamwork%29+AND+%28%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22%29&hl=fi&as_sdt=1%2C5&as_vis=1&as_ylo=2014&as_yhi=2014`,
            `https://scholar.google.fi/scholar?q=%28%22software+projects%22+OR+%22team+projects%22+OR+%22group+projects%22%29+AND+%28%22group+work%22+OR+%22team+work%22+OR+teamwork%29+AND+%28%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22%29&hl=fi&as_sdt=1%2C5&as_vis=1&as_ylo=2015&as_yhi=2015`,
            `https://scholar.google.fi/scholar?q=%28%22software+projects%22+OR+%22team+projects%22+OR+%22group+projects%22%29+AND+%28%22group+work%22+OR+%22team+work%22+OR+teamwork%29+AND+%28%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22%29&hl=fi&as_sdt=1%2C5&as_vis=1&as_ylo=2016&as_yhi=2016`,
            `https://scholar.google.fi/scholar?q=%28%22software+projects%22+OR+%22team+projects%22+OR+%22group+projects%22%29+AND+%28%22group+work%22+OR+%22team+work%22+OR+teamwork%29+AND+%28%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22%29&hl=fi&as_sdt=1%2C5&as_vis=1&as_ylo=2017&as_yhi=2017`,
            `https://scholar.google.fi/scholar?q=%28%22software+projects%22+OR+%22team+projects%22+OR+%22group+projects%22%29+AND+%28%22group+work%22+OR+%22team+work%22+OR+teamwork%29+AND+%28%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22%29&hl=fi&as_sdt=1%2C5&as_vis=1&as_ylo=2018&as_yhi=2018`,
            `https://scholar.google.fi/scholar?q=%28%22software+projects%22+OR+%22team+projects%22+OR+%22group+projects%22%29+AND+%28%22group+work%22+OR+%22team+work%22+OR+teamwork%29+AND+%28%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22%29&hl=fi&as_sdt=1%2C5&as_vis=1&as_ylo=2019&as_yhi=2019`,
            `https://scholar.google.fi/scholar?q=%28%22software+projects%22+OR+%22team+projects%22+OR+%22group+projects%22%29+AND+%28%22group+work%22+OR+%22team+work%22+OR+teamwork%29+AND+%28%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22%29&hl=fi&as_sdt=1%2C5&as_vis=1&as_ylo=2020&as_yhi=2020`
        ];
        const urls3 = [
            `https://scholar.google.fi/scholar?q=%28capstone+OR+%22project-based+learning%22+OR+%22problem+based+learning%22%29+AND+%28%22group+work%22+OR+%22team+work%22+OR+teamwork%29+AND+%28%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22%29&hl=fi&as_sdt=1%2C5&as_vis=1&as_ylo=2010&as_yhi=2010`,
            `https://scholar.google.fi/scholar?q=%28capstone+OR+%22project-based+learning%22+OR+%22problem+based+learning%22%29+AND+%28%22group+work%22+OR+%22team+work%22+OR+teamwork%29+AND+%28%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22%29&hl=fi&as_sdt=1%2C5&as_vis=1&as_ylo=2011&as_yhi=2011`,
            `https://scholar.google.fi/scholar?q=%28capstone+OR+%22project-based+learning%22+OR+%22problem+based+learning%22%29+AND+%28%22group+work%22+OR+%22team+work%22+OR+teamwork%29+AND+%28%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22%29&hl=fi&as_sdt=1%2C5&as_vis=1&as_ylo=2012&as_yhi=2012`,
            `https://scholar.google.fi/scholar?q=%28capstone+OR+%22project-based+learning%22+OR+%22problem+based+learning%22%29+AND+%28%22group+work%22+OR+%22team+work%22+OR+teamwork%29+AND+%28%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22%29&hl=fi&as_sdt=1%2C5&as_vis=1&as_ylo=2013&as_yhi=2013`,
            `https://scholar.google.fi/scholar?q=%28capstone+OR+%22project-based+learning%22+OR+%22problem+based+learning%22%29+AND+%28%22group+work%22+OR+%22team+work%22+OR+teamwork%29+AND+%28%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22%29&hl=fi&as_sdt=1%2C5&as_vis=1&as_ylo=2014&as_yhi=2014`,
            `https://scholar.google.fi/scholar?q=%28capstone+OR+%22project-based+learning%22+OR+%22problem+based+learning%22%29+AND+%28%22group+work%22+OR+%22team+work%22+OR+teamwork%29+AND+%28%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22%29&hl=fi&as_sdt=1%2C5&as_vis=1&as_ylo=2015&as_yhi=2015`,
            `https://scholar.google.fi/scholar?q=%28capstone+OR+%22project-based+learning%22+OR+%22problem+based+learning%22%29+AND+%28%22group+work%22+OR+%22team+work%22+OR+teamwork%29+AND+%28%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22%29&hl=fi&as_sdt=1%2C5&as_vis=1&as_ylo=2016&as_yhi=2016`,
            `https://scholar.google.fi/scholar?q=%28capstone+OR+%22project-based+learning%22+OR+%22problem+based+learning%22%29+AND+%28%22group+work%22+OR+%22team+work%22+OR+teamwork%29+AND+%28%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22%29&hl=fi&as_sdt=1%2C5&as_vis=1&as_ylo=2017&as_yhi=2017`,
            `https://scholar.google.fi/scholar?q=%28capstone+OR+%22project-based+learning%22+OR+%22problem+based+learning%22%29+AND+%28%22group+work%22+OR+%22team+work%22+OR+teamwork%29+AND+%28%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22%29&hl=fi&as_sdt=1%2C5&as_vis=1&as_ylo=2018&as_yhi=2018`,
            `https://scholar.google.fi/scholar?q=%28capstone+OR+%22project-based+learning%22+OR+%22problem+based+learning%22%29+AND+%28%22group+work%22+OR+%22team+work%22+OR+teamwork%29+AND+%28%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22%29&hl=fi&as_sdt=1%2C5&as_vis=1&as_ylo=2019&as_yhi=2019`,
            `https://scholar.google.fi/scholar?q=%28capstone+OR+%22project-based+learning%22+OR+%22problem+based+learning%22%29+AND+%28%22group+work%22+OR+%22team+work%22+OR+teamwork%29+AND+%28%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22%29&hl=fi&as_sdt=1%2C5&as_vis=1&as_ylo=2020&as_yhi=2020`
        ];
        scrape = await db.Import.create({
            database: "scholar",
            query: `https://scholar.google.fi/scholar?q=%28capstone+OR+%22project-based+learning%22+OR+%22problem+based+learning%22%29+AND+%28%22group+work%22+OR+%22team+work%22+OR+teamwork%29+AND+%28%22Computer+science+education%22+OR+%22Computing+education%22+OR+%22Software+engineering+education%22%29&hl=fi&as_sdt=1%2C5&as_vis=1&as_ylo=2010&as_yhi=2020`,
            total: 0,
            dublicates: 0,
            namesakes: []
        });
        browser = await puppeteer.launch({ headless: false, product: 'firefox', executablePath: "/Applications/Firefox Nightly.app/Contents/MacOS/firefox" });
        let page = await browser.newPage();
        for (let url of urls3) {
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
    const waitTime = 8500 + Math.floor(Math.random() * Math.floor(8000)); // To look like a human behaviour
    await page.waitFor(waitTime);
    await page.waitForSelector("#gs_res_ccl_mid", { timeout: 0 });
    await page.waitForSelector(".gs_r", { timeout: 0 });
    await page.waitForSelector("#gs_res_ccl_bot", { timeout: 0 });

    let res = await page.evaluate(() => {
        const resNode = document.querySelector("#gs_res_ccl_mid");
        const pageNodes = resNode.querySelectorAll(".gs_r");
        const pageResults = [];
        for (let i = 0; i < pageNodes.length; i++) {
            const node = pageNodes[i];
            const titleNode = node.querySelector("h3.gs_rt");
            if (titleNode.querySelector(".gs_ctu") !== null
                || node.querySelector("div.gs_a") === null
                || node.querySelector("div.gs_rs") === null
                || titleNode === null
            ) {
                continue;
            }
            const url = new URL(titleNode.querySelector("a").getAttribute("href"));
            const author = node.querySelector("div.gs_a").innerText.trim();
            const description = node.querySelector("div.gs_rs").innerText.trim();

            pageResults.push({
                title: titleNode.querySelector("a").innerText,
                url: url.href,
                alternateUrls: [],
                author: author,
                description: description,
                databases: ["scholar"]
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
    await page.waitForSelector("#gs_res_ccl_bot", { timeout: 0 });

    const nextLink = await page.evaluate(async () => {
        const resNode = document.querySelector("#gs_res_ccl_bot");
        const nextBtn = resNode.querySelector(".gs_ico_nav_next");
        if (nextBtn) {
            return nextBtn.parentNode.getAttribute("href");
        }
        return null;
    });
    console.log(nextLink);
    if (nextLink) {
        await page.goto("https://scholar.google.fi" + nextLink, {
            waitUntil: 'domcontentloaded',
            timeout: 0,
        });
        await processPage(page);
    }
}