'use strict';
module.exports = (sequelize, DataTypes) => {
    const Publication = sequelize.define('Publication', {
        name: DataTypes.STRING,
        alternateNames: DataTypes.JSON,
        jufoLevel: DataTypes.INTEGER,
        database: DataTypes.STRING
    }, {
        paranoid: true
    });
    Publication.associate = function (models) {
        // associations can be defined here
        Publication.hasMany(models.Record);
    };
    return Publication;
};