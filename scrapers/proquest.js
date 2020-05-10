const parse = require('csv-parse/lib/sync')
const fs = require('fs');
const db = require("../models");
const { saveRecord } = require("../helpers");

(async () => {
    const input = fs.readFileSync(__dirname + '/ProQuestDocuments-2020-05-10-2.csv', 'utf-8');
    let scrape = await db.Import.create({
        database: "proquest",
        query: '/ProQuestDocuments-2020-05-10-2.csv',
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
            title: record.Title,
            author: record.Authors + " | " + record.pubtitle + " " + record.pubdate,
            abstract: record.Abstract,
            url: record.digitalObjectIdentifier ? `https://doi.org/${record.digitalObjectIdentifier.trim()}` : record.DocumentURL,
            alternateUrls: [],
            databases: ["proquest"]
        }, db, scrape);
    }
    console.log(records);
})();