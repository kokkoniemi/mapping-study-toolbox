'use strict';

module.exports = {
  up: (queryInterface) => {
    return queryInterface.removeColumn('Records', 'description');
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.addColumn('Records', 'description', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },
};
