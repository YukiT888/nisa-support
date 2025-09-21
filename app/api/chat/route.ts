import { NextResponse } from 'next/server';
import { chatEducator } from '@/lib/openai';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const { messages, openAIApiKey } = await request.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages are required' }, { status: 400 });
    }
    const text = await chatEducator({ messages, apiKey: openAIApiKey });
    return NextResponse.json({ text });
  } catch (error) {
    console.error('Chat route error', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
