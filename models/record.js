'use strict';
module.exports = (sequelize, DataTypes) => {
  const Record = sequelize.define('Record', {
    title: DataTypes.TEXT,
    url: DataTypes.STRING,
    author: DataTypes.STRING,
    description: DataTypes.TEXT,
    status: DataTypes.STRING,       // null,"excluded","included","uncertain"
    abstract: DataTypes.TEXT,
    databases: DataTypes.JSON,      // JSON array
    alternateUrls: DataTypes.JSON,  // JSON array
    editedBy: DataTypes.STRING
  }, {
    paranoid: true
  });

  Record.associate = function (models) {
    Record.belongsTo(models.Publication);
  };

  /**
   * Fetches all records that have matching search_urls either in url-field or
   * as an entry in json-array in alternateUrls
   */
  Record.getAllByUrls = async function (search_urls) {
    if (!Array.isArray(search_urls)) {
      throw new Error("Search urls must be an array");
    }
    const recordInstances = await sequelize.query(
      `
      SELECT Records.* FROM Records WHERE url IN (:urls) AND deletedAt IS NULL
      UNION
      SELECT Records.*
        FROM Records, json_each(Records.alternateUrls)
      WHERE json_valid(Records.alternateUrls)
        AND json_each.value IN (:urls) 
        AND Records.deletedAt IS NULL
      `,
      {
        replacements: { urls: search_urls },
        type: sequelize.QueryTypes.SELECT,
        model: Record,
        mapToModel: true
      }
    );
    return recordInstances;
  }
  return Record;
};