'use client';

import { FormEvent, useState } from 'react';
import { ChatBubble } from '@/components/ChatBubble';
import { Card } from '@/components/Card';
import { useAppSettings } from '@/lib/useAppSettings';
import { DISCLAIMER } from '@/lib/constants';
import ja from '@/public/i18n/ja.json';

const t = ja.chat;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPage() {
  const { settings, ready } = useAppSettings();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '解析結果や気になる銘柄について質問してください。投資助言ではなく教育的な視点でお答えします。'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim() || !ready) return;
    const newMessage: Message = { role: 'user', content: input.trim() };
    const nextMessages = [...messages, newMessage];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages,
          openAIApiKey: settings.openAIApiKey
        })
      });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: data.text }]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-1 flex-col gap-4">
      <header>
        <h2 className="text-xl font-semibold">{t.title}</h2>
        <p className="text-xs text-white/60">{DISCLAIMER}</p>
      </header>
      <Card className="flex max-h-[60vh] flex-1 flex-col gap-3 overflow-y-auto">
        {messages.map((message, index) => (
          <ChatBubble key={index} role={message.role}>
            {message.content}
          </ChatBubble>
        ))}
      </Card>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t.placeholder}
          className="h-24 w-full rounded-2xl border border-white/10 bg-white/10 p-4 text-sm text-white focus:border-kachi-accent focus:outline-none focus:ring-2 focus:ring-kachi-accent"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-full bg-kachi-accent px-4 py-2 text-sm font-semibold text-kachi-shade disabled:opacity-50"
        >
          送信
        </button>
        {error && <p className="text-xs text-signal-sell">{error}</p>}
      </form>
    </div>
  );
}
