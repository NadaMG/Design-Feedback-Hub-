const { sequelize, User, Design, Feedback, Notification } = require('./models');
const bcrypt = require('bcryptjs');

async function seedDatabase() {
  try {
    const userCount = await User.count();
    if (userCount > 0) return; // Already seeded

    console.log('🌱 Seeding database with sample data...');

    // Create users
    const pass = await bcrypt.hash('password123', 12);
    const users = await User.bulkCreate([
      { username: 'sarah_designer', email: 'sarah@example.com', password: pass, fullName: 'Sarah Mitchell', bio: 'UI/UX Designer with 5 years of experience. Passionate about creating user-centered designs.', skills: 'Figma, Adobe XD, Illustrator, Prototyping', level: 'Expert', totalDesignsUploaded: 3, totalFeedbackGiven: 2 },
      { username: 'alex_creates', email: 'alex@example.com', password: pass, fullName: 'Alex Thompson', bio: 'Brand designer and logo creator. Love building visual identities that tell stories.', skills: 'Branding, Logo Design, Illustrator, Photoshop', level: 'Advanced', totalDesignsUploaded: 2, totalFeedbackGiven: 3 },
      { username: 'mia_ux', email: 'mia@example.com', password: pass, fullName: 'Mia Rodriguez', bio: 'Frontend developer turned UX designer. Bridging the gap between design and code.', skills: 'UX Research, Wireframing, Figma, CSS', level: 'Intermediate', totalDesignsUploaded: 1, totalFeedbackGiven: 2 },
      { username: 'james_visual', email: 'james@example.com', password: pass, fullName: 'James Lee', bio: 'Poster and illustration artist. Creating visual stories through bold colors and typography.', skills: 'Illustration, Poster Design, Typography, Inkscape', level: 'Advanced', totalDesignsUploaded: 2, totalFeedbackGiven: 1 },
    ]);

    // Create designs using placeholder image URLs
    const designs = await Design.bulkCreate([
      {
        title: 'Fintech Mobile App — Dashboard UI',
        description: 'A clean, modern dashboard UI for a personal finance tracking app. Focus on data visualization and minimal cognitive load.',
        category: 'UI/UX', tags: 'mobile, fintech, dashboard, minimal',
        imageUrl: 'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=800&q=80',
        userId: users[0].id, avgColors: 4.3, avgTypography: 4.1, avgLayout: 4.5, avgUX: 4.2, avgOverall: 4.3, feedbackCount: 2
      },
      {
        title: 'EcoMart Brand Identity & Logo',
        description: 'Complete brand identity for an eco-friendly marketplace startup. Logo, color palette, and typography system.',
        category: 'Branding', tags: 'branding, logo, eco, green',
        imageUrl: 'https://images.unsplash.com/photo-1609921212029-bb5a28e60960?w=800&q=80',
        userId: users[1].id, avgColors: 4.8, avgTypography: 4.5, avgLayout: 4.6, avgUX: 4.4, avgOverall: 4.6, feedbackCount: 2
      },
      {
        title: 'Music Festival Poster — Neon Nights',
        description: 'Bold electro-neon poster design for an electronic music festival. Heavy use of vibrant gradients and layered typography.',
        category: 'Poster', tags: 'music, festival, neon, bold',
        imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&q=80',
        userId: users[3].id, avgColors: 4.7, avgTypography: 4.2, avgLayout: 4.4, avgUX: 3.8, avgOverall: 4.3, feedbackCount: 1
      },
      {
        title: 'Travel App — Onboarding Screens',
        description: 'Onboarding flow for a travel booking app. Three-screen walkthrough with immersive photography and minimal interaction.',
        category: 'Mobile', tags: 'travel, onboarding, mobile, UX',
        imageUrl: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&q=80',
        userId: users[2].id, avgColors: 4.0, avgTypography: 3.8, avgLayout: 4.2, avgUX: 4.1, avgOverall: 4.0, feedbackCount: 2
      },
      {
        title: 'SaaS Landing Page — Glassmorphism Style',
        description: 'A stunning SaaS landing page using glassmorphism design trend. Dark theme with vibrant accent colors.',
        category: 'Web', tags: 'saas, landing, glassmorphism, dark',
        imageUrl: 'https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=800&q=80',
        userId: users[1].id, avgColors: 0, avgTypography: 0, avgLayout: 0, avgUX: 0, avgOverall: 0, feedbackCount: 0
      },
      {
        title: 'Coffee Brand — Minimalist Logo Set',
        description: 'A minimalist logo system for an artisanal coffee brand. Three variations: primary, icon, and wordmark.',
        category: 'Logo', tags: 'coffee, minimal, logo, artisan',
        imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80',
        userId: users[0].id, avgColors: 0, avgTypography: 0, avgLayout: 0, avgUX: 0, avgOverall: 0, feedbackCount: 0
      },
    ]);

    // Create feedbacks
    await Feedback.bulkCreate([
      {
        designId: designs[0].id, userId: users[1].id,
        colorsRating: 4, typographyRating: 4, layoutRating: 5, uxRating: 4, overallRating: 4.25,
        comment: 'Really clean dashboard layout! The color hierarchy makes it easy to scan important metrics at a glance. The typography could use a slightly bolder weight for the primary numbers to create stronger contrast. Overall really solid fintech UI work.',
        aiSuggestion: 'Great color choices! Consider using a slightly bolder font weight for the primary metrics. Excellent layout structure — the visual flow guides the eye naturally.',
        helpful: 3
      },
      {
        designId: designs[0].id, userId: users[2].id,
        colorsRating: 5, typographyRating: 4, layoutRating: 4, uxRating: 4, overallRating: 4.25,
        comment: 'Love the color palette — the neutral grays with that teal accent work beautifully. The grid system is well-structured. I would suggest improving the empty state designs for when there is no transaction data to display, those tend to be overlooked.',
        aiSuggestion: 'Strong color palette and excellent UX considerations — the design feels intuitive and user-friendly.',
        helpful: 2
      },
      {
        designId: designs[1].id, userId: users[0].id,
        colorsRating: 5, typographyRating: 5, layoutRating: 5, uxRating: 4, overallRating: 4.75,
        comment: 'Absolutely love this brand identity! The logo mark is clever and versatile. The earthy green palette feels authentic and trustworthy for an eco brand. The typography pairing is professional. I would love to see how it looks on packaging or merchandise.',
        aiSuggestion: 'Excellent layout and typography — both feel polished and professional. Overall a high-quality design worth submitting to Behance.',
        helpful: 5
      },
      {
        designId: designs[1].id, userId: users[2].id,
        colorsRating: 5, typographyRating: 4, layoutRating: 4, uxRating: 5, overallRating: 4.5,
        comment: 'This is really exceptional brand work. The eco positioning comes through clearly in every design decision. The secondary color choices complement the primary green perfectly. Testing brand adaptability across light and dark backgrounds would strengthen the guidelines presentation.',
        aiSuggestion: 'Strong UX considerations and excellent color palette. This design shows real mastery of brand identity principles.',
        helpful: 4
      },
      {
        designId: designs[2].id, userId: users[0].id,
        colorsRating: 5, typographyRating: 4, layoutRating: 4, uxRating: 4, overallRating: 4.25,
        comment: 'The neon color palette is electric and really captures the festival energy! The layered typography creates great depth. The layout could be slightly cleaner around the artist lineup section as it feels slightly crowded. The overall vibe is spot on.',
        aiSuggestion: 'Great color choices that perfectly match the festival theme. Consider refining the layout in the artist lineup section for better breathing room.',
        helpful: 2
      },
      {
        designId: designs[3].id, userId: users[1].id,
        colorsRating: 4, typographyRating: 4, layoutRating: 4, uxRating: 4, overallRating: 4.0,
        comment: 'The onboarding screens are well-designed and the photography choices are inspiring. The CTA buttons are clear and the progress indicators work well. Consider adding a skip button that is more visible for users who want to jump straight into the app.',
        aiSuggestion: 'Good color and layout choices. Strong UX considerations — the design feels intuitive. Adding a more prominent skip option would improve the onboarding experience.',
        helpful: 1
      },
      {
        designId: designs[3].id, userId: users[3].id,
        colorsRating: 4, typographyRating: 4, layoutRating: 4, uxRating: 4, overallRating: 4.0,
        comment: 'Really smooth onboarding flow! The photography selection is excellent and really sets the travel mood. The body copy font size could be bumped up slightly for better readability on smaller screens. Overall a polished mobile design.',
        aiSuggestion: 'Good overall balance across all design dimensions. Consider increasing base font size for better accessibility.',
        helpful: 1
      },
    ]);

    console.log('✅ Database seeded successfully!');
  } catch (err) {
    console.log('Seed already exists or error:', err.message);
  }
}

module.exports = { seedDatabase };
