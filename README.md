# mapping-study-toolbox

This repository is now a monorepo with:
- `server` side API (Express + Sequelize + sqlite)
- `ui/` frontend source (Vue 3 + Vite)
- `public/` packaged frontend build served by the backend

![Screenshot of the GUI](screenshot.png)

## System requirements

- node.js v24 LTS or above (You can use [nvm](https://github.com/nvm-sh/nvm) to change node version on command line)
- npm
- sqlite3

If you use nvm:
```shell
nvm install 24
nvm use 24
```

## Project setup
### 1. Clone the project with submodules
```
git clone https://github.com/kokkoniemi/mapping-study-toolbox.git --recurse-submodules
```
### 2. Install backend dependencies
```
npm install
```

### 3. Install UI dependencies
```
npm run ui:install
```

### 4. Change runtime DB config to point to your database
- Copy `db-config.example.json` to `db-config.json` (if needed) and set `storage`
- Change the `storage` key, i.e.
    ```
    {
      "dialect": "sqlite",
      "storage": "/Users/mikko/Documents/mapping-db.sqlite3",
      "logging": false
    }
    ```

### 5. Create sequelize-cli config for migrations
- Copy `config/config.example.json` to `config/config.json`
- Set the same sqlite `storage` path as in `db-config.json`

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

There is a simple rest api (`server.js`) to serve records from sqlite and host the built UI from `public/`.

### Build UI into `public/`
```shell
npm run ui:build
```

### Start backend + packaged UI
```shell
npm start
```

Now the api runs at http://localhost:3000/api/, and the GUI is served at http://localhost:3000.

### Optional: run UI dev server
```shell
npm run ui:dev
```
UI dev server runs on http://localhost:8080 and calls backend API at http://localhost:3000/api/.
