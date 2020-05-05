const puppeteer = require("puppeteer-extra");
const chalk = require("chalk");
const db = require("../models");
// const StealthPlugin = require("puppeteer-extra-plugin-stealth");

const error = chalk.bold.red;
const success = chalk.keyword("green");

// puppeteer.use(StealthPlugin());

const scrapePublication = async (record, url, page) => {
    if (await record.getPublication() === null && !!record.url) {
        const pub = await async function () {
            if (url.host === "dl.acm.org") {
                return await scrapeAcmPub(page, url);
            } else if (url.host === "ieeexplore.ieee.org") {
                return await scrapeIEEEPub(page, url);
            } else if (url.host === "www.tandfonline.com") {
                return await scrapeTandfonlinePub(page, url);
            } else if (url.host === "www.sciencedirect.com") {
                return await scrapeScienceDirectPub(page, url);
            } else if (url.host === "link.springer.com") {
                return await scrapeSpringerPub(page, url);
            } else {
                return null;
            }
        }();

        if (pub) {
            console.log(pub);
            let pubInstance = await db.Publication.findOne({
                where: {
                    name: pub.name,
                }
            });
            if (!pubInstance) {
                record.createPublication({
                    name: pub.name,
                    alternateNames: [...(pub.alternateNames ? pub.alternateNames : [])],
                    jufoLevel: null,
                    database: pub.database
                });
            } else {
                record.setPublication(pubInstance);
            }
        }
    }
}

const scrapeAbstract = async (record, url, page) => {
    if (record.abstract === null && !!record.url) {
        const abstract = await async function () {
            switch (url.host) {
                case "ieeexplore.ieee.org":
                    return await scrapeIEEE(page, url);
                case "www.sciencedirect.com":
                    return await scrapeScienceDirect(page, url);
                case "link.springer.com":
                    return await scrapeSpringer(page, url);
                case "dl.acm.org":
                    return await scrapeAcm(page, url);
                case "idp.springer.com":
                    return await scrapeSpringer(page, url);
                case "www.tandfonline.com":
                    return await scrapeTandfonline(page, url);
                case "onlinelibrary.wiley.com":
                    return await scrapeWiley(page, url);
                case "arxiv.org":
                    return await scrapeArxiv(page, url);
                default:
                    return null;
            }
        }();
        record.set("abstract", abstract);
        record.save();
    }
}

/**
 * "main"-method
 */
(async () => {
    let browser = null;
    try {
        browser = await puppeteer.launch({ headless: false });
        let page = await browser.newPage();

        let rowCount = await db.Record.count({});
        for (let i = 0; i < rowCount; i++) {
            const record = await db.Record.findOne({
                offset: i,
            });
            let url = new URL(record.url);

            if (url.host === "doi.org") {
                page.goto(url.href, {
                    waitUntil: "domcontentloaded",
                    timeout: 0,
                });
                const newUrl = page.evaluate(() => {
                    return document.location.href;
                });
                url = new URL(newUrl);
            }
            // scrapeAbstract(record, url, page);
            await scrapePublication(record, url, page);
        }
        await browser.close();
        console.log(success("Browser Closed"));
    } catch (err) {
        console.log(error(err));
        await browser.close();
        console.log(error("Browser Closed"));
    }
})();

async function scrapeIEEE(page, url) {
    await page.goto(url.href, {
        waitUntil: "domcontentloaded",
        timeout: 0,
    });
    const waitTime = 500 + Math.floor(Math.random() * Math.floor(2000)); // To look like a human behaviour
    await page.waitFor(waitTime);
    await page.waitForSelector(".abstract-text", { timeout: 0 });
    const res = await page.evaluate(() => {
        const resNode = document.querySelector(".abstract-text");
        return resNode.innerText;
    });
    return res;
}

async function scrapeScienceDirect(page, url) {
    await page.goto(url.href, {
        waitUntil: "domcontentloaded",
        timeout: 0,
    });
    const waitTime = 500 + Math.floor(Math.random() * Math.floor(2000)); // To look like a human behaviour
    await page.waitFor(waitTime);
    try {
        await page.waitForSelector("#abstracts", { timeout: 5000 });
        const res = await page.evaluate(() => {
            const resNode = document.querySelector("#abstracts");
            return resNode.innerText;
        });
        return res;
    } catch (err) {
        return null;
    }

}

async function scrapeSpringer(page, url) {
    await page.goto(url.href, {
        waitUntil: "domcontentloaded",
        timeout: 0,
    });
    const waitTime = 500 + Math.floor(Math.random() * Math.floor(2000)); // To look like a human behaviour
    await page.waitFor(waitTime);
    const currentUrl = new URL(page.url()); // might have changed


    let res = null;
    if (currentUrl.pathname.substring(0, 8) === "/chapter" || currentUrl.pathname.substring(0, 9) === "/protocol") {
        // journal
        try {
            await page.waitForSelector(".Abstract", { timeout: 5000 });
            res = await page.evaluate(() => {
                const resNode = document.querySelector(".Abstract");
                return resNode.innerText;
            });
        } catch (err) {
            res = null;
        }
    } else if (currentUrl.pathname.substring(0, 8) === "/article") {
        // html article
        try {
            await page.waitForSelector(".Abs1-section", { timeout: 5000 });
            res = await page.evaluate(() => {
                const resNode = document.querySelector(".Abs1-section");
                return resNode.innerText;
            });
        } catch (error) {
            await page.waitForSelector("#Abs1-section", { timeout: 5000 });
            res = await page.evaluate(() => {
                const resNode = document.querySelector("#Abs1-section");
                return resNode.innerText;
            });
        }

    } else if (currentUrl.pathname.substring(0, 8) === "/content") {
        // these are most probably pdf-files. Too complex to scrape
        return null;
    }
    return res;
}

async function scrapeAcm(page, url) {
    if (url.pathname.substring(0, 8) === "/doi/pdf") {
        return null;
    }
    await page.goto(url.href, {
        waitUntil: "domcontentloaded",
        timeout: 0,
    });
    const waitTime = 500 + Math.floor(Math.random() * Math.floor(2000)); // To look like a human behaviour
    await page.waitFor(waitTime);
    try {
        await page.waitForSelector(".abstractSection", { timeout: 5000 });
        const res = await page.evaluate(() => {
            const resNode = document.querySelector(".abstractSection");
            return resNode.innerText;
        });
        return res;
    } catch (err) {
        return null;
    }
}

async function scrapeTandfonline(page, url) {
    await page.goto(url.href, {
        waitUntil: "domcontentloaded",
        timeout: 0,
    });
    const waitTime = 500 + Math.floor(Math.random() * Math.floor(2000)); // To look like a human behaviour
    await page.waitFor(waitTime);
    try {
        await page.waitForSelector(".abstractSection", { timeout: 5000 });
        const res = await page.evaluate(() => {
            const resNode = document.querySelector(".abstractSection");
            return resNode.innerText;
        });
        return res;
    } catch (error) {
        return null;
    }
}

async function scrapeWiley(page, url) {
    await page.goto(url.href, {
        waitUntil: "domcontentloaded",
        timeout: 0,
    });
    const waitTime = 500 + Math.floor(Math.random() * Math.floor(2000)); // To look like a human behaviour
    await page.waitFor(waitTime);
    let res = null;
    try {
        await page.waitForSelector(".abstract-group", { timeout: 5000 });
        res = await page.evaluate(() => {
            const resNode = document.querySelector(".abstract-group");
            return resNode.innerText;
        });
    } catch (err) {
        await page.waitForSelector(".article__body", { timeout: 5000 });
        res = await page.evaluate(() => {
            const resNode = document.querySelector(".article__body");
            return resNode.innerText;
        });
    }

    return res;
}

async function scrapeArxiv(page, url) {
    if (url.pathname.substring(0, 4) !== "/abs") {
        return null;
    }
    await page.goto(url.href, {
        waitUntil: "domcontentloaded",
        timeout: 0,
    });
    const waitTime = 500 + Math.floor(Math.random() * Math.floor(2000)); // To look like a human behaviour
    await page.waitFor(waitTime);
    await page.waitForSelector(".abstract", { timeout: 0 });
    const res = await page.evaluate(() => {
        const resNode = document.querySelector(".abstract");
        return resNode.innerText;
    });
    return res;
}

async function scrapeAcmPub(page, url) {
    const waitTime = 500 + Math.floor(Math.random() * Math.floor(2000)); // To look like a human behaviour
    await page.waitFor(waitTime);
    await page.goto(url.href, {
        waitUntil: "domcontentloaded",
        timeout: 0,
    });
    try {
        await page.waitForSelector(".issue-item__detail", { timeout: 5000 });
        const link = await page.evaluate(() => {
            const resNode = document.querySelector(".issue-item__detail");
            const linkNode = resNode.querySelector("a");
            return linkNode ? linkNode.getAttribute("href") : null;
        });
        if (link) {
            await page.goto("https://dl.acm.org" + link, {
                waitUntil: "domcontentloaded",
                timeout: 10000
            });
            await page.waitForSelector(".banner", { timeout: 5000 });
            const pub = await page.evaluate(() => {
                const resNode = document.querySelector(".banner");
                let titleNode = resNode.querySelector("h1");
                if (!titleNode) {
                    titleNode = resNode.querySelector(".h1-styling");
                }
                const alternateName = titleNode.nextElementSibling;
                return {
                    name: titleNode ? titleNode.innerText : null,
                    alternateNames: [
                        ...(alternateName ? [alternateName.innerText] : [])
                    ],
                    database: "acm"
                }
            });
            return pub;
        }
        return null;
    } catch (err) {
        return null;
    }
}

async function scrapeIEEEPub(page, url) {
    const waitTime = 500 + Math.floor(Math.random() * Math.floor(2000)); // To look like a human behaviour
    await page.waitFor(waitTime);
    await page.goto(url.href, {
        waitUntil: "domcontentloaded",
        timeout: 0,
    });
    try {
        await page.waitForSelector(".stats-document-abstract-publishedIn", { timeout: 5000 });
        const link = await page.evaluate(() => {
            const resNode = document.querySelector(".stats-document-abstract-publishedIn");
            const linkNode = resNode.querySelector("a");
            return linkNode ? linkNode.getAttribute("href") : null;
        });
        if (link) {
            await page.goto("https://ieeexplore.ieee.org" + link, {
                waitUntil: "domcontentloaded",
                timeout: 10000
            });
            await page.waitForSelector(".title-container", { timeout: 5000 });
            const pub = await page.evaluate(() => {
                const resNode = document.querySelector(".title-container");
                return {
                    name: resNode ? resNode.innerText : null,
                    alternateNames: [],
                    database: "ieeexplore"
                }
            });
            return pub;
        }
        return null;
    } catch (err) {
        return null;
    }
}

async function scrapeTandfonlinePub(page, url) {
    const waitTime = 500 + Math.floor(Math.random() * Math.floor(2000)); // To look like a human behaviour
    await page.waitFor(waitTime);
    await page.goto(url.href, {
        waitUntil: "domcontentloaded",
        timeout: 0,
    });
    try {
        await page.waitForSelector(".issueSerialNavigation", { timeout: 5000 });
        const title = await page.evaluate(() => {
            const resNode = document.querySelector(".issueSerialNavigation");
            const titleNode = resNode.querySelector(".title-container");
            if (titleNode) {
                return titleNode.querySelector("h1").innerText;
            }
            return null;
        });
        if (title) {
            return {
                name: title,
                alternateNames: [],
                database: "tandfonline"
            }
        }
        return null;
    } catch (err) {
        return null;
    }
}

async function scrapeScienceDirectPub(page, url) {
    const waitTime = 500 + Math.floor(Math.random() * Math.floor(2000)); // To look like a human behaviour
    await page.waitFor(waitTime);
    await page.goto(url.href, {
        waitUntil: "domcontentloaded",
        timeout: 0,
    });
    try {
        await page.waitForSelector("#publication-title", { timeout: 5000 });
        const title = await page.evaluate(() => {
            const titleNode = document.querySelector("#publication-title");
            if (titleNode) {
                return titleNode.innerText;
            }
            return null;
        });
        if (title) {
            return {
                name: title,
                alternateNames: [],
                database: "sciencedirect"
            }
        }
        return null;
    } catch (err) {
        return null;
    }
}

async function scrapeSpringerPub(page, url) {
    const waitTime = 500 + Math.floor(Math.random() * Math.floor(2000)); // To look like a human behaviour
    await page.waitFor(waitTime);
    await page.goto(url.href, {
        waitUntil: "domcontentloaded",
        timeout: 0,
    });
    try {
        await page.waitForSelector("#enumeration", { timeout: 5000 });
        const title = await page.evaluate(() => {
            const resNode = document.querySelector("#enumeration");
            const titleNode = resNode ? resNode.querySelector("[data-test='ConfSeriesName']") : null;
            if (titleNode) {
                return titleNode.innerText;
            }
            return null;
        });
        if (title) {
            return {
                name: title,
                alternateNames: [],
                database: "springer"
            }
        }
        return null;
    } catch (err) {
        return null;
    }
}