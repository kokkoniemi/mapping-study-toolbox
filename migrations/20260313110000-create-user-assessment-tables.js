'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('UserProfiles', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER,
            },
            name: {
                allowNull: false,
                type: Sequelize.STRING,
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

        await queryInterface.addIndex('UserProfiles', ['name'], {
            unique: true,
            name: 'user_profiles_name_unique',
        });

        await queryInterface.createTable('RecordAssessments', {
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
            userId: {
                allowNull: false,
                type: Sequelize.INTEGER,
                references: {
                    model: 'UserProfiles',
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            status: {
                allowNull: true,
                type: Sequelize.STRING,
            },
            comment: {
                allowNull: true,
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

        await queryInterface.addIndex('RecordAssessments', ['recordId', 'userId'], {
            unique: true,
            name: 'record_assessments_record_user_unique',
        });
        await queryInterface.addIndex('RecordAssessments', ['userId'], {
            name: 'record_assessments_user_idx',
        });
        await queryInterface.addIndex('RecordAssessments', ['recordId'], {
            name: 'record_assessments_record_idx',
        });

        await queryInterface.createTable('RecordAssessmentOptions', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: Sequelize.INTEGER,
            },
            recordAssessmentId: {
                allowNull: false,
                type: Sequelize.INTEGER,
                references: {
                    model: 'RecordAssessments',
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            mappingOptionId: {
                allowNull: false,
                type: Sequelize.INTEGER,
                references: {
                    model: 'MappingOptions',
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
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

        await queryInterface.addIndex('RecordAssessmentOptions', ['recordAssessmentId', 'mappingOptionId'], {
            unique: true,
            name: 'record_assessment_options_assessment_option_unique',
        });
        await queryInterface.addIndex('RecordAssessmentOptions', ['mappingOptionId'], {
            name: 'record_assessment_options_option_idx',
        });
    },

    down: async (queryInterface) => {
        await queryInterface.dropTable('RecordAssessmentOptions');
        await queryInterface.dropTable('RecordAssessments');
        await queryInterface.dropTable('UserProfiles');
    },
};
