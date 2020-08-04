'use strict';

module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addColumn(
            'Records',
            'databases',
            Sequelize.JSON
        );
    },

    down: (queryInterface, Sequelize) => {
        return queryInterface.removeColumn(
            'Records',
            'databases'
        );
    }
};
