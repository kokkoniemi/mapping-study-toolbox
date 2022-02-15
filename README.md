# mapping-study-toolbox

This repository includes a GUI frontend for classifying literature in inclusion/exclusion phase of mapping studies or literature reviews. Additionally, the toolbox has a backend server for the GUI and several scrapers and importer scripts for fetching the search results into the database.

The GUI can be accessed from https://localhost:3000 when the backend is running. It is actually a packaged build version of the GUI, which is developed in a separate repository ([classify-literature-gui](https://github.com/kokkoniemi/classify-literature-gui)).

## System requirements

- node.js v16 or above (You can use [nvm](https://github.com/nvm-sh/nvm) to change node version on command line)
- npm
- sqlite3

## Project setup
### 1. Clone the project with submodules
```
git clone https://github.com/kokkoniemi/mapping-study-toolbox.git --recurse-submodules
```
### 2. Install node modules
```
npm install
```

### 3. Change the config file to point to your database
- Copy config/config.example.json to config/config.json
- Change the development `storage` key, i.e.
    ```
    {
        "development": {
            "dialect": "sqlite",
            "storage": "/Users/mikkokokkoniemi/Documents/mapping-db.sqlite3",
            "logging": false
        },
        "test": {
            "dialect": "sqlite",
            "storage": ":memory"
        },
        "production": {
            "dialect": "sqlite",
            "storage": "database.sqlite3",
            "logging": false
        }
    }
    ```

## Scraping search results

### Change search query in scraper[scraper-name].js

It may be easiest to copy from the browser address bar from the first page of search results (e.g., in Google Scholar search result page in the following example).

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

### Init Sqlite database
This is safe and does not affect the existing data in the database.
```
npm run migrate
```

### Run search
```
node scrapers/[scraper-name].js
```

## Api and GUI

There is a simple rest api (server.js) to serve records from the sqlite database. I use it to classify the records.

To use the api run:
```shell
npm start
```

Now the api runs at https://localhost:3000/api/, and the GUI frontend is served at https://localhost:3000.
