'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        const recordColumns = await queryInterface.describeTable('Records');

        if (!recordColumns.openAlexId) {
            await queryInterface.addColumn('Records', 'openAlexId', {
                type: Sequelize.STRING,
                allowNull: true,
            });
        }

        if (!recordColumns.citationCount) {
            await queryInterface.addColumn('Records', 'citationCount', {
                type: Sequelize.INTEGER,
                allowNull: true,
            });
        }

        if (!recordColumns.openAlexReferenceItems) {
            await queryInterface.addColumn('Records', 'openAlexReferenceItems', {
                type: Sequelize.JSON,
                allowNull: true,
            });
        }

        if (!recordColumns.openAlexCitationItems) {
            await queryInterface.addColumn('Records', 'openAlexCitationItems', {
                type: Sequelize.JSON,
                allowNull: true,
            });
        }

        if (!recordColumns.openAlexTopicItems) {
            await queryInterface.addColumn('Records', 'openAlexTopicItems', {
                type: Sequelize.JSON,
                allowNull: true,
            });
        }

        if (!recordColumns.openAlexAuthorAffiliations) {
            await queryInterface.addColumn('Records', 'openAlexAuthorAffiliations', {
                type: Sequelize.JSON,
                allowNull: true,
            });
        }

        if (!recordColumns.openAlexEnrichedAt) {
            await queryInterface.addColumn('Records', 'openAlexEnrichedAt', {
                type: Sequelize.DATE,
                allowNull: true,
            });
        }

        if (!recordColumns.openAlexLastError) {
            await queryInterface.addColumn('Records', 'openAlexLastError', {
                type: Sequelize.TEXT,
                allowNull: true,
            });
        }
    },

    down: async (queryInterface) => {
        const recordColumns = await queryInterface.describeTable('Records');

        if (recordColumns.openAlexLastError) {
            await queryInterface.removeColumn('Records', 'openAlexLastError');
        }
        if (recordColumns.openAlexEnrichedAt) {
            await queryInterface.removeColumn('Records', 'openAlexEnrichedAt');
        }
        if (recordColumns.openAlexAuthorAffiliations) {
            await queryInterface.removeColumn('Records', 'openAlexAuthorAffiliations');
        }
        if (recordColumns.openAlexTopicItems) {
            await queryInterface.removeColumn('Records', 'openAlexTopicItems');
        }
        if (recordColumns.openAlexCitationItems) {
            await queryInterface.removeColumn('Records', 'openAlexCitationItems');
        }
        if (recordColumns.openAlexReferenceItems) {
            await queryInterface.removeColumn('Records', 'openAlexReferenceItems');
        }
        if (recordColumns.citationCount) {
            await queryInterface.removeColumn('Records', 'citationCount');
        }
        if (recordColumns.openAlexId) {
            await queryInterface.removeColumn('Records', 'openAlexId');
        }
    }
};
