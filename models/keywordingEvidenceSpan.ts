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
      pageStart: DataTypes.INTEGER,
      pageEnd: DataTypes.INTEGER,
      sectionName: DataTypes.STRING,
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
  };

  return KeywordingEvidenceSpan;
};

export default defineKeywordingEvidenceSpan;
