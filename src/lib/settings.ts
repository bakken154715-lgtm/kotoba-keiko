export const LITE_MODEL = 'gemini-3.5-flash-lite';
export const FULL_MODEL = 'gemini-3.8-flash';
export const MODELS = [
  { id: LITE_MODEL, label: 'Gemini 3.5 Flash-Lite(速い)' },
  { id: FULL_MODEL, label: 'Gemini 3.8 Flash(高性能、時間がかかる)' },
];

export interface Settings {
  apiKey: string;
  model: string;
  /** 利用者が自分でモデルを選んだら true。既定のモデルを変えても選択を上書きしない */
  modelChosen?: boolean;
  sampleMode: boolean;
}

const KEY = 'kotoba-keiko-settings';
const DEFAULTS: Settings = { apiKey: '', model: LITE_MODEL, sampleMode: false };

export function parseStoredSettings(raw: string): Settings {
  const stored: Partial<Settings> = JSON.parse(raw);
  // 以前の版は選んでいなくても既定のモデルを保存していた
  if (!stored.modelChosen) delete stored.model;
  return { ...DEFAULTS, ...stored };
}

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
    memory = parseStoredSettings(localStorage.getItem(KEY) ?? '{}');
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
