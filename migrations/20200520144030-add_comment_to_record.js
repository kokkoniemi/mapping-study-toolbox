'use strict';

module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addColumn(
            'Records',
            'comment',
            Sequelize.TEXT
        );
    },

    down: (queryInterface, Sequelize) => {
        return queryInterface.removeColumn(
            'Records',
            'comment'
        );
    }
};
