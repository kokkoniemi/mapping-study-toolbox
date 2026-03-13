'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('Records', 'resolvedBy', {
            type: Sequelize.STRING,
            allowNull: true,
        });

        await queryInterface.addColumn('Records', 'resolvedByUserId', {
            type: Sequelize.INTEGER,
            allowNull: true,
        });

        await queryInterface.sequelize.query(
            'UPDATE "Records" SET "resolvedBy" = "editedBy" WHERE "resolvedBy" IS NULL AND "editedBy" IS NOT NULL',
        );
    },

    down: async (queryInterface) => {
        await queryInterface.removeColumn('Records', 'resolvedByUserId');
        await queryInterface.removeColumn('Records', 'resolvedBy');
    },
};
