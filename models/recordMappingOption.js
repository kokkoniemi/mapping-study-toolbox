'use strict';
module.exports = (sequelize, DataTypes) => {
    const RecordMappingOption = sequelize.define('RecordMappingOption', {
        recordId: DataTypes.INTEGER,
        mappingQuestionId: DataTypes.INTEGER,
        mappingOptionId: DataTypes.INTEGER
    }, {
        paranoid: false
    });
    RecordMappingOption.associate = function (models) {
        // associations can be defined here
        RecordMappingOption.belongsTo(models.Record);
        RecordMappingOption.belongsTo(models.MappingQuestion);
        RecordMappingOption.belongsTo(models.MappingOption);
    };
    return RecordMappingOption;
};