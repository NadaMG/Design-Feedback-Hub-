const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Design', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING(150), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    category: {
      type: DataTypes.ENUM('UI/UX', 'Logo', 'Poster', 'Illustration', 'Branding', 'Web', 'Mobile', 'Other'),
      allowNull: false,
      defaultValue: 'UI/UX'
    },
    imageUrl: { type: DataTypes.STRING, allowNull: true },
    externalUrl: { type: DataTypes.STRING, allowNull: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    avgColors: { type: DataTypes.FLOAT, defaultValue: 0 },
    avgTypography: { type: DataTypes.FLOAT, defaultValue: 0 },
    avgLayout: { type: DataTypes.FLOAT, defaultValue: 0 },
    avgUX: { type: DataTypes.FLOAT, defaultValue: 0 },
    avgOverall: { type: DataTypes.FLOAT, defaultValue: 0 },
    feedbackCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    tags: { type: DataTypes.STRING, allowNull: true, defaultValue: '' },
  }, {
    timestamps: true,
  });
};
