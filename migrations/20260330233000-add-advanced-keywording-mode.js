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
    await addColumn(queryInterface, 'RecordDocuments', 'embeddingStatus', {
      allowNull: false,
      type: Sequelize.STRING,
      defaultValue: 'not_ready',
    });
    await addColumn(queryInterface, 'RecordDocuments', 'embeddingModel', {
      allowNull: true,
      type: Sequelize.STRING,
    });
    await addColumn(queryInterface, 'RecordDocuments', 'embeddingTask', {
      allowNull: true,
      type: Sequelize.STRING,
    });
    await addColumn(queryInterface, 'RecordDocuments', 'embeddingGeneratedAt', {
      allowNull: true,
      type: Sequelize.DATE,
    });

    await addColumn(queryInterface, 'DocumentChunks', 'embeddingModel', {
      allowNull: true,
      type: Sequelize.STRING,
    });
    await addColumn(queryInterface, 'DocumentChunks', 'embeddingTask', {
      allowNull: true,
      type: Sequelize.STRING,
    });
    await addColumn(queryInterface, 'DocumentChunks', 'embeddingVersion', {
      allowNull: true,
      type: Sequelize.STRING,
    });
    await addColumn(queryInterface, 'DocumentChunks', 'embeddingChecksum', {
      allowNull: true,
      type: Sequelize.STRING,
    });
    await addColumn(queryInterface, 'DocumentChunks', 'embeddingGeneratedAt', {
      allowNull: true,
      type: Sequelize.DATE,
    });

    await addColumn(queryInterface, 'KeywordingJobs', 'analysisMode', {
      allowNull: false,
      type: Sequelize.STRING,
      defaultValue: 'standard',
    });
    await addColumn(queryInterface, 'KeywordingJobs', 'reuseEmbeddingCache', {
      allowNull: false,
      type: Sequelize.BOOLEAN,
      defaultValue: true,
    });
    await addColumn(queryInterface, 'KeywordingJobs', 'embeddingModel', {
      allowNull: true,
      type: Sequelize.STRING,
    });
    await addColumn(queryInterface, 'KeywordingJobs', 'bertopicVersion', {
      allowNull: true,
      type: Sequelize.STRING,
    });
    await addColumn(queryInterface, 'KeywordingJobs', 'cacheSummary', {
      allowNull: true,
      type: Sequelize.JSON,
    });
    await addColumn(queryInterface, 'KeywordingJobs', 'topicArtifactPath', {
      allowNull: true,
      type: Sequelize.STRING,
    });

    await queryInterface.addIndex('KeywordingJobs', ['analysisMode'], {
      name: 'keywording_jobs_analysis_mode_idx',
    });

    await addColumn(queryInterface, 'KeywordingClusters', 'topicId', {
      allowNull: true,
      type: Sequelize.INTEGER,
    });
    await addColumn(queryInterface, 'KeywordingClusters', 'parentTopicId', {
      allowNull: true,
      type: Sequelize.INTEGER,
    });
    await addColumn(queryInterface, 'KeywordingClusters', 'isOutlier', {
      allowNull: false,
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });
    await addColumn(queryInterface, 'KeywordingClusters', 'topTerms', {
      allowNull: true,
      type: Sequelize.JSON,
    });
    await addColumn(queryInterface, 'KeywordingClusters', 'representativeChunkKeys', {
      allowNull: true,
      type: Sequelize.JSON,
    });
    await addColumn(queryInterface, 'KeywordingClusters', 'representationSource', {
      allowNull: true,
      type: Sequelize.STRING,
    });
    await addColumn(queryInterface, 'KeywordingClusters', 'topicSize', {
      allowNull: true,
      type: Sequelize.INTEGER,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('KeywordingClusters', 'topicSize');
    await queryInterface.removeColumn('KeywordingClusters', 'representationSource');
    await queryInterface.removeColumn('KeywordingClusters', 'representativeChunkKeys');
    await queryInterface.removeColumn('KeywordingClusters', 'topTerms');
    await queryInterface.removeColumn('KeywordingClusters', 'isOutlier');
    await queryInterface.removeColumn('KeywordingClusters', 'parentTopicId');
    await queryInterface.removeColumn('KeywordingClusters', 'topicId');
    await queryInterface.removeColumn('KeywordingJobs', 'topicArtifactPath');
    await queryInterface.removeColumn('KeywordingJobs', 'cacheSummary');
    await queryInterface.removeColumn('KeywordingJobs', 'bertopicVersion');
    await queryInterface.removeColumn('KeywordingJobs', 'embeddingModel');
    await queryInterface.removeColumn('KeywordingJobs', 'reuseEmbeddingCache');
    await queryInterface.removeColumn('KeywordingJobs', 'analysisMode');
    await queryInterface.removeColumn('DocumentChunks', 'embeddingGeneratedAt');
    await queryInterface.removeColumn('DocumentChunks', 'embeddingChecksum');
    await queryInterface.removeColumn('DocumentChunks', 'embeddingVersion');
    await queryInterface.removeColumn('DocumentChunks', 'embeddingTask');
    await queryInterface.removeColumn('DocumentChunks', 'embeddingModel');
    await queryInterface.removeColumn('RecordDocuments', 'embeddingGeneratedAt');
    await queryInterface.removeColumn('RecordDocuments', 'embeddingTask');
    await queryInterface.removeColumn('RecordDocuments', 'embeddingModel');
    await queryInterface.removeColumn('RecordDocuments', 'embeddingStatus');
  },
};
