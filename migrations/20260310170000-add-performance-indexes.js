'use strict';

const INDEX_DEFINITIONS = [
    {
        table: 'Records',
        fields: ['status'],
        name: 'records_status_idx',
    },
    {
        table: 'Records',
        fields: ['forumId'],
        name: 'records_forum_id_idx',
    },
    {
        table: 'Records',
        fields: ['createdAt'],
        name: 'records_created_at_idx',
    },
    {
        table: 'Records',
        fields: ['updatedAt'],
        name: 'records_updated_at_idx',
    },
    {
        table: 'RecordMappingOptions',
        fields: ['recordId'],
        name: 'record_mapping_options_record_id_idx',
    },
    {
        table: 'RecordMappingOptions',
        fields: ['mappingQuestionId'],
        name: 'record_mapping_options_mapping_question_id_idx',
    },
    {
        table: 'RecordMappingOptions',
        fields: ['mappingOptionId'],
        name: 'record_mapping_options_mapping_option_id_idx',
    },
];

const ensureIndex = async (queryInterface, definition) => {
    const indexes = await queryInterface.showIndex(definition.table);
    const exists = indexes.some((index) => index.name === definition.name);
    if (!exists) {
        await queryInterface.addIndex(definition.table, definition.fields, {
            name: definition.name,
        });
    }
};

const removeIndexIfExists = async (queryInterface, definition) => {
    const indexes = await queryInterface.showIndex(definition.table);
    const exists = indexes.some((index) => index.name === definition.name);
    if (exists) {
        await queryInterface.removeIndex(definition.table, definition.name);
    }
};

module.exports = {
    up: async (queryInterface) => {
        for (const definition of INDEX_DEFINITIONS) {
            await ensureIndex(queryInterface, definition);
        }
    },

    down: async (queryInterface) => {
        for (const definition of INDEX_DEFINITIONS) {
            await removeIndexIfExists(queryInterface, definition);
        }
    },
};
