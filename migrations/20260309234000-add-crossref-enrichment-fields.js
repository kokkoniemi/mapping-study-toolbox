'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const recordColumns = await queryInterface.describeTable('Records');
        if (!recordColumns.doi) {
            await queryInterface.addColumn('Records', 'doi', {
                type: Sequelize.STRING,
                allowNull: true,
            });
        }
        if (!recordColumns.authorDetails) {
            await queryInterface.addColumn('Records', 'authorDetails', {
                type: Sequelize.JSON,
                allowNull: true,
            });
        }
        if (!recordColumns.referenceItems) {
            await queryInterface.addColumn('Records', 'referenceItems', {
                type: Sequelize.JSON,
                allowNull: true,
            });
        }
        if (!recordColumns.crossrefEnrichedAt) {
            await queryInterface.addColumn('Records', 'crossrefEnrichedAt', {
                type: Sequelize.DATE,
                allowNull: true,
            });
        }
        if (!recordColumns.crossrefLastError) {
            await queryInterface.addColumn('Records', 'crossrefLastError', {
                type: Sequelize.TEXT,
                allowNull: true,
            });
        }

        const forumColumns = await queryInterface.describeTable('Forums');
        if (!forumColumns.publisher) {
            await queryInterface.addColumn('Forums', 'publisher', {
                type: Sequelize.STRING,
                allowNull: true,
            });
        }
    },

    down: async (queryInterface) => {
        const recordColumns = await queryInterface.describeTable('Records');
        if (recordColumns.crossrefLastError) {
            await queryInterface.removeColumn('Records', 'crossrefLastError');
        }
        if (recordColumns.crossrefEnrichedAt) {
            await queryInterface.removeColumn('Records', 'crossrefEnrichedAt');
        }
        if (recordColumns.referenceItems) {
            await queryInterface.removeColumn('Records', 'referenceItems');
        }
        if (recordColumns.authorDetails) {
            await queryInterface.removeColumn('Records', 'authorDetails');
        }
        if (recordColumns.doi) {
            await queryInterface.removeColumn('Records', 'doi');
        }

        const forumColumns = await queryInterface.describeTable('Forums');
        if (forumColumns.publisher) {
            await queryInterface.removeColumn('Forums', 'publisher');
        }
    }
};
