const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const { Design, User, Feedback } = require('../models');
const auth = require('../middleware/auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();

const router = express.Router();

// Multer storage config
let storage;
if (process.env.CLOUDINARY_URL || (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)) {
  if (!process.env.CLOUDINARY_URL) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
  }
  storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'design-hub',
      allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'webp', 'svg']
    }
  });
} else {
  // Local fallback
  storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../public/uploads')),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `design_${Date.now()}${ext}`);
    }
  });
}

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|svg/;
    if (allowed.test(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Only image files allowed'));
  }
});

// GET all designs (with search & filter)
router.get('/', async (req, res) => {
  try {
    const { category, minRating, sort = 'latest', search, page = 1, limit = 12 } = req.query;
    const where = {};

    if (category && category !== 'All') where.category = category;
    if (minRating) where.avgOverall = { [Op.gte]: parseFloat(minRating) };
    if (search) where.title = { [Op.like]: `%${search}%` };

    const order = sort === 'rating' ? [['avgOverall', 'DESC']]
      : sort === 'popular' ? [['feedbackCount', 'DESC']]
      : [['createdAt', 'DESC']];

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { count, rows } = await Design.findAndCountAll({
      where,
      include: [{ model: User, as: 'author', attributes: ['id', 'username', 'fullName', 'avatar', 'level'] }],
      order,
      limit: parseInt(limit),
      offset
    });

    res.json({ designs: rows, total: count, page: parseInt(page), pages: Math.ceil(count / parseInt(limit)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch designs' });
  }
});

// GET single design with feedbacks
router.get('/:id', async (req, res) => {
  try {
    const design = await Design.findByPk(req.params.id, {
      include: [
        { model: User, as: 'author', attributes: ['id', 'username', 'fullName', 'avatar', 'level'] },
        {
          model: Feedback, as: 'feedbacks',
          include: [{ model: User, as: 'reviewer', attributes: ['id', 'username', 'fullName', 'avatar', 'level'] }],
          order: [['createdAt', 'DESC']]
        }
      ]
    });
    if (!design) return res.status(404).json({ error: 'Design not found' });
    res.json(design);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch design' });
  }
});

// POST create design
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    const { title, description, category, externalUrl, tags } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const imageUrl = req.file ? (req.file.path.startsWith('http') ? req.file.path : `/uploads/${req.file.filename}`) : null;
    if (!imageUrl && !externalUrl) return res.status(400).json({ error: 'Provide an image or external URL' });

    const design = await Design.create({
      title, description, category: category || 'UI/UX',
      imageUrl, externalUrl, tags: tags || '',
      userId: req.user.id
    });

    await User.increment('totalDesignsUploaded', { by: 1, where: { id: req.user.id } });

    const fullDesign = await Design.findByPk(design.id, {
      include: [{ model: User, as: 'author', attributes: ['id', 'username', 'fullName', 'avatar', 'level'] }]
    });

    res.status(201).json(fullDesign);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create design' });
  }
});

// DELETE design
router.delete('/:id', auth, async (req, res) => {
  try {
    const design = await Design.findByPk(req.params.id);
    if (!design) return res.status(404).json({ error: 'Design not found' });
    if (design.userId !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    await design.destroy();
    res.json({ message: 'Design deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete design' });
  }
});

// POST AI analyze design (Real Gemini Implementation)
router.post('/:id/analyze', auth, async (req, res) => {
  try {
    const design = await Design.findByPk(req.params.id);
    if (!design) return res.status(404).json({ error: 'Design not found' });

    // Check if Gemini API key exists
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API key is missing. Please add GEMINI_API_KEY to your .env file.' });
    }

    // Get or Create AI Bot
    const [aiUser] = await User.findOrCreate({ 
      where: { username: 'ai_bot' }, 
      defaults: { email: 'ai@designhub.local', password: 'ai_secure_pass', fullName: '⚡ AI Vision Critic', level: 'Expert', bio: 'I analyze designs frame-by-frame using Gemini Vision models.', avatar: '🤖' } 
    });

    const existing = await Feedback.findOne({ where: { designId: design.id, userId: aiUser.id } });
    if (existing) return res.status(400).json({ error: 'AI has already analyzed this design' });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Try models in order by availability
    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash-lite', 'gemini-2.0-flash'];
    let resultJSON = null;

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        let imageParts = [];

        // Load image if available
        if (design.imageUrl) {
          if (design.imageUrl.startsWith('http')) {
            // Fetch remote image securely
            const response = await fetch(design.imageUrl);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            imageParts.push({
              inlineData: {
                data: buffer.toString('base64'),
                mimeType: response.headers.get('content-type') || 'image/jpeg'
              }
            });
          } else {
            // Fetch local uploaded file
            const localImagePath = path.join(__dirname, '../public', design.imageUrl);
            if (fs.existsSync(localImagePath)) {
              const mimeType = localImagePath.endsWith('.png') ? 'image/png'
                : localImagePath.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
              imageParts.push({
                inlineData: {
                  data: Buffer.from(fs.readFileSync(localImagePath)).toString('base64'),
                  mimeType
                }
              });
            }
          }
        }

        const prompt = `You are an expert UX/UI Designer and Art Director.
Analyze the provided visual design. If no image is provided, analyze the description.
Category: ${design.category}
Title: ${design.title}
Description: ${design.description || 'None provided'}

Provide a detailed expert review. Return ONLY a valid JSON object (no markdown, no backticks):
{"colorsRating":4.5,"typographyRating":3.8,"layoutRating":4.0,"uxRating":3.5,"comment":"**[AI VISION ANALYSIS]**\\n\\n👉 **Colors:** Your analysis here.\\n👉 **Typography:** Your analysis here.\\n👉 **Layout:** Your analysis here.\\n👉 **UX:** Your analysis here.","aiSuggestion":"Automated Insight: Your key recommendation here."}`;

        const result = await model.generateContent([prompt, ...imageParts]);
        let responseText = result.response.text();
        responseText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        resultJSON = JSON.parse(responseText);
        console.log(`AI analysis done using model: ${modelName}`);
        break; // Success — exit loop
      } catch (modelErr) {
        console.warn(`Model ${modelName} failed: ${modelErr.message.slice(0, 80)}`);
        if (!modelErr.message.includes('429') && !modelErr.message.includes('404')) {
          // Not a quota/availability error — something else went wrong
          throw modelErr;
        }
        // Try next model
      }
    }

    if (!resultJSON) {
      return res.status(503).json({ error: 'All AI models are temporarily unavailable. Please try again in a moment.' });
    }

    // Default smart ratings based on parsed JSON or fallback
    const ratings = {
      c: Number(resultJSON.colorsRating) || 4,
      t: Number(resultJSON.typographyRating) || 4,
      l: Number(resultJSON.layoutRating) || 4,
      u: Number(resultJSON.uxRating) || 4
    };
    const overallRating = ((ratings.c + ratings.t + ratings.l + ratings.u) / 4).toFixed(1);

    await Feedback.create({
      designId: design.id, 
      userId: aiUser.id,
      colorsRating: ratings.c, 
      typographyRating: ratings.t, 
      layoutRating: ratings.l, 
      uxRating: ratings.u,
      overallRating: overallRating, 
      comment: resultJSON.comment || 'The design shows promise but needs refinement in contrast and layout.',
      aiSuggestion: resultJSON.aiSuggestion || 'Automated Insight: Adjust primary call-to-action button color for higher visibility.'
    });

    // Recalculate design averages
    const all = await Feedback.findAll({ where: { designId: design.id } });
    const count = all.length;
    const avgScore = (k) => (all.reduce((s, f) => s + Number(f[k]), 0) / count).toFixed(2);
    
    await design.update({
      avgColors: avgScore('colorsRating'), 
      avgTypography: avgScore('typographyRating'),
      avgLayout: avgScore('layoutRating'), 
      avgUX: avgScore('uxRating'),
      avgOverall: avgScore('overallRating'), 
      feedbackCount: count
    });

    res.json({ success: true, message: 'AI Analysis complete.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'AI failed to analyze' });
  }
});

module.exports = router;
