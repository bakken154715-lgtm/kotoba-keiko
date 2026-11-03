export const MODELS = [
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash(高性能)' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite(高速)' },
];
export const FALLBACK_MODEL = 'gemini-3.5-flash-lite';

export interface Settings {
  apiKey: string;
  model: string;
  sampleMode: boolean;
}

const KEY = 'kotoba-keiko-settings';
const DEFAULTS: Settings = { apiKey: '', model: MODELS[0].id, sampleMode: false };

/** コピー時に混ざりやすい空白や見えない文字を取り除く */
export function cleanApiKey(value: string): string {
  return value.replace(/[\s​-‍⁠﻿]/g, '');
}

/** 通信のヘッダーに入れられるのは半角文字だけ */
export function isApiKeyFormatValid(key: string): boolean {
  return /^[\x21-\x7e]+$/.test(key);
}

// プライベートブラウズなどで localStorage が使えない場合はメモリに持つ
let memory: Settings | null = null;

export function getSettings(): Settings {
  if (memory) return memory;
  try {
    memory = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    memory = { ...DEFAULTS };
  }
  return memory!;
}

export function updateSettings(patch: Partial<Settings>): Settings {
  memory = { ...getSettings(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // 保存できなくても今回の起動中は使える
  }
  return memory;
}
