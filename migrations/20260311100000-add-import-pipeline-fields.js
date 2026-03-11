'use strict';

const TABLE_IMPORTS = 'Imports';
const TABLE_RECORDS = 'Records';
const RECORD_IMPORT_INDEX = 'records_import_id_idx';

const addColumnIfMissing = async (queryInterface, table, column, definition) => {
    const columns = await queryInterface.describeTable(table);
    if (!columns[column]) {
        await queryInterface.addColumn(table, column, definition);
    }
};

const removeColumnIfExists = async (queryInterface, table, column) => {
    const columns = await queryInterface.describeTable(table);
    if (columns[column]) {
        await queryInterface.removeColumn(table, column);
    }
};

const addIndexIfMissing = async (queryInterface, table, name, fields) => {
    const indexes = await queryInterface.showIndex(table);
    if (!indexes.some((index) => index.name === name)) {
        await queryInterface.addIndex(table, fields, { name });
    }
};

const removeIndexIfExists = async (queryInterface, table, name) => {
    const indexes = await queryInterface.showIndex(table);
    if (indexes.some((index) => index.name === name)) {
        await queryInterface.removeIndex(table, name);
    }
};

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await addColumnIfMissing(queryInterface, TABLE_IMPORTS, 'source', {
            type: Sequelize.STRING,
            allowNull: true,
        });
        await addColumnIfMissing(queryInterface, TABLE_IMPORTS, 'format', {
            type: Sequelize.STRING,
            allowNull: true,
        });
        await addColumnIfMissing(queryInterface, TABLE_IMPORTS, 'fileName', {
            type: Sequelize.STRING,
            allowNull: true,
        });
        await addColumnIfMissing(queryInterface, TABLE_IMPORTS, 'imported', {
            type: Sequelize.INTEGER,
            allowNull: true,
        });

        await addColumnIfMissing(queryInterface, TABLE_RECORDS, 'importId', {
            type: Sequelize.INTEGER,
            allowNull: true,
        });
        await addIndexIfMissing(queryInterface, TABLE_RECORDS, RECORD_IMPORT_INDEX, ['importId']);
    },

    down: async (queryInterface) => {
        await removeIndexIfExists(queryInterface, TABLE_RECORDS, RECORD_IMPORT_INDEX);
        await removeColumnIfExists(queryInterface, TABLE_RECORDS, 'importId');

        await removeColumnIfExists(queryInterface, TABLE_IMPORTS, 'imported');
        await removeColumnIfExists(queryInterface, TABLE_IMPORTS, 'fileName');
        await removeColumnIfExists(queryInterface, TABLE_IMPORTS, 'format');
        await removeColumnIfExists(queryInterface, TABLE_IMPORTS, 'source');
    },
};
