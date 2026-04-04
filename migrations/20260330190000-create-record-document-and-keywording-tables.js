'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('RecordDocuments', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER,
            },
            recordId: {
                allowNull: false,
                type: Sequelize.INTEGER,
                references: {
                    model: 'Records',
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            originalFileName: {
                allowNull: false,
                type: Sequelize.STRING,
            },
            storedPath: {
                allowNull: false,
                type: Sequelize.STRING,
            },
            mimeType: {
                allowNull: false,
                type: Sequelize.STRING,
            },
            checksum: {
                allowNull: false,
                type: Sequelize.STRING,
            },
            fileSize: {
                allowNull: false,
                type: Sequelize.INTEGER,
            },
            uploadStatus: {
                allowNull: false,
                type: Sequelize.STRING,
                defaultValue: 'uploaded',
            },
            extractionStatus: {
                allowNull: false,
                type: Sequelize.STRING,
                defaultValue: 'pending',
            },
            extractedTextPath: {
                allowNull: true,
                type: Sequelize.STRING,
            },
            extractionError: {
                allowNull: true,
                type: Sequelize.TEXT,
            },
            isActive: {
                allowNull: false,
                type: Sequelize.BOOLEAN,
                defaultValue: true,
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

        await queryInterface.addIndex('RecordDocuments', ['recordId'], {
            name: 'record_documents_record_idx',
        });
        await queryInterface.addIndex('RecordDocuments', ['recordId', 'isActive'], {
            name: 'record_documents_record_active_idx',
        });

        await queryInterface.createTable('KeywordingJobs', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER,
            },
            jobId: {
                allowNull: false,
                type: Sequelize.STRING,
            },
            status: {
                allowNull: false,
                type: Sequelize.STRING,
            },
            cancelRequested: {
                allowNull: false,
                type: Sequelize.BOOLEAN,
                defaultValue: false,
            },
            recordIds: {
                allowNull: false,
                type: Sequelize.JSON,
            },
            mappingQuestionIds: {
                allowNull: false,
                type: Sequelize.JSON,
            },
            total: {
                allowNull: false,
                type: Sequelize.INTEGER,
                defaultValue: 0,
            },
            processed: {
                allowNull: false,
                type: Sequelize.INTEGER,
                defaultValue: 0,
            },
            summary: {
                allowNull: true,
                type: Sequelize.JSON,
            },
            reportPath: {
                allowNull: true,
                type: Sequelize.STRING,
            },
            latestError: {
                allowNull: true,
                type: Sequelize.TEXT,
            },
            startedAt: {
                allowNull: true,
                type: Sequelize.DATE,
            },
            finishedAt: {
                allowNull: true,
                type: Sequelize.DATE,
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

        await queryInterface.addIndex('KeywordingJobs', ['jobId'], {
            unique: true,
            name: 'keywording_jobs_job_id_unique',
        });
        await queryInterface.addIndex('KeywordingJobs', ['status'], {
            name: 'keywording_jobs_status_idx',
        });

        await queryInterface.createTable('KeywordingSuggestions', {
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
            recordId: {
                allowNull: false,
                type: Sequelize.INTEGER,
                references: {
                    model: 'Records',
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
            decisionType: {
                allowNull: false,
                type: Sequelize.STRING,
            },
            existingOptionId: {
                allowNull: true,
                type: Sequelize.INTEGER,
                references: {
                    model: 'MappingOptions',
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL',
            },
            proposedOptionLabel: {
                allowNull: true,
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
            createdAt: {
                allowNull: false,
                type: Sequelize.DATE,
            },
            updatedAt: {
                allowNull: false,
                type: Sequelize.DATE,
            },
        });

        await queryInterface.addIndex('KeywordingSuggestions', ['keywordingJobId'], {
            name: 'keywording_suggestions_job_idx',
        });
        await queryInterface.addIndex('KeywordingSuggestions', ['recordId'], {
            name: 'keywording_suggestions_record_idx',
        });

        await queryInterface.createTable('KeywordingEvidenceSpans', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER,
            },
            keywordingSuggestionId: {
                allowNull: false,
                type: Sequelize.INTEGER,
                references: {
                    model: 'KeywordingSuggestions',
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
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
            excerptText: {
                allowNull: false,
                type: Sequelize.TEXT,
            },
            rank: {
                allowNull: false,
                type: Sequelize.INTEGER,
                defaultValue: 1,
            },
            score: {
                allowNull: true,
                type: Sequelize.FLOAT,
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

        await queryInterface.addIndex('KeywordingEvidenceSpans', ['keywordingSuggestionId'], {
            name: 'keywording_evidence_spans_suggestion_idx',
        });
    },

    down: async (queryInterface) => {
        await queryInterface.dropTable('KeywordingEvidenceSpans');
        await queryInterface.dropTable('KeywordingSuggestions');
        await queryInterface.dropTable('KeywordingJobs');
        await queryInterface.dropTable('RecordDocuments');
    },
};
