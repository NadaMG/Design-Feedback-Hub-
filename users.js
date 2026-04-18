const express = require('express');
const { User, Design, Feedback } = require('../models');
const auth = require('../middleware/auth');
const router = express.Router();

// GET user profile by id
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] },
      include: [
        {
          model: Design, as: 'designs',
          order: [['createdAt', 'DESC']],
          limit: 6
        }
      ]
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// GET dashboard for current user
router.get('/dashboard/me', auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, { attributes: { exclude: ['password'] } });

    const designs = await Design.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']]
    });

    const feedbackGiven = await Feedback.findAll({
      where: { userId: req.user.id },
      include: [{ model: Design, as: 'design', attributes: ['id', 'title', 'imageUrl'] }],
      order: [['createdAt', 'DESC']],
      limit: 10
    });

    const feedbackReceived = await Feedback.findAll({
      include: [
        { model: Design, as: 'design', where: { userId: req.user.id }, attributes: ['id', 'title', 'imageUrl'] },
        { model: User, as: 'reviewer', attributes: ['id', 'username', 'fullName', 'avatar'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: 10
    });

    const totalFeedbackReceived = feedbackReceived.length;
    const avgRatingReceived = totalFeedbackReceived > 0
      ? (feedbackReceived.reduce((s, f) => s + f.overallRating, 0) / totalFeedbackReceived).toFixed(2)
      : 0;

    res.json({
      user,
      designs,
      feedbackGiven,
      feedbackReceived,
      analytics: {
        totalDesigns: designs.length,
        totalFeedbackGiven: feedbackGiven.length,
        totalFeedbackReceived,
        avgRatingReceived
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// PUT update profile
router.put('/profile/update', auth, async (req, res) => {
  try {
    const { fullName, bio, skills, level } = req.body;
    await User.update({ fullName, bio, skills, level }, { where: { id: req.user.id } });
    const updated = await User.findByPk(req.user.id, { attributes: { exclude: ['password'] } });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
