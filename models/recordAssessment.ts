import type { Sequelize } from "sequelize";

import type { DbModels, ModelFactory, RecordAssessmentModelStatic } from "./types";

const defineRecordAssessment: ModelFactory<RecordAssessmentModelStatic> = (
  sequelize: Sequelize,
  DataTypes,
) => {
  const RecordAssessment = sequelize.define(
    "RecordAssessment",
    {
      recordId: DataTypes.INTEGER,
      userId: DataTypes.INTEGER,
      status: DataTypes.STRING,
      comment: DataTypes.TEXT,
    },
    {
      paranoid: false,
    },
  ) as RecordAssessmentModelStatic;

  RecordAssessment.associate = (models: DbModels) => {
    RecordAssessment.belongsTo(models.Record, { foreignKey: "recordId" });
    RecordAssessment.belongsTo(models.UserProfile, { foreignKey: "userId" });
    RecordAssessment.belongsToMany(models.MappingOption, {
      as: "AssessmentMappingOptions",
      through: models.RecordAssessmentOption,
      foreignKey: "recordAssessmentId",
      otherKey: "mappingOptionId",
    });
    RecordAssessment.hasMany(models.RecordAssessmentOption, { foreignKey: "recordAssessmentId" });
  };

  return RecordAssessment;
};

export default defineRecordAssessment;
