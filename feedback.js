const express = require('express');
const { Feedback, Design, User, Notification } = require('../models');
const auth = require('../middleware/auth');
const router = express.Router();

// AI feedback suggestion generator
function generateAISuggestion(ratings, comment) {
  const avg = (ratings.colors + ratings.typography + ratings.layout + ratings.ux) / 4;
  const suggestions = [];

  if (ratings.colors <= 2) suggestions.push('Consider refining your color palette — try using complementary colors or a tool like Coolors.co for harmony.');
  else if (ratings.colors >= 4) suggestions.push('Great color choices! The palette feels cohesive and visually appealing.');

  if (ratings.typography <= 2) suggestions.push('Typography needs improvement — ensure font pairing is intentional and hierarchy is clear.');
  else if (ratings.typography >= 4) suggestions.push('Typography is well-executed with clear hierarchy and readability.');

  if (ratings.layout <= 2) suggestions.push('The layout could benefit from better use of whitespace and grid alignment.');
  else if (ratings.layout >= 4) suggestions.push('Excellent layout structure — the visual flow guides the eye naturally.');

  if (ratings.ux <= 2) suggestions.push('Focus on user experience improvements — ensure navigation is intuitive and interactions are discoverable.');
  else if (ratings.ux >= 4) suggestions.push('Strong UX considerations — the design feels intuitive and user-friendly.');

  if (avg >= 4) suggestions.push('Overall this is a high-quality design. Consider submitting to Behance or Dribbble for community recognition.');
  else if (avg <= 2) suggestions.push('This design shows potential — keep iterating and studying successful designs in this category.');

  return suggestions.join(' ');
}

// POST create feedback
router.post('/', auth, async (req, res) => {
  try {
    const { designId, colorsRating, typographyRating, layoutRating, uxRating, comment } = req.body;

    if (!designId || !colorsRating || !typographyRating || !layoutRating || !uxRating || !comment)
      return res.status(400).json({ error: 'All fields are required' });

    if (!comment || comment.trim().length < 30)
      return res.status(400).json({ error: 'Comment must be at least 30 characters for meaningful feedback' });

    for (const [key, val] of Object.entries({ colorsRating, typographyRating, layoutRating, uxRating })) {
      const n = parseInt(val);
      if (isNaN(n) || n < 1 || n > 5)
        return res.status(400).json({ error: `${key} must be between 1 and 5` });
    }

    const design = await Design.findByPk(designId);
    if (!design) return res.status(404).json({ error: 'Design not found' });

    if (design.userId === req.user.id)
      return res.status(403).json({ error: 'You cannot review your own design' });

    const existing = await Feedback.findOne({ where: { designId, userId: req.user.id } });
    if (existing) return res.status(409).json({ error: 'You have already reviewed this design' });

    const overallRating = ((parseInt(colorsRating) + parseInt(typographyRating) + parseInt(layoutRating) + parseInt(uxRating)) / 4).toFixed(1);

    const aiSuggestion = generateAISuggestion(
      { colors: parseInt(colorsRating), typography: parseInt(typographyRating), layout: parseInt(layoutRating), ux: parseInt(uxRating) },
      comment
    );

    const feedback = await Feedback.create({
      designId, userId: req.user.id,
      colorsRating: parseInt(colorsRating),
      typographyRating: parseInt(typographyRating),
      layoutRating: parseInt(layoutRating),
      uxRating: parseInt(uxRating),
      overallRating: parseFloat(overallRating),
      comment: comment.trim(),
      aiSuggestion
    });

    // Recalculate design averages
    const allFeedbacks = await Feedback.findAll({ where: { designId } });
    const count = allFeedbacks.length;
    const avg = (key) => (allFeedbacks.reduce((s, f) => s + f[key], 0) / count).toFixed(2);

    await design.update({
      avgColors: avg('colorsRating'),
      avgTypography: avg('typographyRating'),
      avgLayout: avg('layoutRating'),
      avgUX: avg('uxRating'),
      avgOverall: avg('overallRating'),
      feedbackCount: count
    });

    await User.increment('totalFeedbackGiven', { by: 1, where: { id: req.user.id } });

    // Create notification for design owner
    const reviewer = await User.findByPk(req.user.id, { attributes: ['username', 'fullName'] });
    const notification = await Notification.create({
      userId: design.userId,
      type: 'new_feedback',
      message: `${reviewer.fullName || reviewer.username} left feedback on your design "${design.title}"`,
      link: `#design/${designId}`,
      fromUserId: req.user.id
    });

    // Send SSE real-time notification
    const sseClients = req.app.locals.sseClients;
    if (sseClients && sseClients.has(design.userId)) {
      const clientRes = sseClients.get(design.userId);
      clientRes.write(`data: ${JSON.stringify({ type: 'notification', notification })}\n\n`);
    }

    const fullFeedback = await Feedback.findByPk(feedback.id, {
      include: [{ model: User, as: 'reviewer', attributes: ['id', 'username', 'fullName', 'avatar', 'level'] }]
    });

    res.status(201).json(fullFeedback);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// GET feedback for a design
router.get('/design/:designId', async (req, res) => {
  try {
    const feedbacks = await Feedback.findAll({
      where: { designId: req.params.designId },
      include: [{ model: User, as: 'reviewer', attributes: ['id', 'username', 'fullName', 'avatar', 'level'] }],
      order: [['createdAt', 'DESC']]
    });
    res.json(feedbacks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// Mark feedback as helpful
router.post('/:id/helpful', auth, async (req, res) => {
  try {
    const feedback = await Feedback.findByPk(req.params.id);
    if (!feedback) return res.status(404).json({ error: 'Feedback not found' });
    await feedback.increment('helpful');
    res.json({ helpful: feedback.helpful + 1 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark helpful' });
  }
});

module.exports = router;
