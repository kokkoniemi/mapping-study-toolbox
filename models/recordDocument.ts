import type { Sequelize } from "sequelize";

import type { DbModels, ModelFactory, RecordDocumentModelStatic } from "./types";

const defineRecordDocument: ModelFactory<RecordDocumentModelStatic> = (
  sequelize: Sequelize,
  DataTypes,
) => {
  const RecordDocument = sequelize.define(
    "RecordDocument",
    {
      recordId: DataTypes.INTEGER,
      originalFileName: DataTypes.STRING,
      storedPath: DataTypes.STRING,
      mimeType: DataTypes.STRING,
      checksum: DataTypes.STRING,
      fileSize: DataTypes.INTEGER,
      uploadStatus: DataTypes.STRING,
      extractionStatus: DataTypes.STRING,
      extractedTextPath: DataTypes.STRING,
      extractionError: DataTypes.TEXT,
      isActive: DataTypes.BOOLEAN,
    },
    {
      paranoid: false,
    },
  ) as RecordDocumentModelStatic;

  RecordDocument.associate = (models: DbModels) => {
    RecordDocument.belongsTo(models.Record, { foreignKey: "recordId" });
  };

  return RecordDocument;
};

export default defineRecordDocument;
