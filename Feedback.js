const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Feedback', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    designId: { type: DataTypes.INTEGER, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    colorsRating: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 5 } },
    typographyRating: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 5 } },
    layoutRating: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 5 } },
    uxRating: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 5 } },
    overallRating: { type: DataTypes.FLOAT, allowNull: false },
    comment: { type: DataTypes.TEXT, allowNull: false, validate: { len: [30, 5000] } },
    aiSuggestion: { type: DataTypes.TEXT, allowNull: true },
    helpful: { type: DataTypes.INTEGER, defaultValue: 0 },
  }, {
    timestamps: true,
  });
};
