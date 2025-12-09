import { GoogleGenerativeAI } from "@google/generative-ai";
import { GeneratedAsset } from "../types";

const apiKey = import.meta.env.VITE_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

// Helper to remove white background from the generated image
const removeBackground = async (base64Data: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        resolve(base64Data);
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      
      // Simple threshold-based transparency
      // We assume the model follows instructions for a white background
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // If pixel is very bright (near white), make it transparent
        // Threshold set to 240 to catch compression artifacts around white
        if (r > 240 && g > 240 && b > 240) {
          data[i + 3] = 0; 
        }
      }
      
      ctx.putImageData(imgData, 0, 0);
      // Get the base64 string without the prefix
      resolve(canvas.toDataURL('image/png').split(',')[1]);
    };
    img.onerror = () => resolve(base64Data);
    img.src = `data:image/png;base64,${base64Data}`;
  });
};

export const generatePixelAsset = async (prompt: string, type: 'accessory' | 'character' = 'accessory'): Promise<GeneratedAsset | null> => {
  try {
    const viewInstruction = type === 'character' 
      ? 'View: Side view or ¾ view suitable for a game sprite (e.g. platformer).'
      : 'View: Front facing or slightly angled, suitable for placing on a character.';

    const enhancedPrompt = `
      Generate a single, high-quality pixel art asset.
      Subject: ${prompt}
      Style: 16-bit or 32-bit retro game asset.
      ${viewInstruction}
      Background: Solid Pure White (#FFFFFF). NO shadows, NO gradients, NO patterns.
      Do not include any text, charts, or extra elements. Just the isolated object on white.
    `;

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const response = await model.generateContent(enhancedPrompt);

    const result = await response.response;
    const text = result.text();
    
    // For now, return null as image generation requires different API
    // You'll need to use Imagen or similar for actual image generation
    console.log('Generated text:', text);
    return null;

  } catch (error) {
    console.error("Error generating pixel asset:", error);
    throw error;
  }
};