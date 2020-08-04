'use strict';
module.exports = (sequelize, DataTypes) => {
    const Import = sequelize.define('Import', {
        database: DataTypes.STRING,     // Where is the data scraped from
        total: DataTypes.INTEGER,       // How many items were scraped
        dublicates: DataTypes.INTEGER,  // How many dublicates were found
        namesakes: DataTypes.JSON,      // JSON array. Namesakes may be dublicates
        query: DataTypes.TEXT,          // What search query were used?
    }, {
        paranoid: true
    });
    Import.associate = function (models) {
        // associations can be defined here
    };
    return Import;
};