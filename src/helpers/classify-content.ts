import OpenAI from "openai";
import { determineContentType } from "../config/rules";
import logger from "../utils/logger";
import { config } from "../config/index.js";
import { CONTENT_CLASSIFICATION_PROMPT } from "../config/prompts/index.js";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

/**
 * Content classification result interface
 */
interface IClassificationResult {
  category: "drugs" | "jobs" | "gambling" | "tickets" | "financial";
  confidence: number;
  reasoning: string;
}

/**
 * Classifies message content using AI to determine appropriate moderation prompt
 * @example
 * const classification = await classifyContent('Выгуливать собаку 4500₽/день');
 * console.log(classification.category); // "jobs"
 */
export const classifyContent = async (
  message: string
): Promise<IClassificationResult> => {
  try {
    logger.info("Classifying content with AI", {
      messageLength: message.length,
      messagePreview: message.substring(0, 50),
    });

    const response = await openai.chat.completions.create({
      model: "chatgpt-4o-latest",
      messages: [
        {
          role: "system",
          content:
            "You are a specialized content-moderation assistant. Always reply in valid JSON. The JSON must include keys like shouldModerate, reason, confidence. Do NOT include any additional text outside the JSON block.",
        },
        {
          role: "system",
          content: CONTENT_CLASSIFICATION_PROMPT,
        },
        {
          role: "user",
          content: message,
        },
      ],
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      logger.warn("No classification response from OpenAI");
      return {
        category: "financial",
        confidence: 0.5,
        reasoning: "Не удалось классифицировать сообщение",
      };
    }

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      logger.warn("No JSON found in classification response", { content });
      return {
        category: "financial",
        confidence: 0.5,
        reasoning: "Ошибка парсинга ответа классификации",
      };
    }

    const classification = JSON.parse(jsonMatch[0]) as IClassificationResult;

    logger.info("Content classified", {
      category: classification.category,
      confidence: classification.confidence,
      reasoning: classification.reasoning,
    });

    return classification;
  } catch (error) {
    logger.error("Error in content classification", { error });

    // Fallback to keyword-based detection
    const fallbackCategory = determineContentType(message);

    return {
      category: fallbackCategory,
      confidence: 0.3,
      reasoning: "Использована резервная классификация по ключевым словам",
    };
  }
};

export default classifyContent;
