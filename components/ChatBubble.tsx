import { clsx } from 'clsx';

export function ChatBubble({ role, children }: { role: 'user' | 'assistant'; children: React.ReactNode }) {
  const isUser = role === 'user';
  return (
    <div className={clsx('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={clsx(
          'max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-kachi',
          isUser ? 'bg-kachi-accent text-kachi-shade' : 'bg-kachi-surface text-kachi'
        )}
      >
        {children}
      </div>
    </div>
  );
}
