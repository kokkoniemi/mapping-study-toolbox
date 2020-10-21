'use strict';
module.exports = (sequelize, DataTypes) => {
    const ActivityLog = sequelize.define('ActivityLog', {
        recordId: DataTypes.INTEGER,
        description: DataTypes.STRING
    }, {
        paranoid: false
    });
    ActivityLog.associate = function (models) {
        // associations can be defined here
        ActivityLog.belongsTo(models.Record);
    };
    return ActivityLog;
};