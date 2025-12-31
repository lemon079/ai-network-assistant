/**
 * LLM Provider Configuration
 * 
 * Allows easy switching between different AI providers:
 * - Gemini (Google)
 * - Ollama (Local)
 * - OpenAI (future)
 * 
 * Set the active provider via environment variable or change DEFAULT_PROVIDER
 */

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOllama } from '@langchain/ollama';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

// ============ PROVIDER TYPES ============

export type LLMProvider = 'gemini' | 'ollama';

export interface LLMConfig {
    provider: LLMProvider;
    model: string;
    temperature?: number;
}

// ============ AVAILABLE MODELS ============

export const AVAILABLE_MODELS: Record<LLMProvider, string[]> = {
    gemini: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'],
    ollama: ['gpt-oss:20b-cloud', 'llama3.2', 'mistral', 'codellama'],
};

// ============ DEFAULT CONFIGURATION ============

// Change this to switch the default provider
export const DEFAULT_PROVIDER: LLMProvider = 'ollama';

// Default models for each provider
export const DEFAULT_MODELS: Record<LLMProvider, string> = {
    gemini: 'gemini-2.5-flash',
    ollama: 'gpt-oss:20b-cloud',
};

// ============ PROVIDER FACTORY ============

/**
 * Create an LLM instance based on the provider configuration
 */
export function createLLM(config?: Partial<LLMConfig>): BaseChatModel {
    const provider = config?.provider || DEFAULT_PROVIDER;
    const model = config?.model || DEFAULT_MODELS[provider];
    const temperature = config?.temperature ?? 0.7;

    switch (provider) {
        case 'gemini':
            return new ChatGoogleGenerativeAI({
                model,
                apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
                temperature,
            });

        case 'ollama':
            return new ChatOllama({
                model,
                baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
                temperature,
            });

        default:
            throw new Error(`Unknown LLM provider: ${provider}`);
    }
}

/**
 * Get the current active provider from environment or default
 */
export function getActiveProvider(): LLMProvider {
    const envProvider = process.env.LLM_PROVIDER as LLMProvider;
    if (envProvider && ['gemini', 'ollama'].includes(envProvider)) {
        return envProvider;
    }
    return DEFAULT_PROVIDER;
}

/**
 * Get the current active model from environment or default
 */
export function getActiveModel(): string {
    const envModel = process.env.LLM_MODEL;
    if (envModel) {
        return envModel;
    }
    return DEFAULT_MODELS[getActiveProvider()];
}

/**
 * Create LLM with tools bound
 */
export function createLLMWithTools(tools: any[], config?: Partial<LLMConfig>) {
    const llm = createLLM(config);
    return llm.bindTools!(tools);
}
