'use strict';

const BROKEN_MIGRATION_NAME = '20260309184000-remove_description_column_from_record.js';

const markMigrationAsApplied = async (queryInterface, migrationName) => {
    await queryInterface.sequelize.query(`
        INSERT INTO \`SequelizeMeta\` (\`name\`)
        SELECT '${migrationName}'
        WHERE NOT EXISTS (
            SELECT 1 FROM \`SequelizeMeta\` WHERE \`name\` = '${migrationName}'
        );
    `);
};

module.exports = {
    up: async (queryInterface) => {
        const dialect = queryInterface.sequelize.getDialect();
        const columns = await queryInterface.describeTable('Records');

        if (dialect === 'sqlite') {
            // Cleanup leftovers from failed sqlite `removeColumn` attempts.
            await queryInterface.sequelize.query('DROP TABLE IF EXISTS `Records_backup`;');
        }

        if (columns.description) {
            if (dialect === 'sqlite') {
                await queryInterface.sequelize.query('PRAGMA foreign_keys = OFF;');
                try {
                    await queryInterface.removeColumn('Records', 'description');
                } finally {
                    await queryInterface.sequelize.query('PRAGMA foreign_keys = ON;');
                }
            } else {
                await queryInterface.removeColumn('Records', 'description');
            }
        }

        await markMigrationAsApplied(queryInterface, BROKEN_MIGRATION_NAME);
    },

    down: async (queryInterface, Sequelize) => {
        const columns = await queryInterface.describeTable('Records');
        if (!columns.description) {
            await queryInterface.addColumn('Records', 'description', {
                type: Sequelize.TEXT,
                allowNull: true,
            });
        }

        await queryInterface.sequelize.query(`
            DELETE FROM \`SequelizeMeta\`
            WHERE \`name\` = '${BROKEN_MIGRATION_NAME}';
        `);
    },
};
