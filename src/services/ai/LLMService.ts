import axios from 'axios';
import { aiConfigStorage } from './AIConfigStorage';
import { selectModelForTask } from 'src/config/aiConfig';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class LLMService {
  async complete(prompt: string, systemPrompt?: string): Promise<string> {
    if (!aiConfigStorage.isConfigured()) {
      throw new Error('AI is not configured or enabled');
    }

    const apiKey = aiConfigStorage.getActiveApiKey();
    const provider = aiConfigStorage.getActiveProvider();

    if (!apiKey || !provider) {
      throw new Error('No validated AI provider available');
    }

    const model = selectModelForTask(provider, 'chat');

    switch (provider) {
      case 'gemini':
        return this.callGemini(apiKey, model, prompt, systemPrompt);
      case 'groq':
        return this.callGroq(apiKey, model, prompt, systemPrompt);
      case 'openrouter':
        return this.callOpenRouter(apiKey, model, prompt, systemPrompt);
      default:
        throw new Error(
          `Provider ${provider} not supported for chat completion`
        );
    }
  }

  private async callGemini(
    apiKey: string,
    model: string,
    prompt: string,
    systemPrompt?: string
  ): Promise<string> {
    // 1. Sanitize model name: strip 'models/' prefix if present
    let modelName = model.trim();
    if (modelName.startsWith('models/')) {
      modelName = modelName.replace('models/', '');
    }

    // 2. Handle generic names or empty names
    // If specifically 'gemini', 'gemini-1.5', or empty, default to specific version
    if (!modelName || modelName === 'gemini' || modelName === 'gemini-1.5') {
      modelName = 'gemini-3-flash-preview';
    }
    // If it looks like 'gemini-1.5-flash', ensure we use the stable '-001' or '-latest' if needed.
    // However, 'gemini-1.5-flash' usually works.
    // Let's force 'gemini-3-flash-preview' if it is exactly 'gemini-1.5-flash' to be safe.
    if (modelName === 'gemini-1.5-flash') {
      modelName = 'gemini-3-flash-preview';
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const contents = [] as Array<{
      role: string;
      parts: Array<{ text: string }>;
    }>;
    if (systemPrompt) {
      contents.push({
        role: 'user',
        parts: [{ text: `System Instruction: ${systemPrompt}` }],
      });
      contents.push({ role: 'model', parts: [{ text: 'Understood.' }] });
    }
    contents.push({ role: 'user', parts: [{ text: prompt }] });

    const response = await axios.post(url, { contents });

    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('No text returned from Gemini');
    return text;
  }

  private async callGroq(
    apiKey: string,
    model: string,
    prompt: string,
    systemPrompt?: string
  ): Promise<string> {
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    return this.callOpenAICompatible(url, apiKey, model, prompt, systemPrompt);
  }

  private async callOpenRouter(
    apiKey: string,
    model: string,
    prompt: string,
    systemPrompt?: string
  ): Promise<string> {
    const url = 'https://openrouter.ai/api/v1/chat/completions';
    return this.callOpenAICompatible(url, apiKey, model, prompt, systemPrompt);
  }

  private async callOpenAICompatible(
    url: string,
    apiKey: string,
    model: string,
    prompt: string,
    systemPrompt?: string
  ): Promise<string> {
    const messages: ChatMessage[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const response = await axios.post(
      url,
      {
        model,
        messages,
        temperature: 0.1,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const text = response.data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('No text returned from LLM provider');
    return text;
  }
}

export const llmService = new LLMService();
