'use strict';

module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addColumn(
            'Records',
            'status',
            Sequelize.STRING
        );
    },

    down: (queryInterface, Sequelize) => {
        return queryInterface.removeColumn(
            'Records',
            'status'
        );
    }
};
