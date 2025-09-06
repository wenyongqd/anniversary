/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Modality } from "@google/genai";
import type { GenerateContentResponse } from "@google/genai";

let ai: GoogleGenAI | null = null;

async function getGeminiClient(): Promise<GoogleGenAI> {
    if (ai) return ai;
    
    // Try to use NEXT_PUBLIC_GEMINI_API_KEY first (for client-side)
    let apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    
    // If not available and we're on the server, use GEMINI_API_KEY
    if (!apiKey && typeof window === 'undefined') {
        apiKey = process.env.GEMINI_API_KEY;
    }
    
    // If still no API key, fetch from API endpoint
    if (!apiKey) {
        try {
            const response = await fetch('/api/gemini-config');
            if (response.ok) {
                const data = await response.json();
                apiKey = data.apiKey;
            }
        } catch (error) {
            console.error('Failed to fetch Gemini API key:', error);
        }
    }
    
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not configured. Please set it in .env.local");
    }
    
    ai = new GoogleGenAI({ apiKey });
    return ai;
}

/**
 * Processes the Gemini API response, extracting the image or throwing an error if none is found.
 */
function processGeminiResponse(response: GenerateContentResponse): string {
    const imagePartFromResponse = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

    if (imagePartFromResponse?.inlineData) {
        const { mimeType, data } = imagePartFromResponse.inlineData;
        return `data:${mimeType};base64,${data}`;
    }

    const textResponse = response.text;
    console.error("API did not return an image. Response:", textResponse);
    throw new Error(`The AI model responded with text instead of an image: "${textResponse || 'No text response received.'}"`);
}

/**
 * A wrapper for the Gemini API call that includes a retry mechanism for internal server errors.
 */
async function callGeminiWithRetry(imagePart: object, textPart: object): Promise<GenerateContentResponse> {
    const maxRetries = 3;
    const initialDelay = 1000;
    const client = await getGeminiClient();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await client.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: { parts: [imagePart, textPart] },
                config: {
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                },
            });
        } catch (error) {
            console.error(`Error calling Gemini API (Attempt ${attempt}/${maxRetries}):`, error);
            const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
            const isInternalError = errorMessage.includes('"code":500') || errorMessage.includes('INTERNAL') || errorMessage.includes('503');

            if (isInternalError && attempt < maxRetries) {
                const delay = initialDelay * Math.pow(2, attempt - 1);
                console.log(`Internal error detected. Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error;
        }
    }
    throw new Error("Gemini API call failed after all retries.");
}

/**
 * Fetches an image from a URL and converts it to a base64 data URL.
 */
async function imageUrlToDataUrl(imageUrl: string): Promise<string> {
    const response = await fetch(imageUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch image from ${imageUrl}: ${response.statusText}`);
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Generates an artistically enhanced image based on a source photo and a user's memory/message.
 */
export async function generateTimelineImage(imageUrl: string, message: string): Promise<string> {
    const imageDataUrl = await imageUrlToDataUrl(imageUrl);
    
    const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
    if (!match) {
        throw new Error("Failed to convert image URL to a valid data URL format.");
    }
    const [, mimeType, base64Data] = match;

    const imagePart = {
        inlineData: { mimeType, data: base64Data },
    };

    const prompt = `Based on the user's photo and their memory, generate a new image that artistically enhances the original. The new image should capture the feeling and essence of the memory provided.
    
    User's Memory: "${message}"

    The output must be a single, beautified, photorealistic image. Do not add text to the image.`;

    try {
        const textPart = { text: prompt };
        const response = await callGeminiWithRetry(imagePart, textPart);
        return processGeminiResponse(response);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
        console.error("An unrecoverable error occurred during image generation.", error);
        throw new Error(`The AI model failed to generate an image. Details: ${errorMessage}`);
    }
}