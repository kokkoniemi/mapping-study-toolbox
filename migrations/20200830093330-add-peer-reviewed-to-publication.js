'use strict';

module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.addColumn(
            'Publications',
            'poorPeerReview',
            Sequelize.BOOLEAN
        );
    },

    down: (queryInterface, Sequelize) => {
        return queryInterface.removeColumn(
            'Publications',
            'poorPeerReview'
        );
    }
};
