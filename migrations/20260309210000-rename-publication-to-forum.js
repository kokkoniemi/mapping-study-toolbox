'use strict';

const normalizeTableName = (table) => {
    if (typeof table === 'string') {
        return table;
    }

    if (table && typeof table === 'object') {
        if (typeof table.tableName === 'string') {
            return table.tableName;
        }
        if (typeof table.name === 'string') {
            return table.name;
        }
    }

    return null;
};

module.exports = {
    up: async (queryInterface) => {
        const dialect = queryInterface.sequelize.getDialect();
        const tables = await queryInterface.showAllTables();
        const tableNames = tables.map(normalizeTableName).filter(Boolean);

        if (tableNames.includes('Publications') && !tableNames.includes('Forums')) {
            await queryInterface.renameTable('Publications', 'Forums');
        }

        const recordColumns = await queryInterface.describeTable('Records');
        if (recordColumns.publicationId && !recordColumns.forumId) {
            if (dialect === 'sqlite') {
                await queryInterface.sequelize.query('DROP TABLE IF EXISTS `Records_backup`;');
                await queryInterface.sequelize.query('PRAGMA foreign_keys = OFF;');
                try {
                    await queryInterface.renameColumn('Records', 'publicationId', 'forumId');
                } finally {
                    await queryInterface.sequelize.query('PRAGMA foreign_keys = ON;');
                }
            } else {
                await queryInterface.renameColumn('Records', 'publicationId', 'forumId');
            }
        }
    },

    down: async (queryInterface) => {
        const dialect = queryInterface.sequelize.getDialect();
        const recordColumns = await queryInterface.describeTable('Records');
        if (recordColumns.forumId && !recordColumns.publicationId) {
            if (dialect === 'sqlite') {
                await queryInterface.sequelize.query('DROP TABLE IF EXISTS `Records_backup`;');
                await queryInterface.sequelize.query('PRAGMA foreign_keys = OFF;');
                try {
                    await queryInterface.renameColumn('Records', 'forumId', 'publicationId');
                } finally {
                    await queryInterface.sequelize.query('PRAGMA foreign_keys = ON;');
                }
            } else {
                await queryInterface.renameColumn('Records', 'forumId', 'publicationId');
            }
        }

        const tables = await queryInterface.showAllTables();
        const tableNames = tables.map(normalizeTableName).filter(Boolean);

        if (tableNames.includes('Forums') && !tableNames.includes('Publications')) {
            await queryInterface.renameTable('Forums', 'Publications');
        }
    }
};
