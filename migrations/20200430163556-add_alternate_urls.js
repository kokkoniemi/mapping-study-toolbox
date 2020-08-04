'use strict';

module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addColumn(
            'Records',
            'alternateUrls',
            Sequelize.JSON
        );
    },

    down: (queryInterface, Sequelize) => {
        return queryInterface.removeColumn(
            'Records',
            'alternateUrls'
        );
    }
};
