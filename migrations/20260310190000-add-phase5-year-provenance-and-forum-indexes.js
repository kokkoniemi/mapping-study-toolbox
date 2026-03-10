'use strict';

const INDEX_DEFINITIONS = [
    {
        table: 'Forums',
        fields: ['name'],
        name: 'forums_name_idx',
    },
    {
        table: 'Forums',
        fields: ['issn'],
        name: 'forums_issn_idx',
    },
];

const ensureIndex = async (queryInterface, definition) => {
    const indexes = await queryInterface.showIndex(definition.table);
    const exists = indexes.some((index) => index.name === definition.name);
    if (!exists) {
        await queryInterface.addIndex(definition.table, definition.fields, {
            name: definition.name,
        });
    }
};

const removeIndexIfExists = async (queryInterface, definition) => {
    const indexes = await queryInterface.showIndex(definition.table);
    const exists = indexes.some((index) => index.name === definition.name);
    if (exists) {
        await queryInterface.removeIndex(definition.table, definition.name);
    }
};

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const recordColumns = await queryInterface.describeTable('Records');
        if (!recordColumns.year) {
            await queryInterface.addColumn('Records', 'year', {
                type: Sequelize.INTEGER,
                allowNull: true,
            });
        }
        if (!recordColumns.enrichmentProvenance) {
            await queryInterface.addColumn('Records', 'enrichmentProvenance', {
                type: Sequelize.JSON,
                allowNull: true,
            });
        }

        const forumColumns = await queryInterface.describeTable('Forums');
        if (!forumColumns.enrichmentProvenance) {
            await queryInterface.addColumn('Forums', 'enrichmentProvenance', {
                type: Sequelize.JSON,
                allowNull: true,
            });
        }

        for (const definition of INDEX_DEFINITIONS) {
            await ensureIndex(queryInterface, definition);
        }
    },

    down: async (queryInterface) => {
        for (const definition of INDEX_DEFINITIONS) {
            await removeIndexIfExists(queryInterface, definition);
        }

        const recordColumns = await queryInterface.describeTable('Records');
        if (recordColumns.enrichmentProvenance) {
            await queryInterface.removeColumn('Records', 'enrichmentProvenance');
        }
        if (recordColumns.year) {
            await queryInterface.removeColumn('Records', 'year');
        }

        const forumColumns = await queryInterface.describeTable('Forums');
        if (forumColumns.enrichmentProvenance) {
            await queryInterface.removeColumn('Forums', 'enrichmentProvenance');
        }
    },
};
