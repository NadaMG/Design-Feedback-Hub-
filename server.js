require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { sequelize } = require('./models');

const authRoutes = require('./routes/auth');
const designRoutes = require('./routes/designs');
const feedbackRoutes = require('./routes/feedback');
const userRoutes = require('./routes/users');
const notificationRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 3000;

// SSE clients map for real-time notifications
const sseClients = new Map();
app.locals.sseClients = sseClients;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/designs', designRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);

// SSE endpoint for real-time notifications
app.get('/api/events/:userId', (req, res) => {
  const userId = parseInt(req.params.userId);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.set(userId, res);

  req.on('close', () => {
    sseClients.delete(userId);
  });
});

// Serve SPA for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Export app for Vercel
module.exports = app;

// Sync DB and start server locally (Vercel ignores app.listen)
sequelize.sync({ alter: true }).then(async () => {
  const { seedDatabase } = require('./seed');
  await seedDatabase();
  
  if (!process.env.VERCEL) {
    app.listen(PORT, () => {
      console.log(`\n🚀 Design Feedback Hub running at http://localhost:${PORT}`);
      console.log(`📦 Database synced successfully\n`);
    });
  }
}).catch(err => {
  console.error('Database sync failed:', err);
});
