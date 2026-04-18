const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Notification', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    type: {
      type: DataTypes.ENUM('new_feedback', 'helpful_mark', 'system'),
      defaultValue: 'new_feedback'
    },
    message: { type: DataTypes.STRING, allowNull: false },
    link: { type: DataTypes.STRING, allowNull: true },
    isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
    fromUserId: { type: DataTypes.INTEGER, allowNull: true },
  }, {
    timestamps: true,
  });
};
