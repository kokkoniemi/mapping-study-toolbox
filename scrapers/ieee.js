const parse = require('csv-parse/lib/sync')
const fs = require('fs');
const qs = require('querystring');
const db = require("../models");
const { saveRecord } = require("../helpers");

(async () => {
    const input = fs.readFileSync(__dirname + '/ieeexplore.csv', 'utf-8');
    let scrape = await db.Import.create({
        database: "ieeexplore",
        query: '/ieeexplore.csv',
        total: 0,
        dublicates: 0,
        namesakes: []
    });

    const records = parse(input, {
        columns: true,
        skip_empty_lines: true,
        delimiter: ';'
    });

    for (record of records) {
        const q = qs.parse(record['PDF Link'].substring(record['PDF Link'].indexOf('?') + 1));
        await saveRecord({
            title: record['Document Title'],
            author: record.Authors + " | " + record['Publication Title'],
            abstract: record.Abstract,
            url:  `https://ieeexplore.ieee.org/document/${q.arnumber}`,
            alternateUrls: [
                ...(record.DOI ? [`https://doi.org/${record.DOI.trim()}`] : []),
                record['PDF Link'],
                `https://ieeexplore.ieee.org/abstract/document/${q.arnumber}`
            ],
            databases: ["ieeexplore"]
        }, db, scrape);
    }
})();