'use strict';

const addColumn = (queryInterface, table, column, spec) =>
  queryInterface.addColumn(table, column, spec).catch((error) => {
    if (/duplicate column name/i.test(String(error?.message ?? ''))) {
      return undefined;
    }
    throw error;
  });

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await addColumn(queryInterface, 'KeywordingJobs', 'representationModel', {
      allowNull: true,
      type: Sequelize.STRING,
    });
    await addColumn(queryInterface, 'KeywordingJobs', 'topicReductionApplied', {
      allowNull: false,
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });
    await addColumn(queryInterface, 'KeywordingJobs', 'topicCountBeforeReduction', {
      allowNull: true,
      type: Sequelize.INTEGER,
    });
    await addColumn(queryInterface, 'KeywordingJobs', 'topicCountAfterReduction', {
      allowNull: true,
      type: Sequelize.INTEGER,
    });
    await addColumn(queryInterface, 'KeywordingJobs', 'downgradedTopicCount', {
      allowNull: false,
      type: Sequelize.INTEGER,
      defaultValue: 0,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('KeywordingJobs', 'downgradedTopicCount');
    await queryInterface.removeColumn('KeywordingJobs', 'topicCountAfterReduction');
    await queryInterface.removeColumn('KeywordingJobs', 'topicCountBeforeReduction');
    await queryInterface.removeColumn('KeywordingJobs', 'topicReductionApplied');
    await queryInterface.removeColumn('KeywordingJobs', 'representationModel');
  },
};
