import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

// Use explicit key — sdk reads GOOGLE_GENERATIVE_AI_API_KEY by default, we use GOOGLE_AI_API_KEY
const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });

async function test() {
  console.log('GOOGLE_AI_API_KEY set:', !!process.env.GOOGLE_AI_API_KEY);
  console.log('Key starts with:', process.env.GOOGLE_AI_API_KEY?.substring(0, 10));

  for (const modelName of ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']) {
    try {
      console.log(`\nTesting model: ${modelName}...`);
      const result = await generateText({
        model: google(modelName),
        prompt: 'Řekni "funguju" česky jedním slovem.',
      });
      console.log(`✅ ${modelName}: "${result.text}"`);
      break;
    } catch (e: any) {
      console.log(`❌ ${modelName}: ${e.message?.substring(0, 200)}`);
    }
  }
}

test();
