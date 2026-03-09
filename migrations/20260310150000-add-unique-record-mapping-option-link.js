'use strict';

const UNIQUE_INDEX_NAME = 'record_mapping_options_record_id_mapping_option_id_unique';

module.exports = {
    up: async (queryInterface) => {
        await queryInterface.sequelize.query(`
            DELETE FROM \`RecordMappingOptions\`
            WHERE \`id\` NOT IN (
                SELECT MIN(\`id\`)
                FROM \`RecordMappingOptions\`
                GROUP BY \`recordId\`, \`mappingOptionId\`
            );
        `);

        const indexes = await queryInterface.showIndex('RecordMappingOptions');
        const exists = indexes.some((index) => index.name === UNIQUE_INDEX_NAME);
        if (!exists) {
            await queryInterface.addIndex('RecordMappingOptions', ['recordId', 'mappingOptionId'], {
                name: UNIQUE_INDEX_NAME,
                unique: true,
            });
        }
    },

    down: async (queryInterface) => {
        const indexes = await queryInterface.showIndex('RecordMappingOptions');
        const exists = indexes.some((index) => index.name === UNIQUE_INDEX_NAME);
        if (exists) {
            await queryInterface.removeIndex('RecordMappingOptions', UNIQUE_INDEX_NAME);
        }
    },
};
