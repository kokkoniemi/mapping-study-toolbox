'use strict';
module.exports = (sequelize, DataTypes) => {
  const Record = sequelize.define('Record', {
    title: DataTypes.TEXT,
    url: DataTypes.STRING,
    author: DataTypes.STRING,
    description: DataTypes.TEXT,
    status: DataTypes.STRING,
    abstract: DataTypes.TEXT
  }, {});
  Record.associate = function(models) {
    // associations can be defined here
  };
  return Record;
};