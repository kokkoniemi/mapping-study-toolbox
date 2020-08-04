'use strict';

module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addColumn(
            'Records',
            'abstract',
            Sequelize.TEXT
        );
    },

    down: (queryInterface, Sequelize) => {
        return queryInterface.removeColumn(
            'Records',
            'abstract'
        );
    }
};
