/**
 * OpenAI models the classifier may run on. Every one of them accepts
 * reasoning_effort "none", which keeps temperature 0 valid and adds no
 * reasoning latency; models without "none" (gpt-6.1-sol, gpt-6-astra) are
 * slower and nondeterministic here, so they are not listed
 */
export const OPENAI_MODELS = ["gpt-6.1-terra", "gpt-6-sol", "gpt-6-luna"] as const;

export type TOpenAIModel = (typeof OPENAI_MODELS)[number];

export const DEFAULT_OPENAI_MODEL: TOpenAIModel = "gpt-6.1-terra";

/**
 * Narrows an arbitrary string (e.g. an env value) to a supported model
 * @example
 * isOpenAIModel("gpt-6-luna"); // true
 */
export const isOpenAIModel = (value: string): value is TOpenAIModel =>
  (OPENAI_MODELS as readonly string[]).includes(value);
