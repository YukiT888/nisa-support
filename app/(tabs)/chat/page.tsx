'use client';

import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState
} from 'react';
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

interface SymbolSuggestion {
  symbol: string;
  name: string;
  region: string;
}

export default function ChatPage() {
  const { settings, ready } = useAppSettings();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        '解析結果や気になる銘柄について質問してください。投資助言ではなく教育的な視点でお答えします。'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [symbolQuery, setSymbolQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SymbolSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const comboboxContainerRef = useRef<HTMLDivElement>(null);
  const comboboxInputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const comboboxBaseId = useId();
  const comboboxInputId = `symbol-combobox-${comboboxBaseId}`;
  const listboxId = `${comboboxInputId}-listbox`;
  const errorId = `${comboboxInputId}-error`;
  const statusId = `${comboboxInputId}-status`;

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!comboboxContainerRef.current?.contains(event.target as Node)) {
        setShowSuggestions(false);
        setHighlightedIndex(null);
      }
    };
    const handleFocusChange = (event: FocusEvent) => {
      if (!comboboxContainerRef.current?.contains(event.target as Node)) {
        setShowSuggestions(false);
        setHighlightedIndex(null);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('focusin', handleFocusChange);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('focusin', handleFocusChange);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      searchAbortRef.current?.abort();
    };
  }, []);

  const fetchSuggestions = useCallback(
    async (keyword: string) => {
      if (!ready) return;
      const trimmed = keyword.trim();
      if (!trimmed) return;

      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;

      setSearchLoading(true);
      setSearchError(null);
      try {
        const params = new URLSearchParams({ q: trimmed });
        if (settings.alphaVantageApiKey) {
          params.set('apiKey', settings.alphaVantageApiKey);
        }
        const response = await fetch(`/api/search?${params.toString()}`, {
          signal: controller.signal
        });
        if (response.status === 429) {
          throw new Error('Alpha Vantageのレート制限に達しました。しばらく待ってから再試行してください。');
        }
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          const message =
            typeof payload?.error === 'string' ? payload.error : '検索に失敗しました。';
          throw new Error(message);
        }
        const data: SymbolSuggestion[] = await response.json();
        setSuggestions(data);
        setShowSuggestions(data.length > 0);
        setHighlightedIndex(data.length > 0 ? 0 : null);
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        setSuggestions([]);
        setHighlightedIndex(null);
        setShowSuggestions(false);
        setSearchError((error as Error).message);
      } finally {
        setSearchLoading(false);
      }
    },
    [ready, settings.alphaVantageApiKey]
  );

  const handleSymbolInputChange = (value: string) => {
    setSymbolQuery(value);
    setSearchError(null);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    if (!value.trim()) {
      searchAbortRef.current?.abort();
      setSuggestions([]);
      setShowSuggestions(false);
      setHighlightedIndex(null);
      return;
    }
    setShowSuggestions(true);
    searchTimeoutRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 400);
  };

  const moveHighlight = (direction: 1 | -1) => {
    if (!suggestions.length) return;
    setShowSuggestions(true);
    setHighlightedIndex((prev) => {
      const current = prev ?? (direction === 1 ? -1 : suggestions.length);
      const next = (current + direction + suggestions.length) % suggestions.length;
      const option = listboxRef.current?.children.item(next) as HTMLElement | null;
      option?.scrollIntoView({ block: 'nearest' });
      return next;
    });
  };

  const handleSuggestionSelect = (suggestion: SymbolSuggestion) => {
    setInput((prev) => {
      const needsSpace = prev.length > 0 && !/\s$/.test(prev);
      return `${prev}${needsSpace ? ' ' : ''}${suggestion.symbol} `;
    });
    setSymbolQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    setHighlightedIndex(null);
    setSearchError(null);
    searchAbortRef.current?.abort();
    textareaRef.current?.focus();
  };

  const handleSymbolKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveHighlight(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveHighlight(-1);
    } else if (event.key === 'Enter') {
      if (showSuggestions && highlightedIndex !== null && suggestions[highlightedIndex]) {
        event.preventDefault();
        handleSuggestionSelect(suggestions[highlightedIndex]);
      }
    } else if (event.key === 'Escape') {
      if (showSuggestions) {
        event.preventDefault();
        setShowSuggestions(false);
        setHighlightedIndex(null);
      }
    } else if (event.key === 'Tab') {
      setShowSuggestions(false);
      setHighlightedIndex(null);
    }
  };

  const describedByIds = [
    searchError ? errorId : null,
    searchLoading ? statusId : null
  ].filter(Boolean);
  const describedBy = describedByIds.length > 0 ? describedByIds.join(' ') : undefined;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim() || !ready) return;
    const newMessage: Message = { role: 'user', content: input.trim() };
    const nextMessages = [...messages, newMessage];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    setChatError(null);
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
      setChatError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const showNoResults =
    !searchLoading &&
    !searchError &&
    symbolQuery.trim().length > 0 &&
    suggestions.length === 0;

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
        <div className="flex flex-col gap-1" ref={comboboxContainerRef}>
          <label
            htmlFor={comboboxInputId}
            className="text-xs font-semibold text-white/70"
          >
            ティッカー検索
          </label>
          <div className="relative">
            <input
              id={comboboxInputId}
              ref={comboboxInputRef}
              type="text"
              role="combobox"
              aria-expanded={showSuggestions}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={
                highlightedIndex !== null
                  ? `${listboxId}-option-${highlightedIndex}`
                  : undefined
              }
              aria-describedby={describedBy}
              aria-busy={searchLoading}
              value={symbolQuery}
              onChange={(event) => handleSymbolInputChange(event.target.value)}
              onFocus={() => {
                if (symbolQuery.trim().length > 0 && suggestions.length > 0) {
                  setShowSuggestions(true);
                }
              }}
              onKeyDown={handleSymbolKeyDown}
              placeholder="銘柄名やティッカーを検索"
              autoComplete="off"
              className="w-full rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white focus:border-kachi-accent focus:outline-none focus:ring-2 focus:ring-kachi-accent"
            />
            {showSuggestions && (suggestions.length > 0 || searchLoading) && (
              <ul
                id={listboxId}
                ref={listboxRef}
                role="listbox"
                aria-label="検索候補"
                className="absolute z-10 mt-2 max-h-60 w-full overflow-y-auto rounded-2xl border border-white/10 bg-kachi-shade/95 p-1 backdrop-blur"
              >
                {suggestions.map((suggestion, index) => {
                  const isHighlighted = highlightedIndex === index;
                  return (
                    <li key={`${suggestion.symbol}-${index}`} className="list-none">
                      <button
                        type="button"
                        role="option"
                        id={`${listboxId}-option-${index}`}
                        aria-selected={isHighlighted}
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        onFocus={() => setHighlightedIndex(index)}
                        onClick={() => handleSuggestionSelect(suggestion)}
                        className={`flex w-full flex-col gap-0.5 rounded-xl px-3 py-2 text-left transition-colors ${
                          isHighlighted
                            ? 'bg-white/15 text-white'
                            : 'text-white/90 hover:bg-white/10'
                        }`}
                      >
                        <span className="text-sm font-semibold">{suggestion.symbol}</span>
                        <span className="text-xs text-white/70">{suggestion.name}</span>
                        <span className="text-[10px] uppercase tracking-wide text-white/50">
                          {suggestion.region}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {searchLoading && (
                  <li className="list-none px-3 py-2 text-xs text-white/60" role="presentation">
                    検索中...
                  </li>
                )}
              </ul>
            )}
          </div>
          {searchLoading && (
            <p id={statusId} role="status" className="text-xs text-white/60">
              検索中です…
            </p>
          )}
          {showNoResults && (
            <p className="text-xs text-white/60">該当する候補が見つかりませんでした。</p>
          )}
          {searchError && (
            <p id={errorId} className="text-xs text-signal-sell">
              {searchError}
            </p>
          )}
        </div>
        <textarea
          ref={textareaRef}
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
        {chatError && <p className="text-xs text-signal-sell">{chatError}</p>}
      </form>
    </div>
  );
}
