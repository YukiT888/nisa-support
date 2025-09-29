import OpenAI from 'openai';
import { unstable_noStore as noStore } from 'next/cache';
import type { AdvicePayload, PhotoAnalysis } from '@/lib/types';

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

const defaultApiKey = process.env.OPENAI_API_KEY;
const defaultClient = defaultApiKey ? new OpenAI({ apiKey: defaultApiKey }) : null;

const getClient = (apiKey?: string): OpenAI => {
  if (apiKey) {
    return new OpenAI({ apiKey });
  }
  if (defaultClient) {
    return defaultClient;
  }
  throw new Error('OpenAI APIキーが設定されていません');
};

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

interface CallResponsesOptions {
  apiKey?: string;
  expectsJson?: boolean;
}
type ResponsesCreateParams = Parameters<OpenAI['responses']['create']>[0];
type OpenAIResponse = Awaited<ReturnType<OpenAI['responses']['create']>>;
type OpenAIResponseUsage = OpenAIResponse extends { usage?: infer U } ? U : undefined;

interface CallResponsesResult<T> {
  data: T;
  response: OpenAIResponse;
}

const describeValue = (value: unknown): string => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `array(len=${value.length})`;
  return typeof value;
};

const describePayloadKeys = (payload: ResponsesCreateParams): Record<string, string> => {
  if (!isObject(payload)) return {};
  const entries = Object.entries(payload).map(([key, value]) => [key, describeValue(value)]);
  return Object.fromEntries(entries);
};

async function callResponses<T>(
  payload: ResponsesCreateParams,
  { apiKey, expectsJson = true }: CallResponsesOptions = {},
): Promise<CallResponsesResult<T>> {
  noStore();

  const finalPayload: ResponsesCreateParams = { ...payload };

  if ('messages' in finalPayload && 'input' in finalPayload) {
    throw new Error('payload で messages と input を同時に指定することはできません');
  }

  if ('modalities' in finalPayload) {
    delete (finalPayload as { modalities?: unknown }).modalities;
  }

  if (typeof finalPayload.model === 'string') {
    finalPayload.model = ensureGpt5Model(finalPayload.model, 'payload.model');
  } else if (finalPayload.model == null) {
    finalPayload.model = TEXT_MODEL;
  } else {
    throw new Error('payload.model はGPT-5ファミリーのモデル名文字列で指定してください');
  }

  const client = getClient(apiKey);

  try {
    const response = await client.responses.create(finalPayload);
    const output =
      typeof response === 'object' && response !== null && 'output' in response
        ? (response as { output?: unknown }).output ?? response
        : response;

    const jsonPayload = findJsonPayload(output);
    if (jsonPayload !== undefined) {
      return { data: jsonPayload as T, response };
    }

    const textPayload = findTextPayload(output);
    if (typeof textPayload !== 'string') {
      throw new Error('OpenAI応答が不正です');
    }

    if (!expectsJson) {
      return { data: textPayload as unknown as T, response };
    }

    try {
      return { data: JSON.parse(textPayload) as T, response };
    } catch (error) {
      throw new Error(`OpenAIのJSON応答を解析できません: ${(error as Error).message}`);
    }
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      const status = error.status ?? 0;
      const param = (error as { param?: string; error?: { param?: string } }).param
        ?? (error as { error?: { param?: string } }).error?.param;
      const payloadShape = describePayloadKeys(finalPayload);
      const logDetails = {
        status,
        message: error.message,
        code: (error as { code?: string }).code,
        param,
        payloadShape
      };

      if (status === 400 || status === 422) {
        console.error('OpenAI API validation error', logDetails);
      } else {
        console.error('OpenAI API error', logDetails);
      }

      const raise = (message: string, statusCode: number) => {
        const err = new Error(message);
        (err as { status?: number }).status = statusCode;
        return err;
      };

      if (param === 'modalities') {
        throw raise('modalities は使えません。input_image ブロックで画像を渡してください。', 400);
      }

      if (param === 'model') {
        throw raise('指定されたモデルが画像入力に対応しているか確認してください。', 400);
      }

      if (status === 400 || status === 422) {
        throw raise('OpenAI APIに無効な入力が送信されました。payloadのキーと値の型を確認してください。', status);
      }

      throw raise(`OpenAI APIエラー: ${status} ${error.message}`, status || 500);
    }

    throw error;
  }
}

export interface AnalyzePhotoResult {
  analysis: PhotoAnalysis;
  responseId: string;
  usage?: OpenAIResponseUsage;
}

export async function analyzePhoto({
  image,
  hints,
  apiKey
}: {
  image: string;
  hints?: { symbolText?: string; exchange?: string };
  apiKey?: string;
}): Promise<AnalyzePhotoResult> {
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

  const { data, response } = await callResponses<PhotoAnalysis>(
    {
      model,
      reasoning: { effort: 'medium' },
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: 'あなたは投資教育用のチャート解析アシスタントです。チャート画像から定義済みスキーマに沿って厳密なJSONを返却してください。'
            }
          ]
        },
        {
          role: 'user',
          content: [
            { 
              type: 'input_image',
              image_url: image
            },
            {
              type: 'input_text',
              text: `補足ヒント: ${JSON.stringify(hints ?? {})}`
            }
          ]
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'chart_payload',
          schema
        }
      }
    },
    { apiKey, expectsJson: true }
  );

  return {
    analysis: data,
    responseId: response.id,
    usage: 'usage' in response ? (response as { usage?: OpenAIResponseUsage }).usage : undefined
  };
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

  const { data } = await callResponses<AdvicePayload>(
    {
      model,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: 'あなたは投資教育アシスタント。売買指示は出さず、提供されたシグナルを教育的に説明します。反対要因と免責を必ず含めてください。'
            }
          ]
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify({ decision, reasons, counters, nextSteps })
            }
          ]
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'advice_payload',
          schema
        }
      }
    },
    { apiKey, expectsJson: true }
  );
  return data;
}

export async function chatEducator({
  messages,
  apiKey
}: {
  messages: { role: 'user' | 'assistant'; content: string }[];
  apiKey?: string;
}): Promise<string> {
  const model = TEXT_MODEL;
  const { data } = await callResponses<string>(
    {
      model,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: 'あなたは長期投資教育アシスタント。特定の売買指示は出さず、データとリスクを比較しながら解説してください。常に免責を添えてください。'
            }
          ]
        },
        ...messages.map((message) => ({
          role: message.role,
          content: [{ type: 'input_text', text: message.content }]
        })),
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: '最後に短い免責を追加してください。'
            }
          ]
        }
      ]
    },
    { apiKey, expectsJson: false }
  );
  return data?.trim() ? data : '申し訳ありません、回答を生成できませんでした。';
}
