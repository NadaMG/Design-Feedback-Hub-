const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('User', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    email: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    fullName: { type: DataTypes.STRING(100), allowNull: true },
    bio: { type: DataTypes.TEXT, allowNull: true },
    skills: { type: DataTypes.STRING, allowNull: true, defaultValue: '' },
    level: {
      type: DataTypes.ENUM('Beginner', 'Intermediate', 'Advanced', 'Expert'),
      defaultValue: 'Beginner'
    },
    avatar: { type: DataTypes.STRING, allowNull: true },
    totalFeedbackGiven: { type: DataTypes.INTEGER, defaultValue: 0 },
    totalDesignsUploaded: { type: DataTypes.INTEGER, defaultValue: 0 },
  }, {
    timestamps: true,
  });
};
