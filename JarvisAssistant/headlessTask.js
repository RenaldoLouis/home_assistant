import { GoogleGenerativeAI } from '@google/generative-ai';
import { getFirestore, collection, doc, setDoc, serverTimestamp } from '@react-native-firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

// In production, fetch this securely. For MVP, we'll try to pull from the same place App.tsx does.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'YOUR_API_KEY_HERE';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const headlessTask = async ({ notification }) => {
  console.log('[Jarvis Headless] Task fired. Notification received:', notification ? 'yes' : 'no');

  try {
    if (!notification) {
      console.log('[Jarvis Headless] No notification payload, exiting.');
      return;
    }

    // Try to parse out title/text. The library passes stringified JSON payload
    const payload = typeof notification === 'string' ? JSON.parse(notification) : notification;

    // ─── DEBUG: Log the FULL raw payload so we can see exactly what the notification contains ───
    console.log('[Jarvis Headless] ===== FULL RAW PAYLOAD =====');
    console.log('[Jarvis Headless] app:', payload.app);
    console.log('[Jarvis Headless] title:', payload.title);
    console.log('[Jarvis Headless] titleBig:', payload.titleBig);
    console.log('[Jarvis Headless] text:', payload.text);
    console.log('[Jarvis Headless] bigText:', payload.bigText);
    console.log('[Jarvis Headless] subText:', payload.subText);
    console.log('[Jarvis Headless] summaryText:', payload.summaryText);
    console.log('[Jarvis Headless] extraInfoText:', payload.extraInfoText);
    console.log('[Jarvis Headless] ===========================');

    const app = payload.app || '';
    const title = payload.title || payload.titleBig || '';
    // CRITICAL FIX: myBCA and many bank apps put transaction details in bigText, not text.
    // Fall back through all text fields to find the actual content.
    const text = payload.bigText || payload.text || payload.subText || payload.summaryText || '';

    console.log('[Jarvis Headless] Resolved fields - App:', app, '| Title:', title, '| Text:', text?.substring(0, 100));

    if (!app || !title || !text) {
      console.log('[Jarvis Headless] Missing app/title/text fields after fallback, skipping. app=', !!app, 'title=', !!title, 'text=', !!text);
      return;
    }

    // Filter for myBCA (id.co.bca.mybca) or other bank notifications
    const appLower = app.toLowerCase();
    const titleLower = title.toLowerCase();
    const isMatch = appLower.includes('bca') ||
                    appLower.includes('mybca') ||
                    appLower.includes('mandiri') ||
                    appLower.includes('bni') ||
                    appLower.includes('bri') ||
                    titleLower.includes('financial diary') ||
                    titleLower.includes('transaksi') ||
                    titleLower.includes('transaction');
    console.log('[Jarvis Headless] Bank notification filter match:', isMatch, '| App:', app, '| Title:', title);

    if (isMatch) {
      
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

      console.log('[Jarvis Headless] Sending to Gemini for parsing...');
      const result = await model.generateContent(prompt);
      const responseText = result.response.text().trim();
      console.log('[Jarvis Headless] Gemini response:', responseText);
      
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const expenseData = JSON.parse(jsonMatch[0]);
        console.log('[Jarvis Headless] Parsed expense:', JSON.stringify(expenseData));
        
        const jarvisUserId = 'jarvis_user_id'; // Matches App.tsx
        const expenseId = uuidv4();
        
        const db = getFirestore();
        const expenseRef = doc(collection(db, 'users', jarvisUserId, 'expenses'), expenseId);
        
        await setDoc(expenseRef, {
          id: expenseId,
          amount: expenseData.amount,
          merchant: expenseData.merchant,
          bank: expenseData.bank,
          date: new Date().toISOString(),
          rawText: text,
          createdAt: serverTimestamp(),
        });
          
        console.log('[Jarvis Headless] ✅ Saved expense to Firestore:', expenseData.amount, 'at', expenseData.merchant);
      } else {
        console.log('[Jarvis Headless] ❌ Could not extract JSON from Gemini response.');
      }
    }
  } catch (error) {
    console.error('[Jarvis Headless] ❌ Error in notification listener headless task:', error);
  }
};

export default headlessTask;
