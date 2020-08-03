'use strict';
module.exports = (sequelize, DataTypes) => {
    const MappingQuestion = sequelize.define('MappingQuestion', {
        title: DataTypes.STRING,
        type: { type: DataTypes.STRING, defaultValue: 'multiSelect' },
        position: { type: DataTypes.INTEGER, defaultValue: 0 },
    }, {
        paranoid: true
    });
    MappingQuestion.associate = function (models) {
        // associations can be defined here
        MappingQuestion.hasMany(models.MappingOption);
    };
    return MappingQuestion;
};