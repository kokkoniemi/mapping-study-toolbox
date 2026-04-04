import type { Sequelize } from "sequelize";

import type { DbModels, DocumentChunkModelStatic, ModelFactory } from "./types";

const defineDocumentChunk: ModelFactory<DocumentChunkModelStatic> = (
  sequelize: Sequelize,
  DataTypes,
) => {
  const DocumentChunk = sequelize.define(
    "DocumentChunk",
    {
      recordDocumentId: DataTypes.INTEGER,
      chunkKey: DataTypes.STRING,
      chunkIndex: DataTypes.INTEGER,
      pageStart: DataTypes.INTEGER,
      pageEnd: DataTypes.INTEGER,
      sectionName: DataTypes.STRING,
      headingPath: DataTypes.JSON,
      text: DataTypes.TEXT,
      charCount: DataTypes.INTEGER,
      tokenCount: DataTypes.INTEGER,
      embeddingReference: DataTypes.STRING,
      embeddingModel: DataTypes.STRING,
      embeddingTask: DataTypes.STRING,
      embeddingVersion: DataTypes.STRING,
      embeddingChecksum: DataTypes.STRING,
      embeddingGeneratedAt: DataTypes.DATE,
      qualityScore: DataTypes.FLOAT,
      qualityFlags: DataTypes.JSON,
    },
    {
      paranoid: false,
    },
  ) as DocumentChunkModelStatic;

  DocumentChunk.associate = (models: DbModels) => {
    DocumentChunk.belongsTo(models.RecordDocument, { foreignKey: "recordDocumentId" });
    DocumentChunk.hasMany(models.KeywordingEvidenceSpan, { foreignKey: "documentChunkId" });
  };

  return DocumentChunk;
};

export default defineDocumentChunk;
