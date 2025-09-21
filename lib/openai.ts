import { unstable_noStore as noStore } from 'next/cache';
import type { AdvicePayload, PhotoAnalysis } from '@/lib/types';

const OPENAI_API_URL = 'https://api.openai.com/v1/responses';

interface CallResponsesOptions {
  apiKey?: string;
  expectsJson?: boolean;
}

async function callResponses<T>(
  payload: Record<string, unknown>,
  { apiKey, expectsJson = true }: CallResponsesOptions = {}
): Promise<T> {
  noStore();
  const key = apiKey ?? process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OpenAI APIキーが設定されていません');
  }
  const response = await fetch(OPENAI_API_URL, {
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
  const firstMessage = data.output?.[0]?.content?.[0];
  if (!firstMessage) {
    throw new Error('OpenAI応答が不正です');
  }

  if ('json' in firstMessage && firstMessage.json) {
    return firstMessage.json as T;
  }

  const textPayload = 'text' in firstMessage ? firstMessage.text : undefined;
  if (typeof textPayload !== 'string') {
    throw new Error('OpenAI応答が不正です');
  }

  if (!expectsJson) {
    return textPayload as unknown as T;
  }

  try {
    return JSON.parse(textPayload) as T;
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
  const model = process.env.OPENAI_MODEL_VISION ?? 'gpt-4.1-mini';
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

  return callResponses<PhotoAnalysis>(
    {
      model,
      reasoning: { effort: 'medium' },
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'text',
              text: 'あなたは投資教育用のチャート解析アシスタントです。チャート画像から定義済みスキーマに沿って厳密なJSONを返却してください。'
            }
          ]
        },
        {
          role: 'user',
          content: [
            { type: 'input_image', image_url: image },
            {
              type: 'text',
              text: `補足ヒント: ${JSON.stringify(hints ?? {})}`
            }
          ]
        }
      ],
      response_format: { type: 'json_schema', json_schema: { name: 'chart_payload', schema } }
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
  const model = process.env.OPENAI_MODEL_TEXT ?? 'gpt-4.1-mini';
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

  return callResponses<AdvicePayload>(
    {
      model,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'text',
              text: 'あなたは投資教育アシスタント。売買指示は出さず、提供されたシグナルを教育的に説明します。反対要因と免責を必ず含めてください。'
            }
          ]
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: JSON.stringify({ decision, reasons, counters, nextSteps })
            }
          ]
        }
      ],
      response_format: { type: 'json_schema', json_schema: { name: 'advice_payload', schema } }
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
  const model = process.env.OPENAI_MODEL_TEXT ?? 'gpt-4.1-mini';
  const response = await callResponses<string>(
    {
      model,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'text',
              text: 'あなたは長期投資教育アシスタント。特定の売買指示は出さず、データとリスクを比較しながら解説してください。常に免責を添えてください。'
            }
          ]
        },
        ...messages.map((message) => ({
          role: message.role,
          content: [{ type: 'text', text: message.content }]
        })),
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '最後に短い免責を追加してください。'
            }
          ]
        }
      ]
    },
    { apiKey, expectsJson: false }
  );
  return response?.trim() ? response : '申し訳ありません、回答を生成できませんでした。';
}
