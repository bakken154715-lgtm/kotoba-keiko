import { FALLBACK_MODEL, getSettings } from './settings';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 90_000;

export type GeminiErrorKind = 'no-key' | 'bad-key' | 'quota' | 'network' | 'blocked' | 'server';

const MESSAGES: Record<GeminiErrorKind, string> = {
  'no-key': 'APIキーが未設定です。設定画面で入力するか、見本の採点をオンにしてください。',
  'bad-key': 'APIキーが無効です。設定画面でキーを確認してください。',
  quota: '無料枠の上限に達しました。しばらく待つか、翌日にもう一度試してください。',
  network: 'AIに接続できませんでした。通信状況を確認して、もう一度試してください。',
  blocked: 'AIが応答を返しませんでした。内容を少し変えて、もう一度試してください。',
  server: 'AI側でエラーが起きました。少し待って、もう一度試してください。',
};

export class GeminiError extends Error {
  constructor(public kind: GeminiErrorKind) {
    super(MESSAGES[kind]);
  }
}

export type Part = { text: string } | { inlineData: { mimeType: string; data: string } };
export interface Content {
  role: 'user' | 'model';
  parts: Part[];
}

interface GenerateOptions {
  system?: string;
  contents: Content[];
  /** 指定すると応答をJSONに固定する */
  schema?: object;
}

async function requestModel(model: string, apiKey: string, options: GenerateOptions): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        ...(options.system ? { systemInstruction: { parts: [{ text: options.system }] } } : {}),
        contents: options.contents,
        ...(options.schema
          ? { generationConfig: { responseMimeType: 'application/json', responseSchema: options.schema } }
          : {}),
      }),
      signal: controller.signal,
    });
  } catch {
    throw new GeminiError('network');
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    if (response.status === 429) throw new GeminiError('quota');
    if (response.status === 401 || response.status === 403 || body.includes('API_KEY_INVALID')) {
      throw new GeminiError('bad-key');
    }
    throw new GeminiError('server');
  }

  const data = await response.json();
  const parts: { text?: string; thought?: boolean }[] = data.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .filter((part) => !part.thought && part.text)
    .map((part) => part.text)
    .join('');
  if (!text) throw new GeminiError('blocked');
  return text;
}

/** 上限やサーバーエラーのときは軽量モデルでもう一度試す */
export async function generate(options: GenerateOptions): Promise<string> {
  const { apiKey, model } = getSettings();
  if (!apiKey) throw new GeminiError('no-key');
  try {
    return await requestModel(model, apiKey, options);
  } catch (error) {
    const retryable = error instanceof GeminiError && (error.kind === 'quota' || error.kind === 'server');
    if (!retryable || model === FALLBACK_MODEL) throw error;
    return requestModel(FALLBACK_MODEL, apiKey, options);
  }
}

export function userText(text: string): Content {
  return { role: 'user', parts: [{ text }] };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new GeminiError('network'));
    reader.readAsDataURL(blob);
  });
}

/** iPhoneの録音は audio/mp4 になるが、Geminiの音声形式の一覧にあるのは audio/m4a */
export function geminiAudioType(recordedType: string): string {
  const base = recordedType.split(';')[0].trim();
  return base === 'audio/mp4' || base === 'audio/x-m4a' ? 'audio/m4a' : base;
}

export async function transcribeAudio(blob: Blob): Promise<string> {
  const data = await blobToBase64(blob);
  const text = await generate({
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: '次の日本語の音声を、話したとおりに文字起こししてください。「えー」「あの」などの言いよどみも残してください。文字起こしの本文だけを返してください。',
          },
          { inlineData: { mimeType: geminiAudioType(blob.type), data } },
        ],
      },
    ],
  });
  return text.trim();
}
