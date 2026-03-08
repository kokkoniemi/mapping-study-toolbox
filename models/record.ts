import type { Sequelize } from "sequelize";

const defineRecord = (sequelize: Sequelize, DataTypes: any) => {
  const Record: any = sequelize.define(
    "Record",
    {
      title: DataTypes.TEXT,
      url: DataTypes.STRING,
      author: DataTypes.STRING,
      description: DataTypes.TEXT,
      status: DataTypes.STRING, // null,"excluded","included","uncertain"
      abstract: DataTypes.TEXT,
      databases: DataTypes.JSON, // JSON array
      alternateUrls: DataTypes.JSON, // JSON array
      editedBy: DataTypes.STRING,
      comment: DataTypes.TEXT,
    },
    {
      paranoid: true,
    },
  );

  Record.associate = (models: any) => {
    Record.belongsTo(models.Publication);
    Record.belongsToMany(models.MappingOption, { through: models.RecordMappingOption });
  };

  /**
   * Fetches all records that have matching search_urls either in url-field or
   * as an entry in json-array in alternateUrls
   */
  Record.getAllByUrls = async (searchUrls: string[]) => {
    if (!Array.isArray(searchUrls)) {
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
        replacements: { urls: searchUrls },
        type: (sequelize as any).QueryTypes.SELECT,
        model: Record,
        mapToModel: true,
      },
    );

    return recordInstances;
  };

  return Record;
};

export default defineRecord;
