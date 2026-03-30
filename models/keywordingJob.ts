import type { Sequelize } from "sequelize";

import type { DbModels, KeywordingJobModelStatic, ModelFactory } from "./types";

const defineKeywordingJob: ModelFactory<KeywordingJobModelStatic> = (
  sequelize: Sequelize,
  DataTypes,
) => {
  const KeywordingJob = sequelize.define(
    "KeywordingJob",
    {
      jobId: DataTypes.STRING,
      status: DataTypes.STRING,
      cancelRequested: DataTypes.BOOLEAN,
      recordIds: DataTypes.JSON,
      mappingQuestionIds: DataTypes.JSON,
      total: DataTypes.INTEGER,
      processed: DataTypes.INTEGER,
      summary: DataTypes.JSON,
      reportPath: DataTypes.STRING,
      latestError: DataTypes.TEXT,
      startedAt: DataTypes.DATE,
      finishedAt: DataTypes.DATE,
    },
    {
      paranoid: false,
    },
  ) as KeywordingJobModelStatic;

  KeywordingJob.associate = (models: DbModels) => {
    KeywordingJob.hasMany(models.KeywordingSuggestion, { foreignKey: "keywordingJobId" });
  };

  return KeywordingJob;
};

export default defineKeywordingJob;
