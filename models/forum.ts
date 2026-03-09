import type { Sequelize } from "sequelize";

import type { DbModels, ForumModelStatic, ModelFactory } from "./types";

const defineForum: ModelFactory<ForumModelStatic> = (sequelize: Sequelize, DataTypes) => {
  const Forum = sequelize.define(
    "Forum",
    {
      name: DataTypes.STRING,
      alternateNames: DataTypes.JSON,
      jufoLevel: DataTypes.INTEGER,
      database: DataTypes.STRING,
      publisher: DataTypes.STRING,
    },
    {
      paranoid: true,
    },
  ) as ForumModelStatic;

  Forum.associate = (models: DbModels) => {
    Forum.hasMany(models.Record, { foreignKey: "forumId" });
  };

  return Forum;
};

export default defineForum;
