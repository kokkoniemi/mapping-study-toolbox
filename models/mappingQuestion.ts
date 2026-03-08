import type { Sequelize } from "sequelize";

const defineMappingQuestion = (sequelize: Sequelize, DataTypes: any) => {
  const MappingQuestion: any = sequelize.define(
    "MappingQuestion",
    {
      title: DataTypes.STRING,
      type: { type: DataTypes.STRING, defaultValue: "multiSelect" },
      position: { type: DataTypes.INTEGER, defaultValue: 0 },
    },
    {
      paranoid: true,
    },
  );

  MappingQuestion.associate = (models: any) => {
    MappingQuestion.hasMany(models.MappingOption);
  };

  return MappingQuestion;
};

export default defineMappingQuestion;
