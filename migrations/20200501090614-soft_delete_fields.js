'use strict';

module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.sequelize.transaction(t => {
            return Promise.all([
                queryInterface.addColumn('Imports', 'deletedAt', {
                    type: Sequelize.DataTypes.DATE
                }, { transaction: t }),
                queryInterface.addColumn('Records', 'deletedAt', {
                    type: Sequelize.DataTypes.DATE,
                }, { transaction: t })
            ]);
        });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.sequelize.transaction(t => {
            return Promise.all([
                queryInterface.removeColumn('Imports', 'deletedAt', { transaction: t }),
                queryInterface.removeColumn('Records', 'deletedAt', { transaction: t })
            ]);
        });
    }
};
