import { unstable_noStore as noStore } from 'next/cache';
import type { AdvicePayload, PhotoAnalysis } from '@/lib/types';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

const GPT5_MODEL_PREFIX = /^gpt-5/;

const ensureGpt5Model = (model: string, source: string): string => {
  if (!GPT5_MODEL_PREFIX.test(model)) {
    throw new Error(
      `${source} はGPT-5ファミリーのモデル名を指定してください (受領値: "${model}")`
    );
  }
  return model;
};

const DEFAULT_MODEL = ensureGpt5Model(
  process.env.OPENAI_MODEL ?? 'gpt-5.0-mini',
  'OPENAI_MODEL'
);
const TEXT_MODEL = ensureGpt5Model(
  process.env.OPENAI_MODEL_TEXT ?? DEFAULT_MODEL,
  'OPENAI_MODEL_TEXT'
);
const VISION_MODEL = ensureGpt5Model(
  process.env.OPENAI_MODEL_VISION ?? DEFAULT_MODEL,
  'OPENAI_MODEL_VISION'
);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const findJsonPayload = (node: unknown): unknown | undefined => {
  if (node == null) return undefined;

  if (Array.isArray(node)) {
    for (const item of node) {
      const result = findJsonPayload(item);
      if (result !== undefined) return result;
    }
    return undefined;
  }

  if (!isObject(node)) return undefined;

  if ('json' in node && (node as { json?: unknown }).json != null) {
    return (node as { json?: unknown }).json;
  }

  if ('parsed' in node && (node as { parsed?: unknown }).parsed != null) {
    return (node as { parsed?: unknown }).parsed;
  }

  if ('json_schema' in node) {
    const result = findJsonPayload((node as { json_schema?: unknown }).json_schema);
    if (result !== undefined) return result;
  }

  if ('content' in node) {
    const result = findJsonPayload((node as { content?: unknown }).content);
    if (result !== undefined) return result;
  }

  for (const value of Object.values(node)) {
    const result = findJsonPayload(value);
    if (result !== undefined) return result;
  }

  return undefined;
};

const findTextPayload = (node: unknown): string | undefined => {
  if (node == null) return undefined;

  if (Array.isArray(node)) {
    for (const item of node) {
      const result = findTextPayload(item);
      if (result !== undefined) return result;
    }
    return undefined;
  }

  if (!isObject(node)) return undefined;

  if (typeof (node as { text?: unknown }).text === 'string') {
    return (node as { text?: string }).text;
  }

  if ('content' in node) {
    const result = findTextPayload((node as { content?: unknown }).content);
    if (result !== undefined) return result;
  }

  for (const value of Object.values(node)) {
    const result = findTextPayload(value);
    if (result !== undefined) return result;
  }

  return undefined;
};

interface CallChatOptions {
  apiKey?: string;
  expectsJson?: boolean;
}

const collectModalities = (content: unknown[]): Set<'text' | 'vision'> => {
  const modes = new Set<'text' | 'vision'>();

  for (const item of content) {
    if (!isObject(item)) continue;

    const type = (item as { type?: unknown }).type;
    if (type === 'input_image' || type === 'image' || type === 'image_url') {
      modes.add('vision');
    } else {
      modes.add('text');
    }

    if ('content' in item && Array.isArray((item as { content?: unknown }).content)) {
      for (const nested of collectModalities((item as { content: unknown[] }).content)) {
        modes.add(nested);
      }
    }
  }

  return modes;
};

async function callChat<T>(
  payload: Record<string, unknown>,
  { apiKey, expectsJson = true }: CallChatOptions = {},
): Promise<T> {
  noStore();
  const key = apiKey ?? process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OpenAI APIキーが設定されていません');
  }

  // === コンフリクト解消: モデル検証・デフォルト設定 ===
  if (typeof payload.model === 'string') {
    payload.model = ensureGpt5Model(payload.model, 'payload.model');
  } else if (payload.model == null) {
    payload.model = TEXT_MODEL;
  } else {
    throw new Error('payload.model はGPT-5ファミリーのモデル名文字列で指定してください');
  }
  // === ここまで ===

  if (!('modalities' in payload)) {
    const input = payload.input;
    if (Array.isArray(input)) {
      const derived = new Set<'text' | 'vision'>();
      for (const message of input) {
        if (!isObject(message)) continue;
        const content = (message as { content?: unknown }).content;
        if (Array.isArray(content)) {
          for (const mode of collectModalities(content)) {
            derived.add(mode);
          }
        }
      }
      if (expectsJson || derived.has('text')) derived.add('text');
      if (derived.size > 0) {
        payload.modalities = Array.from(derived);
      }
    } else if (expectsJson) {
      payload.modalities = ['text'];
    }
  }

  if (expectsJson) {
    const textConfig = payload.text;
    if (textConfig === undefined) {
      payload.text = { format: 'json' };
    } else if (!isObject(textConfig)) {
      throw new Error('payload.text はオブジェクトで指定してください');
    } else if (typeof (textConfig as { format?: unknown }).format !== 'string') {
      (textConfig as Record<string, unknown>).format = 'json';
    }
  }

  const response = await fetch(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI APIエラー: ${response.status} ${text}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!expectsJson) {
    if (typeof content === 'string') return content as unknown as T;
    // If content is array of parts, join text parts.
    if (Array.isArray(content)) {
      const text = content.map((p: any) => (typeof p === 'string' ? p : p?.text)).filter(Boolean).join('\n');
      return text as unknown as T;
    }
    throw new Error('OpenAI応答が不正です');
  }

  try {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(`OpenAIのJSON応答を解析できません: ${(error as Error).message}`);
  }
}

export async function analyzePhoto({
  image,
  hints,
  apiKey
}: {
  image: string;
  hints?: { symbolText?: string; exchange?: string };
  apiKey?: string;
}): Promise<PhotoAnalysis> {
  const model = VISION_MODEL;
  const schema = {
    type: 'object',
    properties: {
      chart_type: { type: 'string', enum: ['line', 'candlestick', 'bar', 'area', 'unknown'] },
      x_axis: {
        type: 'object',
        properties: {
          scale: { type: 'string' },
          unit: { type: 'string' }
        },
        required: ['scale', 'unit']
      },
      y_axis: {
        type: 'object',
        properties: {
          scale: { type: 'string' },
          unit: { type: 'string' }
        },
        required: ['scale', 'unit']
      },
      symbol_candidates: {
        type: 'array',
        items: { type: 'string' }
      },
      timeframe: { type: 'string' },
      annotations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            period: { type: 'number' }
          },
          required: ['type'],
          additionalProperties: false
        }
      },
      claims: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            confidence: { type: 'number' }
          },
          required: ['text', 'confidence'],
          additionalProperties: false
        }
      },
      pitfalls: {
        type: 'array',
        items: { type: 'string' }
      }
    },
    required: ['chart_type', 'x_axis', 'y_axis', 'symbol_candidates', 'timeframe', 'annotations', 'claims', 'pitfalls'],
    additionalProperties: false
  } as const;

  return callChat<PhotoAnalysis>(
    {
      model,
      reasoning: { effort: 'medium' },
      modalities: ['text', 'vision'],
      input: [
        {
          role: 'system',
          content: 'あなたは投資教育用のチャート解析アシスタントです。チャート画像から定義済みスキーマに沿って厳密なJSONを返却してください。'
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_image',
              image_url: {
                url: image
              }
            },
            {
              type: 'input_text',
              text: `補足ヒント: ${JSON.stringify(hints ?? {})}`
            }
          ]
        }
      ],
      text: {
        format: 'json_schema',
        json_schema: {
          name: 'chart_payload',
          schema
        }
      }
    },
    { apiKey, expectsJson: true }
  );
}

export async function formatAdvice({
  decision,
  reasons,
  counters,
  nextSteps,
  apiKey
}: {
  decision: string;
  reasons: string[];
  counters: string[];
  nextSteps: string[];
  apiKey?: string;
}): Promise<AdvicePayload> {
  const model = TEXT_MODEL;
  const schema = {
    type: 'object',
    properties: {
      headline: { type: 'string' },
      rationale: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3 },
      counterpoints: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2 },
      next_steps: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 3 },
      disclaimer: { type: 'string' }
    },
    required: ['headline', 'rationale', 'counterpoints', 'next_steps', 'disclaimer'],
    additionalProperties: false
  } as const;

  return callChat<AdvicePayload>(
    {
      model,
      modalities: ['text'],
      input: [
        {
          role: 'system',
          content: 'あなたは投資教育アシスタント。売買指示は出さず、提供されたシグナルを教育的に説明します。反対要因と免責を必ず含めてください。'
        },
        {
          role: 'user',
          content: JSON.stringify({ decision, reasons, counters, nextSteps })
        }
      ],
      text: {
        format: 'json_schema',
        json_schema: {
          name: 'advice_payload',
          schema
        }
      }
    },
    { apiKey, expectsJson: true }
  );
}

export async function chatEducator({
  messages,
  apiKey
}: {
  messages: { role: 'user' | 'assistant'; content: string }[];
  apiKey?: string;
}): Promise<string> {
  const model = TEXT_MODEL;
  const response = await callChat<string>(
    {
      model,
      messages: [
        {
          role: 'system',
          content:
            'あなたは長期投資教育アシスタント。特定の売買指示は出さず、データとリスクを比較しながら解説してください。常に免責を添えてください。'
        },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: '最後に短い免責を追加してください。' }
      ]
    },
    { apiKey, expectsJson: false }
  );
  return response?.trim() ? response : '申し訳ありません、回答を生成できませんでした。';
}