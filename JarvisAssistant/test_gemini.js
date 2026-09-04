const { GoogleGenerativeAI } = require('@google/generative-ai');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'YOUR_API_KEY_HERE';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

async function test() {
  const title = "Financial Diary";
  const text = "You spent IDR 250,580.00 at Food & Beverage.";
  
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
  const prompt = `
        You are a financial parsing assistant. Extract the transaction details from this bank notification.
        Notification Title: "${title}"
        Notification Text: "${text}"
        
        Respond ONLY with a JSON object in this exact format, nothing else:
        {
          "amount": 22000,
          "merchant": "Food & Beverage",
          "bank": "BCA"
        }
      `;
  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    console.log("Raw Response:", responseText);
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      console.log("JSON Match:", jsonMatch[0]);
    } else {
      console.log("No JSON matched");
    }
  } catch (e) {
    console.error(e);
  }
}
test();
