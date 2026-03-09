'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const forumColumns = await queryInterface.describeTable('Forums');
        if (!forumColumns.issn) {
            await queryInterface.addColumn('Forums', 'issn', {
                type: Sequelize.STRING,
                allowNull: true,
            });
        }
        if (!forumColumns.jufoId) {
            await queryInterface.addColumn('Forums', 'jufoId', {
                type: Sequelize.INTEGER,
                allowNull: true,
            });
        }
        if (!forumColumns.jufoFetchedAt) {
            await queryInterface.addColumn('Forums', 'jufoFetchedAt', {
                type: Sequelize.DATE,
                allowNull: true,
            });
        }
        if (!forumColumns.jufoLastError) {
            await queryInterface.addColumn('Forums', 'jufoLastError', {
                type: Sequelize.TEXT,
                allowNull: true,
            });
        }
    },

    down: async (queryInterface) => {
        const forumColumns = await queryInterface.describeTable('Forums');
        if (forumColumns.jufoLastError) {
            await queryInterface.removeColumn('Forums', 'jufoLastError');
        }
        if (forumColumns.jufoFetchedAt) {
            await queryInterface.removeColumn('Forums', 'jufoFetchedAt');
        }
        if (forumColumns.jufoId) {
            await queryInterface.removeColumn('Forums', 'jufoId');
        }
        if (forumColumns.issn) {
            await queryInterface.removeColumn('Forums', 'issn');
        }
    }
};
