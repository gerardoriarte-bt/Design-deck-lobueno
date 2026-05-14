import type { AppConfig } from '../types';

const STORAGE_KEY = 'open-design:config';

export const DEFAULT_CONFIG: AppConfig = {
  mode: 'daemon',
  apiKey: '',
  baseUrl: 'https://api.anthropic.com',
  model: 'claude-sonnet-4-6',
  agentId: null,
  skillId: null,
  designSystemId: null,
  onboardingCompleted: false,
  agentModels: {},
};

/** Well-known providers with pre-filled base URLs. */
export const KNOWN_PROVIDERS: Array<{ label: string; baseUrl: string; model: string; serverKey?: boolean }> = [
  { label: 'Anthropic (Claude)', baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-6' },
  { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'google/gemini-2.5-flash', serverKey: true },
  { label: 'MiMo (Xiaomi) — OpenAI', baseUrl: 'https://token-plan-cn.xiaomimiao.com/v1', model: 'mimo-v2.5-pro' },
  { label: 'MiMo (Xiaomi) — Anthropic', baseUrl: 'https://token-plan-cn.xiaomimiao.com/anthropic', model: 'mimo-v2.5-pro' },
];

export function loadConfig(): AppConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: AppConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
