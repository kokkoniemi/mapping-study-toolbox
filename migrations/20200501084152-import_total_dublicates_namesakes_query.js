'use strict';

module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.sequelize.transaction(t => {
            return Promise.all([
                queryInterface.addColumn('Imports', 'total', {
                    type: Sequelize.DataTypes.INTEGER
                }, { transaction: t }),
                queryInterface.addColumn('Imports', 'dublicates', {
                    type: Sequelize.DataTypes.INTEGER,
                }, { transaction: t }),
                queryInterface.addColumn('Imports', 'namesakes', {
                    type: Sequelize.DataTypes.JSON,
                }, { transaction: t }),
                queryInterface.addColumn('Imports', 'query', {
                    type: Sequelize.DataTypes.TEXT,
                }, { transaction: t })
            ]);
        });
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.sequelize.transaction(t => {
            return Promise.all([
                queryInterface.removeColumn('Imports', 'total', { transaction: t }),
                queryInterface.removeColumn('Imports', 'dublicates', { transaction: t }),
                queryInterface.removeColumn('Imports', 'namesakes', { transaction: t }),
                queryInterface.removeColumn('Imports', 'query', { transaction: t })
            ]);
        });
    }
};
