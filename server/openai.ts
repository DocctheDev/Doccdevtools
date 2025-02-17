import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function analyzeCode(code: string): Promise<{
  suggestions: string[];
  security: string[];
  performance: string[];
}> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a Discord bot code analyzer. Analyze the given code and provide suggestions for improvements, security concerns, and performance optimizations. Response must be in JSON format with arrays of strings for suggestions, security, and performance.",
        },
        {
          role: "user",
          content: code,
        },
      ],
      response_format: { type: "json_object" },
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error: any) {
    throw new Error("Failed to analyze code: " + error.message);
  }
}
