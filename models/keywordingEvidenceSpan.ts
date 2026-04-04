import type { Sequelize } from "sequelize";

import type { DbModels, KeywordingEvidenceSpanModelStatic, ModelFactory } from "./types";

const defineKeywordingEvidenceSpan: ModelFactory<KeywordingEvidenceSpanModelStatic> = (
  sequelize: Sequelize,
  DataTypes,
) => {
  const KeywordingEvidenceSpan = sequelize.define(
    "KeywordingEvidenceSpan",
    {
      keywordingSuggestionId: DataTypes.INTEGER,
      recordDocumentId: DataTypes.INTEGER,
      documentChunkId: DataTypes.INTEGER,
      chunkKey: DataTypes.STRING,
      pageStart: DataTypes.INTEGER,
      pageEnd: DataTypes.INTEGER,
      sectionName: DataTypes.STRING,
      headingPath: DataTypes.JSON,
      excerptText: DataTypes.TEXT,
      rank: DataTypes.INTEGER,
      score: DataTypes.FLOAT,
    },
    {
      paranoid: false,
    },
  ) as KeywordingEvidenceSpanModelStatic;

  KeywordingEvidenceSpan.associate = (models: DbModels) => {
    KeywordingEvidenceSpan.belongsTo(models.KeywordingSuggestion, { foreignKey: "keywordingSuggestionId" });
    KeywordingEvidenceSpan.belongsTo(models.RecordDocument, { foreignKey: "recordDocumentId" });
    KeywordingEvidenceSpan.belongsTo(models.DocumentChunk, { foreignKey: "documentChunkId" });
  };

  return KeywordingEvidenceSpan;
};

export default defineKeywordingEvidenceSpan;
