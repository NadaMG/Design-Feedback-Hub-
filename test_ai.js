require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function test() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  
  const prompt = `You are a UI/UX expert. Return ONLY a JSON object (no markdown): {"colorsRating":4.2,"typographyRating":3.8,"layoutRating":4.0,"uxRating":3.5,"comment":"Great use of whitespace and visual hierarchy.","aiSuggestion":"Consider increasing contrast ratio for better accessibility."}`;
  
  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    console.log('SUCCESS! Gemini responded:');
    console.log(text.slice(0, 500));
  } catch(e) {
    console.log('ERROR:', e.message.slice(0, 300));
  }
}

test();
