async function saveRecord(record, db, scrape) {
    // 1. Check if there is dublicates
    const recordInstances = await db.Record.getAllByUrls([record.url, ...record.alternateUrls]);
    if (recordInstances.length) {
        await scrape.set('dublicates', scrape.dublicates + 1);
        await scrape.save();
    }
    for (let j = 0; j < recordInstances.length; j++) {
        recordInstance = recordInstances[j];
        const dbs = !recordInstance.databases ? [] : JSON.parse(recordInstance.databases);
        if (dbs && !dbs.includes(record.databases[0])) {
            dbs.push(record.databases[0])
            await recordInstance.set('databases', dbs);
            await recordInstance.save();
        }
    }
    if (!recordInstances.length) {
        // 2. Create a new record even if there is a namesake, since it might not be a dublicate
        const recordInstance = await db.Record.create({ ...record });
        // 3. If dublicates not found, check if there is namesakes, since those might also be dublicates
        const namesakes = await db.Record.findAll({
            where: {
                title: recordInstance.title,
                id: { [db.Sequelize.Op.ne]: recordInstance.id }
            }
        });
        await namesakes.forEach(namesake => {
            scrape.set('namesakes', [...scrape.namesakes, [namesake.id, recordInstance.id]]);
        });
    }
    // 4. log the total amount
    await scrape.set('total', scrape.total + 1);
    await scrape.save();
}

module.exports.saveRecord = saveRecord;