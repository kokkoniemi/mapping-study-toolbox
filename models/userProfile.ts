import type { Sequelize } from "sequelize";

import type { DbModels, ModelFactory, UserProfileModelStatic } from "./types";

const defineUserProfile: ModelFactory<UserProfileModelStatic> = (sequelize: Sequelize, DataTypes) => {
  const UserProfile = sequelize.define(
    "UserProfile",
    {
      name: DataTypes.STRING,
      isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    },
    {
      paranoid: false,
    },
  ) as UserProfileModelStatic;

  UserProfile.associate = (models: DbModels) => {
    UserProfile.hasMany(models.RecordAssessment, { foreignKey: "userId" });
  };

  return UserProfile;
};

export default defineUserProfile;
