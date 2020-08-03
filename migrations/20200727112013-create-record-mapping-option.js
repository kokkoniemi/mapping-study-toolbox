'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('RecordMappingOptions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      recordId: {
        type: Sequelize.DataTypes.INTEGER,
        references: {
          model: {
            tableName: 'Records',
          },
          key: 'id',
          
        },
        allowNull: false
      },
      mappingQuestionId: {
        type: Sequelize.DataTypes.INTEGER,
        references: {
          model: {
            tableName: 'MappingQuestions',
          },
          key: 'id',
          
        },
        allowNull: false
      },
      mappingOptionId: {
        type: Sequelize.DataTypes.INTEGER,
        references: {
          model: {
            tableName: 'MappingOptions',
          },
          key: 'id',
          
        },
        allowNull: false
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('RecordMappingOptions');
  }
};