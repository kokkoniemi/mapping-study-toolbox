const { Sequelize, DataTypes } = require('sequelize');
const isAfter = require('date-fns/is_after');

const paths = {
    db1: '',
    db2: '',
};

const recordAttributes = {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    title: DataTypes.TEXT,
    url: DataTypes.STRING,
    author: DataTypes.STRING,
    description: DataTypes.TEXT,
    status: DataTypes.STRING,       // null,"excluded","included","uncertain"
    abstract: DataTypes.TEXT,
    databases: DataTypes.JSON,      // JSON array
    alternateUrls: DataTypes.JSON,  // JSON array
    editedBy: DataTypes.STRING,
    publicationId: DataTypes.INTEGER
};

const sequelize1 = new Sequelize({
    dialect: 'sqlite',
    storage: paths.db1,
    "logging": false
});

const sequelize2 = new Sequelize({
    dialect: 'sqlite',
    storage: paths.db2,
    "logging": false
});

const Record1 = sequelize1.define('Record', recordAttributes, {
    paranoid: true
});

const Record2 = sequelize2.define('Record', recordAttributes, {
    paranoid: true
});

(async () => {
    let rowCount = await Record1.count({});
    for (let i = 0; i < rowCount; i++) {
        const r1 = await Record1.findOne({
            offset: i,
        });
        const r2 = await Record2.findByPk(r1.id);
        const r1date = new Date(r1.updatedAt);
        const r2date = new Date(r2.updatedAt);
        if (isAfter(r2date, r1date)) {
            // update r2 status & editedBy to r1
            await r1.set('status', r2.status);
            await r1.set('editedBy', r2.editedBy);
            await r1.save();
        } else if (isAfter(r1date, r2date)) {
            // update r1 status & editedBy to r2
            await r2.set('status', r1.status);
            await r2.set('editedBy', r1.editedBy);
            await r2.save();
        }
    }
})();

