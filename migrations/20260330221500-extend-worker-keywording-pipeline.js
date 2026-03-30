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
    await addColumn(queryInterface, 'MappingQuestions', 'description', {
      allowNull: true,
      type: Sequelize.TEXT,
    });
    await addColumn(queryInterface, 'MappingQuestions', 'decisionGuidance', {
      allowNull: true,
      type: Sequelize.TEXT,
    });
    await addColumn(queryInterface, 'MappingQuestions', 'positiveExamples', {
      allowNull: true,
      type: Sequelize.JSON,
    });
    await addColumn(queryInterface, 'MappingQuestions', 'negativeExamples', {
      allowNull: true,
      type: Sequelize.JSON,
    });
    await addColumn(queryInterface, 'MappingQuestions', 'evidenceInstructions', {
      allowNull: true,
      type: Sequelize.TEXT,
    });
    await addColumn(queryInterface, 'MappingQuestions', 'allowNewOption', {
      allowNull: false,
      type: Sequelize.BOOLEAN,
      defaultValue: true,
    });

    await addColumn(queryInterface, 'RecordDocuments', 'sourceType', {
      allowNull: false,
      type: Sequelize.STRING,
      defaultValue: 'unknown',
    });
    await addColumn(queryInterface, 'RecordDocuments', 'pageCount', {
      allowNull: true,
      type: Sequelize.INTEGER,
    });
    await addColumn(queryInterface, 'RecordDocuments', 'extractorKind', {
      allowNull: true,
      type: Sequelize.STRING,
    });
    await addColumn(queryInterface, 'RecordDocuments', 'extractorVersion', {
      allowNull: true,
      type: Sequelize.STRING,
    });
    await addColumn(queryInterface, 'RecordDocuments', 'structuredDocumentPath', {
      allowNull: true,
      type: Sequelize.STRING,
    });
    await addColumn(queryInterface, 'RecordDocuments', 'chunkManifestPath', {
      allowNull: true,
      type: Sequelize.STRING,
    });
    await addColumn(queryInterface, 'RecordDocuments', 'qualityStatus', {
      allowNull: false,
      type: Sequelize.STRING,
      defaultValue: 'pending',
    });
    await addColumn(queryInterface, 'RecordDocuments', 'qualityScore', {
      allowNull: true,
      type: Sequelize.FLOAT,
    });
    await addColumn(queryInterface, 'RecordDocuments', 'printableTextRatio', {
      allowNull: true,
      type: Sequelize.FLOAT,
    });
    await addColumn(queryInterface, 'RecordDocuments', 'weirdCharacterRatio', {
      allowNull: true,
      type: Sequelize.FLOAT,
    });
    await addColumn(queryInterface, 'RecordDocuments', 'ocrUsed', {
      allowNull: false,
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });
    await addColumn(queryInterface, 'RecordDocuments', 'ocrConfidence', {
      allowNull: true,
      type: Sequelize.FLOAT,
    });
    await addColumn(queryInterface, 'RecordDocuments', 'extractionWarnings', {
      allowNull: true,
      type: Sequelize.JSON,
    });

    await queryInterface.createTable('DocumentChunks', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      recordDocumentId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: {
          model: 'RecordDocuments',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      chunkKey: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      chunkIndex: {
        allowNull: false,
        type: Sequelize.INTEGER,
      },
      pageStart: {
        allowNull: true,
        type: Sequelize.INTEGER,
      },
      pageEnd: {
        allowNull: true,
        type: Sequelize.INTEGER,
      },
      sectionName: {
        allowNull: true,
        type: Sequelize.STRING,
      },
      headingPath: {
        allowNull: true,
        type: Sequelize.JSON,
      },
      text: {
        allowNull: false,
        type: Sequelize.TEXT,
      },
      charCount: {
        allowNull: false,
        type: Sequelize.INTEGER,
      },
      tokenCount: {
        allowNull: false,
        type: Sequelize.INTEGER,
      },
      embeddingReference: {
        allowNull: true,
        type: Sequelize.STRING,
      },
      qualityScore: {
        allowNull: true,
        type: Sequelize.FLOAT,
      },
      qualityFlags: {
        allowNull: true,
        type: Sequelize.JSON,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex('DocumentChunks', ['recordDocumentId'], {
      name: 'document_chunks_record_document_idx',
    });
    await queryInterface.addIndex('DocumentChunks', ['recordDocumentId', 'chunkKey'], {
      unique: true,
      name: 'document_chunks_record_document_chunk_key_unique',
    });

    await addColumn(queryInterface, 'KeywordingSuggestions', 'actionType', {
      allowNull: false,
      type: Sequelize.STRING,
      defaultValue: 'reuse_existing',
    });
    await addColumn(queryInterface, 'KeywordingSuggestions', 'reviewerNote', {
      allowNull: true,
      type: Sequelize.TEXT,
    });

    await addColumn(queryInterface, 'KeywordingEvidenceSpans', 'recordDocumentId', {
      allowNull: true,
      type: Sequelize.INTEGER,
      references: {
        model: 'RecordDocuments',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addColumn(queryInterface, 'KeywordingEvidenceSpans', 'documentChunkId', {
      allowNull: true,
      type: Sequelize.INTEGER,
      references: {
        model: 'DocumentChunks',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addColumn(queryInterface, 'KeywordingEvidenceSpans', 'chunkKey', {
      allowNull: true,
      type: Sequelize.STRING,
    });
    await addColumn(queryInterface, 'KeywordingEvidenceSpans', 'headingPath', {
      allowNull: true,
      type: Sequelize.JSON,
    });

    await queryInterface.addIndex('KeywordingEvidenceSpans', ['recordDocumentId'], {
      name: 'keywording_evidence_spans_record_document_idx',
    });
    await queryInterface.addIndex('KeywordingEvidenceSpans', ['documentChunkId'], {
      name: 'keywording_evidence_spans_document_chunk_idx',
    });

    await queryInterface.createTable('KeywordingClusters', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      keywordingJobId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: {
          model: 'KeywordingJobs',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      mappingQuestionId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        references: {
          model: 'MappingQuestions',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      clusterKey: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      label: {
        allowNull: true,
        type: Sequelize.STRING,
      },
      actionType: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      confidence: {
        allowNull: false,
        type: Sequelize.INTEGER,
      },
      rationale: {
        allowNull: false,
        type: Sequelize.TEXT,
      },
      existingOptionIds: {
        allowNull: true,
        type: Sequelize.JSON,
      },
      proposedOptionLabels: {
        allowNull: true,
        type: Sequelize.JSON,
      },
      supportingRecordIds: {
        allowNull: true,
        type: Sequelize.JSON,
      },
      supportingChunkKeys: {
        allowNull: true,
        type: Sequelize.JSON,
      },
      supportingEvidence: {
        allowNull: true,
        type: Sequelize.JSON,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.addIndex('KeywordingClusters', ['keywordingJobId'], {
      name: 'keywording_clusters_job_idx',
    });
    await queryInterface.addIndex('KeywordingClusters', ['mappingQuestionId'], {
      name: 'keywording_clusters_question_idx',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('KeywordingClusters');
    await queryInterface.removeColumn('KeywordingEvidenceSpans', 'headingPath');
    await queryInterface.removeColumn('KeywordingEvidenceSpans', 'chunkKey');
    await queryInterface.removeColumn('KeywordingEvidenceSpans', 'documentChunkId');
    await queryInterface.removeColumn('KeywordingEvidenceSpans', 'recordDocumentId');
    await queryInterface.removeColumn('KeywordingSuggestions', 'reviewerNote');
    await queryInterface.removeColumn('KeywordingSuggestions', 'actionType');
    await queryInterface.dropTable('DocumentChunks');
    await queryInterface.removeColumn('RecordDocuments', 'extractionWarnings');
    await queryInterface.removeColumn('RecordDocuments', 'ocrConfidence');
    await queryInterface.removeColumn('RecordDocuments', 'ocrUsed');
    await queryInterface.removeColumn('RecordDocuments', 'weirdCharacterRatio');
    await queryInterface.removeColumn('RecordDocuments', 'printableTextRatio');
    await queryInterface.removeColumn('RecordDocuments', 'qualityScore');
    await queryInterface.removeColumn('RecordDocuments', 'qualityStatus');
    await queryInterface.removeColumn('RecordDocuments', 'chunkManifestPath');
    await queryInterface.removeColumn('RecordDocuments', 'structuredDocumentPath');
    await queryInterface.removeColumn('RecordDocuments', 'extractorVersion');
    await queryInterface.removeColumn('RecordDocuments', 'extractorKind');
    await queryInterface.removeColumn('RecordDocuments', 'pageCount');
    await queryInterface.removeColumn('RecordDocuments', 'sourceType');
    await queryInterface.removeColumn('MappingQuestions', 'allowNewOption');
    await queryInterface.removeColumn('MappingQuestions', 'evidenceInstructions');
    await queryInterface.removeColumn('MappingQuestions', 'negativeExamples');
    await queryInterface.removeColumn('MappingQuestions', 'positiveExamples');
    await queryInterface.removeColumn('MappingQuestions', 'decisionGuidance');
    await queryInterface.removeColumn('MappingQuestions', 'description');
  },
};
