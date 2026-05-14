import type { AppConfig } from '../types';

const STORAGE_KEY = 'open-design:config';

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export const DEFAULT_CONFIG: AppConfig = {
  mode: 'api',
  apiKey: '',
  baseUrl: OPENROUTER_BASE_URL,
  model: 'anthropic/claude-sonnet-4-6',
  agentId: null,
  skillId: null,
  designSystemId: null,
  onboardingCompleted: true,
  agentModels: {},
};

export function loadConfig(): AppConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      mode: 'api',
      baseUrl: OPENROUTER_BASE_URL,
      model: parsed.model && !['claude-sonnet-4-5', 'claude-sonnet-4-6', 'google/gemini-2.5-flash'].includes(parsed.model)
        ? parsed.model
        : DEFAULT_CONFIG.model,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: AppConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
