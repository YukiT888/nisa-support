import { NextResponse } from 'next/server';
import { formatAdvice } from '@/lib/openai';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const { decision, reasons, counters, nextSteps, openAIApiKey } = await request.json();
    if (!decision || !Array.isArray(reasons) || !Array.isArray(counters)) {
      return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
    }
    const payload = await formatAdvice({ decision, reasons, counters, nextSteps, apiKey: openAIApiKey });
    return NextResponse.json(payload);
  } catch (error) {
    console.error('Advice route error', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
