import type { Sequelize } from "sequelize";

import type { DbModels, KeywordingClusterModelStatic, ModelFactory } from "./types";

const defineKeywordingCluster: ModelFactory<KeywordingClusterModelStatic> = (
  sequelize: Sequelize,
  DataTypes,
) => {
  const KeywordingCluster = sequelize.define(
    "KeywordingCluster",
    {
      keywordingJobId: DataTypes.INTEGER,
      mappingQuestionId: DataTypes.INTEGER,
      clusterKey: DataTypes.STRING,
      label: DataTypes.STRING,
      actionType: DataTypes.STRING,
      topicId: DataTypes.INTEGER,
      parentTopicId: DataTypes.INTEGER,
      isOutlier: DataTypes.BOOLEAN,
      topTerms: DataTypes.JSON,
      representativeChunkKeys: DataTypes.JSON,
      representationSource: DataTypes.STRING,
      topicSize: DataTypes.INTEGER,
      confidence: DataTypes.INTEGER,
      rationale: DataTypes.TEXT,
      existingOptionIds: DataTypes.JSON,
      proposedOptionLabels: DataTypes.JSON,
      supportingRecordIds: DataTypes.JSON,
      supportingChunkKeys: DataTypes.JSON,
      supportingEvidence: DataTypes.JSON,
    },
    {
      paranoid: false,
    },
  ) as KeywordingClusterModelStatic;

  KeywordingCluster.associate = (models: DbModels) => {
    KeywordingCluster.belongsTo(models.KeywordingJob, { foreignKey: "keywordingJobId" });
    KeywordingCluster.belongsTo(models.MappingQuestion, { foreignKey: "mappingQuestionId" });
  };

  return KeywordingCluster;
};

export default defineKeywordingCluster;
