import { QueryTypes, type Sequelize } from "sequelize";

import type { DbModels, ModelFactory, RecordModelStatic } from "./types";

const defineRecord: ModelFactory<RecordModelStatic> = (sequelize: Sequelize, DataTypes) => {
  const Record = sequelize.define(
    "Record",
    {
      title: DataTypes.TEXT,
      url: DataTypes.STRING,
      author: DataTypes.STRING,
      year: DataTypes.INTEGER,
      status: DataTypes.STRING, // null,"excluded","included","uncertain"
      abstract: DataTypes.TEXT,
      databases: DataTypes.JSON, // JSON array
      alternateUrls: DataTypes.JSON, // JSON array
      enrichmentProvenance: DataTypes.JSON,
      forumId: DataTypes.INTEGER,
      doi: DataTypes.STRING,
      authorDetails: DataTypes.JSON, // normalized Crossref author objects
      referenceItems: DataTypes.JSON, // normalized Crossref references
      crossrefEnrichedAt: DataTypes.DATE,
      crossrefLastError: DataTypes.TEXT,
      openAlexId: DataTypes.STRING,
      citationCount: DataTypes.INTEGER,
      openAlexReferenceItems: DataTypes.JSON, // normalized OpenAlex references
      openAlexCitationItems: DataTypes.JSON, // normalized OpenAlex citations
      openAlexTopicItems: DataTypes.JSON, // normalized OpenAlex topics
      openAlexAuthorAffiliations: DataTypes.JSON, // flattened affiliation names
      openAlexEnrichedAt: DataTypes.DATE,
      openAlexLastError: DataTypes.TEXT,
      editedBy: DataTypes.STRING,
      comment: DataTypes.TEXT,
    },
    {
      paranoid: true,
    },
  ) as RecordModelStatic;

  Record.associate = (models: DbModels) => {
    Record.belongsTo(models.Forum, { foreignKey: "forumId" });
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
        type: QueryTypes.SELECT,
        model: Record,
        mapToModel: true,
      },
    );

    return recordInstances as Awaited<ReturnType<RecordModelStatic["getAllByUrls"]>>;
  };

  return Record;
};

export default defineRecord;
