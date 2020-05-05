'use strict';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn(
      'Records',
      'publicationId',
      {
        type: Sequelize.DataTypes.INTEGER,
        references: {
          model: {
            tableName: 'Publications',
          },
          key: 'id',
          
        },
        allowNull: true
      }
    );
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn(
      'Records',
      'publicationId'
    );;
  }
};

