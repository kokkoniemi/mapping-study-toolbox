import type { Sequelize } from "sequelize";

import type { DbModels, MappingOptionModelStatic, ModelFactory } from "./types";

const defineMappingOption: ModelFactory<MappingOptionModelStatic> = (
  sequelize: Sequelize,
  DataTypes,
) => {
  const MappingOption = sequelize.define(
    "MappingOption",
    {
      title: DataTypes.STRING,
      position: DataTypes.INTEGER,
      color: DataTypes.STRING,
      mappingQuestionId: DataTypes.INTEGER,
    },
    {
      paranoid: true,
    },
  ) as MappingOptionModelStatic;

  MappingOption.associate = (models: DbModels) => {
    MappingOption.belongsTo(models.MappingQuestion);
    MappingOption.belongsToMany(models.Record, { through: models.RecordMappingOption });
    MappingOption.belongsToMany(models.RecordAssessment, {
      as: "AssessmentRecords",
      through: models.RecordAssessmentOption,
      foreignKey: "mappingOptionId",
      otherKey: "recordAssessmentId",
    });
    MappingOption.hasMany(models.RecordAssessmentOption, { foreignKey: "mappingOptionId" });
  };

  return MappingOption;
};

export default defineMappingOption;
