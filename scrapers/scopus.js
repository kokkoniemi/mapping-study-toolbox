const parse = require('csv-parse/lib/sync')
const fs = require('fs');
const db = require("../models");
const { saveRecord } = require("../helpers");

(async () => {
    const input = fs.readFileSync(__dirname + '/scopus.csv', 'utf-8');
    let scrape = await db.Import.create({
        database: "scopus",
        query: '/scopus.csv',
        total: 0,
        dublicates: 0,
        namesakes: []
    });

    const records = parse(input, {
        columns: true,
        skip_empty_lines: true,
        delimiter: ','
    });

    for (record of records) {
        await saveRecord({
            title: record.Title,
            author: record.Authors + " | " + record['Source title'] + " Volume " + record.Volume + " " + record.Year,
            abstract: record.Abstract,
            url: record.DOI ? `https://doi.org/${record.DOI}` : record.Link,
            alternateUrls: [
                record.DOI ? record.Link : `https://doi.org/${record.DOI}`,
            ],
            databases: ["scopus"]
        }, db, scrape);
    }
})();