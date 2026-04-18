const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config(); // Ensure env variables are loaded

let sequelize;
if (process.env.DATABASE_URL) {
  // Production (e.g. Render, Railway) uses PostgreSQL
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    logging: false
  });
} else {
  // Serverless Vercel environment uses purely IN-MEMORY sqlite
  // This bypasses ALL Read-Only file system errors 
  const storagePath = process.env.VERCEL ? ':memory:' : path.join(__dirname, '..', 'database.sqlite');
  
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: storagePath,
    logging: false,
  });
}

const User = require('./User')(sequelize);
const Design = require('./Design')(sequelize);
const Feedback = require('./Feedback')(sequelize);
const Notification = require('./Notification')(sequelize);

// Associations
User.hasMany(Design, { foreignKey: 'userId', as: 'designs' });
Design.belongsTo(User, { foreignKey: 'userId', as: 'author' });

User.hasMany(Feedback, { foreignKey: 'userId', as: 'feedbacks' });
Feedback.belongsTo(User, { foreignKey: 'userId', as: 'reviewer' });

Design.hasMany(Feedback, { foreignKey: 'designId', as: 'feedbacks' });
Feedback.belongsTo(Design, { foreignKey: 'designId', as: 'design' });

User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = { sequelize, User, Design, Feedback, Notification };
