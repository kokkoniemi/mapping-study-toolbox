'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const basename = path.basename(__filename);

const env = process.env.NODE_ENV || 'development';
const configCandidates = [
    path.join(__dirname, '..', 'config', 'config.json'),
    path.join(path.dirname(process.execPath), 'config', 'config.json'),
    // Backward compatibility with older setups
    path.join(__dirname, '..', 'db-config.json'),
    path.join(path.dirname(process.execPath), 'db-config.json'),
];

const configPath = configCandidates.find(p => fs.existsSync(p));
if (!configPath) {
    throw new Error(
        "No database config found. Expected config/config.json (preferred) or db-config.json (legacy)."
    );
}

const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const config = rawConfig[env] || rawConfig.development || rawConfig;
const db = {};

let sequelize;
if (config.use_env_variable) {
    sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
    sequelize = new Sequelize(config.database, config.username, config.password, config);
}

fs
    .readdirSync(__dirname)
    .filter(file => {
        return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js');
    })
    .forEach(file => {
        const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
        db[model.name] = model;
    });

Object.keys(db).forEach(modelName => {
    if (db[modelName].associate) {
        db[modelName].associate(db);
    }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
