const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'YOUR_API_KEY_HERE';

async function test() {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
    const data = await response.json();
    console.log(data.models.map(m => m.name));
  } catch (e) {
    console.error(e);
  }
}
test();
