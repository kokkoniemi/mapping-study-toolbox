'use strict';
module.exports = (sequelize, DataTypes) => {
  const Record = sequelize.define('Record', {
    title: DataTypes.TEXT,
    url: DataTypes.STRING,
    author: DataTypes.STRING,
    description: DataTypes.TEXT,
    status: DataTypes.STRING,
    abstract: DataTypes.TEXT,
    databases: DataTypes.JSON,
  }, {});

  Record.associate = function (models) {
    // associations can be defined here
  };

  /**
   * Fetches all records that have matching search_url either in url-field or
   * as an entry in json-array in alternateUrls
   */
  Record.getAllByUrl = async function (search_url) {
    const recordInstances = await sequelize.query(
      `
      SELECT Records.* FROM Records WHERE url LIKE ? 
      UNION
      SELECT Records.*
        FROM Records, json_each(Records.alternateUrls)
      WHERE json_valid(Records.alternateUrls)
        AND json_each.value LIKE ?
      `,
      {
        replacements: [search_url, search_url],
        type: sequelize.QueryTypes.SELECT
      }
    );
    return recordInstances;
  }
  return Record;
};