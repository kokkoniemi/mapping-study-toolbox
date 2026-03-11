import type { Sequelize } from "sequelize";

import type { DbModels, ImportModelStatic, ModelFactory } from "./types";

const defineImport: ModelFactory<ImportModelStatic> = (sequelize: Sequelize, DataTypes) => {
  const Import = sequelize.define(
    "Import",
    {
      database: DataTypes.STRING, // Where is the data scraped from
      source: DataTypes.STRING, // User-selected/detected source
      format: DataTypes.STRING, // csv | bibtex
      fileName: DataTypes.STRING, // Original imported file name
      total: DataTypes.INTEGER, // How many items were scraped
      imported: DataTypes.INTEGER, // How many records were imported
      dublicates: DataTypes.INTEGER, // How many dublicates were found
      namesakes: DataTypes.JSON, // JSON array. Namesakes may be dublicates
      query: DataTypes.TEXT, // What search query were used?
    },
    {
      paranoid: true,
    },
  ) as ImportModelStatic;

  Import.associate = (models: DbModels) => {
    Import.hasMany(models.Record, { foreignKey: "importId" });
  };

  return Import;
};

export default defineImport;
