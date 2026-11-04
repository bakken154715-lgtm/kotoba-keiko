import { FULL_MODEL, LITE_MODEL, cleanApiKey, getSettings, isApiKeyFormatValid } from './settings';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
// iPhoneのSafariは約60秒で通信を打ち切ることがあるので、その前に自分で区切ってもう一方のモデルへ回す
const TIMEOUT_MS = 50_000;

export type GeminiErrorKind =
  | 'no-key'
  | 'key-format'
  | 'bad-key'
  | 'quota'
  | 'network'
  | 'unreachable'
  | 'timeout'
  | 'blocked'
  | 'server';

const MESSAGES: Record<GeminiErrorKind, string> = {
  'no-key': 'APIキーが未設定です。設定画面で入力するか、見本の採点をオンにしてください。',
  'key-format': 'APIキーに使えない文字が入っています。設定画面でキーをコピーし直してください。',
  'bad-key': 'APIキーが無効です。設定画面でキーを確認してください。',
  quota: '無料枠の上限に達しました。しばらく待つか、翌日にもう一度試してください。',
  network: 'AIに接続できませんでした。設定画面の「AIへの接続を確かめる」で原因を確認してください。',
  unreachable:
    'Googleのサーバーに届きません。広告ブロック、VPN、プライベートリレーを使っていれば、オフにして試してください。',
  timeout: 'AIの応答に時間がかかりすぎました。少し待って、もう一度試してください。',
  blocked: 'AIが応答を返しませんでした。内容を少し変えて、もう一度試してください。',
  server: 'AI側でエラーが起きました。少し待って、もう一度試してください。',
};

export class GeminiError extends Error {
  constructor(
    public kind: GeminiErrorKind,
    detail?: string,
  ) {
    super(detail ? `${MESSAGES[kind]}(詳細: ${detail})` : MESSAGES[kind]);
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function usableKey(): string {
  const key = cleanApiKey(getSettings().apiKey);
  if (!key) throw new GeminiError('no-key');
  if (!isApiKeyFormatValid(key)) throw new GeminiError('key-format');
  return key;
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
  const startedAt = Date.now();
  // 軽量モデルは既定で思考量が最小なので指定しない
  const generationConfig = {
    ...(model === LITE_MODEL ? {} : { thinkingConfig: { thinkingLevel: 'low' } }),
    ...(options.schema ? { responseMimeType: 'application/json', responseSchema: options.schema } : {}),
  };
  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        ...(options.system ? { systemInstruction: { parts: [{ text: options.system }] } } : {}),
        contents: options.contents,
        ...(Object.keys(generationConfig).length > 0 ? { generationConfig } : {}),
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw new GeminiError('timeout');
    const seconds = Math.round((Date.now() - startedAt) / 1000);
    throw new GeminiError('network', `${describeError(error)}、${model}、${seconds}秒`);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    if (response.status === 429) throw new GeminiError('quota');
    if (response.status === 401 || response.status === 403 || body.includes('API_KEY_INVALID')) {
      throw new GeminiError('bad-key');
    }
    throw new GeminiError('server', `${model} ${response.status} ${body.slice(0, 200)}`);
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

/** キー以外の失敗ではもう一方のモデルで試す。無料枠の上限はモデルごとに別 */
export async function generate(options: GenerateOptions): Promise<string> {
  const { model } = getSettings();
  const apiKey = usableKey();
  try {
    return await requestModel(model, apiKey, options);
  } catch (error) {
    const retryable =
      error instanceof GeminiError && ['quota', 'server', 'timeout', 'network'].includes(error.kind);
    if (!retryable) throw error;
    return requestModel(model === LITE_MODEL ? FULL_MODEL : LITE_MODEL, apiKey, options);
  }
}

/** キーの形式、Googleまでの経路、実際の応答の順に確かめる。失敗した段階のエラーを投げる */
export async function testConnection(): Promise<void> {
  usableKey();
  try {
    // キーなしでも応答が返れば経路は通っている(403が正常)
    await fetch(ENDPOINT);
  } catch (error) {
    throw new GeminiError('unreachable', describeError(error));
  }
  await generate({ contents: [userText('「はい」とだけ答えてください。')] });
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

export async function audioPart(blob: Blob): Promise<Part> {
  return { inlineData: { mimeType: geminiAudioType(blob.type), data: await blobToBase64(blob) } };
}

export async function transcribeAudio(blob: Blob): Promise<string> {
  const text = await generate({
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: '次の日本語の音声を、話したとおりに文字起こししてください。「えー」「あの」などの言いよどみも残してください。文字起こしの本文だけを返してください。',
          },
          await audioPart(blob),
        ],
      },
    ],
  });
  return text.trim();
}
