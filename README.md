# mapping-study-toolbox

## System requirements
```
node.js v.12 or above
npm
sqlite3
```

## Project setup
```
npm install
```

## Change search query in scraper[scraper-name].js

Easiest to copy from the address bar from the first page of search results (in Google Scholar website).

```javascript

(async () => {
    let browser = null;
    try {
        browser = await puppeteer.launch({ headless: false });
        let page = await browser.newPage();
        const url = `https://scholar.google.fi/scholar?hl=fi&as_sdt=0%2C5&q=%22programming+language%22+%28intitle%3Ahermeneutics+OR+intitle%3Ahermeneutical+OR+intitle%3A%22literature+review%22+OR+intitle%3A%22meta-analysis%22+OR+intitle%3A%22meta-analytical%22+OR+intitle%3Aphenomenological+OR+intitle%3Aphenomenology%29&btnG=`;
        await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 0,
        });
        ...
```

## Init Sqlite database

```
npm run migrate
```

## Run search
```
node scraper/[scraper-name].js
```

## Api

There is also a simple rest api (server.js) to serve records from the sqlite database. I use it to classify the records.
