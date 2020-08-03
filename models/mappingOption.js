'use strict';
module.exports = (sequelize, DataTypes) => {
    const MappingOption = sequelize.define('MappingOption', {
        title: DataTypes.STRING,
        position: DataTypes.INTEGER,
        color: DataTypes.STRING,
        mappingQuestionId: DataTypes.INTEGER
    }, {
        paranoid: true
    });
    MappingOption.associate = function (models) {
        // associations can be defined here
        MappingOption.belongsTo(models.MappingQuestion);
        MappingOption.belongsToMany(models.Record, { through: models.RecordMappingOption });
    };
    return MappingOption;
};