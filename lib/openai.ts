import { unstable_noStore as noStore } from 'next/cache';
import type { AdvicePayload, PhotoAnalysis } from '@/lib/types';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

interface CallChatOptions {
  apiKey?: string;
  expectsJson?: boolean;
  fallbackModel?: string;
}

async function callChat<T>(
  payload: Record<string, unknown>,
  { apiKey, expectsJson = true, fallbackModel }: CallChatOptions = {},
): Promise<T> {
  noStore();
  const key = apiKey ?? process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OpenAI APIキーが設定されていません');

  // Local mock for offline testing
  if (process.env.OPENAI_MOCK === '1') {
    const rf = (payload as any)?.response_format;
    const schemaName: string | undefined = rf?.json_schema?.name;
    if (schemaName === 'chart_payload') {
      const mock: PhotoAnalysis = {
        chart_type: 'candlestick',
        x_axis: { scale: 'linear', unit: 'time' },
        y_axis: { scale: 'linear', unit: 'price' },
        symbol_candidates: ['AAPL', 'MSFT', 'SPY'],
        timeframe: '6 months',
        annotations: [
          { type: 'sma', period: 20 },
          { type: 'rsi', period: 14 }
        ],
        claims: [
          { text: '上昇トレンドの継続が見られる', confidence: 0.76 },
          { text: '直近の出来高増加', confidence: 0.61 }
        ],
        pitfalls: ['短期的なボラティリティ増大']
      };
      return mock as unknown as T;
    }
    if (schemaName === 'advice_payload') {
      const mock: AdvicePayload = {
        headline: '中立: 明確なブレイクアウト待ち',
        rationale: [
          'トレンドは上向きだが過熱感あり',
          'サポート付近での出来高が減少',
          '決算イベントが近く不確実性あり'
        ],
        counterpoints: [
          'EMAサポートを維持している',
          '広範な市場センチメントは改善傾向'
        ],
        next_steps: ['ピボット超えでエントリー検討', '損切りラインを明確化'],
        disclaimer: '投資判断は自己責任で行ってください。'
      };
      return mock as unknown as T;
    }
    // Fallback plain text
    return 'これはローカルモックの応答です。' as unknown as T;
  }

  async function send(body: Record<string, unknown>) {
    return fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify(body)
    });
  }

  let response = await send(payload);
  if (!response.ok) {
    const text = await response.text();
    // Retry logic for model_not_found and response_format issues
    try {
      const err = JSON.parse(text);
      const status = response.status;
      const code = err?.error?.code as string | undefined;
      const message: string = err?.error?.message ?? '';

      if (
        status === 404 &&
        (code === 'model_not_found' || /model .* does not exist/i.test(message)) &&
        fallbackModel &&
        (payload as any).model !== fallbackModel
      ) {
        const retried = { ...payload, model: fallbackModel };
        response = await send(retried);
      } else if (
        status === 400 &&
        (err?.error?.param === 'response_format' || /response_format/i.test(message))
      ) {
        const { response_format: _rf, ...rest } = payload as any;
        response = await send(rest);
      }
    } catch {
      // ignore parse error and fall through
    }

    if (!response.ok) {
      const t2 = await response.text();
      throw new Error(`OpenAI APIエラー: ${response.status} ${t2}`);
    }
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!expectsJson) {
    if (typeof content === 'string') return content as unknown as T;
    if (Array.isArray(content)) {
      const text = content
        .map((p: any) => (typeof p === 'string' ? p : p?.text))
        .filter(Boolean)
        .join('\n');
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
  const model = process.env.OPENAI_MODEL_VISION || 'gpt-4o-mini';
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
      symbol_candidates: { type: 'array', items: { type: 'string' } },
      timeframe: { type: 'string' },
      annotations: {
        type: 'array',
        items: {
          type: 'object',
          properties: { type: { type: 'string' }, period: { type: 'number' } },
          required: ['type'],
          additionalProperties: false
        }
      },
      claims: {
        type: 'array',
        items: {
          type: 'object',
          properties: { text: { type: 'string' }, confidence: { type: 'number' } },
          required: ['text', 'confidence'],
          additionalProperties: false
        }
      },
      pitfalls: { type: 'array', items: { type: 'string' } }
    },
    required: [
      'chart_type',
      'x_axis',
      'y_axis',
      'symbol_candidates',
      'timeframe',
      'annotations',
      'claims',
      'pitfalls'
    ],
    additionalProperties: false
  } as const;

  return callChat<PhotoAnalysis>(
    {
      model,
      messages: [
        {
          role: 'system',
          content:
            'あなたは投資教育用のチャート解析アシスタントです。必ず厳密なJSONのみを返し、指定スキーマに完全準拠してください。'
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: `補足ヒント: ${JSON.stringify(hints ?? {})}` },
            { type: 'image_url', image_url: { url: image } }
          ]
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'chart_payload', schema }
      }
    },
    { apiKey, expectsJson: true, fallbackModel: 'gpt-4o-mini' }
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
  const model = process.env.OPENAI_MODEL_TEXT || 'gpt-4o-mini';
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
      messages: [
        {
          role: 'system',
          content:
            'あなたは投資教育アシスタント。売買指示は出さず、提供されたシグナルを教育的に説明します。反対要因と免責を必ず含め、厳密なJSONのみを返却してください。'
        },
        { role: 'user', content: JSON.stringify({ decision, reasons, counters, nextSteps }) }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'advice_payload', schema }
      }
    },
    { apiKey, expectsJson: true, fallbackModel: 'gpt-4o-mini' }
  );
}

export async function chatEducator({
  messages,
  apiKey
}: {
  messages: { role: 'user' | 'assistant'; content: string }[];
  apiKey?: string;
}): Promise<string> {
  const model = process.env.OPENAI_MODEL_TEXT || 'gpt-4o-mini';
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
    { apiKey, expectsJson: false, fallbackModel: 'gpt-4o-mini' }
  );
  return response?.trim() ? response : '申し訳ありません、回答を生成できませんでした。';
}
