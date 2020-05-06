'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn(
      'Records',
      'editedBy',
      Sequelize.STRING
    );
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn(
      'Records',
      'editedBy'
    );
  }
};
