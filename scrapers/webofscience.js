const parse = require('csv-parse/lib/sync')
const fs = require('fs');
const db = require("../models");
const { saveRecord } = require("../helpers");

(async () => {
    const input = fs.readFileSync(__dirname + '/webofscience.csv', 'utf-8');
    let scrape = await db.Import.create({
        database: "webofscience",
        query: '/webofscience.csv',
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
        await saveRecord({
            title: record.TI,
            author: record.AF + " | " + record.SO + " " + record.PY + " " + record.JI,
            abstract: record.AB,
            url: record.DI ? `https://doi.org/${record.DI}` : record.UT,
            alternateUrls: [],
            databases: ["webofscience"]
        }, db, scrape);
    }
    console.log(records);
})();