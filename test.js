const db = require("./models");

(async () => {
    const res = await db.Record.getAllByUrl('https://doi.org/10.1145/1067445.1067553');
    console.log(res);
})()