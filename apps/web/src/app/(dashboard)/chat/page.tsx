'use client';

import { useEffect, useRef, useState } from 'react';
import { useChat } from 'ai/react';
import ReactMarkdown from 'react-markdown';
import { Send, Plus, MessageSquare, Trash2, ChevronLeft } from 'lucide-react';

interface Conversation {
  id: string;
  title: string | null;
  messageCount: number;
  updatedAt: string;
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConvIdRef = useRef<string | null>(null);
  activeConvIdRef.current = activeConvId;

  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages } = useChat({
    api: '/api/chat',
    body: { conversationId: activeConvId },
    onResponse: (response) => {
      const newId = response.headers.get('X-Conversation-Id');
      if (newId && !activeConvIdRef.current) {
        setActiveConvId(newId);
      }
    },
    onFinish: () => {
      loadConversations();
    },
  });

  const loadConversations = () => {
    fetch('/api/conversations')
      .then(r => r.json() as Promise<Conversation[]>)
      .then(setConversations)
      .catch(() => {});
  };

  useEffect(() => { loadConversations(); }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startNewConversation = () => {
    setActiveConvId(null);
    setMessages([]);
  };

  const openConversation = async (id: string) => {
    setActiveConvId(id);
    const data = await fetch(`/api/conversations/${id}`).then(r => r.json()) as { messages: Array<{ role: 'user' | 'assistant'; content: string }> };
    setMessages(
      (data.messages ?? []).map((m, i) => ({
        id: `${id}-${i}`,
        role: m.role,
        content: m.content,
      })),
    );
    setShowSidebar(false);
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
    if (activeConvId === id) {
      setActiveConvId(null);
      setMessages([]);
    }
    loadConversations();
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] -mx-6 -my-6">
      {/* Conversation sidebar */}
      <div className={`${showSidebar ? 'flex' : 'hidden'} lg:flex flex-col w-full lg:w-72 border-r border-zinc-800 bg-zinc-950`}>
        <div className="p-4 border-b border-zinc-800">
          <button
            onClick={startNewConversation}
            className="flex items-center gap-2 w-full text-sm px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nová konverzace
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-8">Žádné konverzace</p>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                role="button"
                tabIndex={0}
                onClick={() => openConversation(conv.id)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') openConversation(conv.id); }}
                className={`w-full text-left p-3 rounded-lg transition-colors group flex items-center justify-between gap-2 cursor-pointer ${
                  activeConvId === conv.id ? 'bg-zinc-800' : 'hover:bg-zinc-900'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm text-zinc-200 truncate">{conv.title ?? 'Nová konverzace'}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {new Date(conv.updatedAt).toLocaleDateString('cs-CZ')} · {conv.messageCount} zpráv
                  </p>
                </div>
                <button
                  onClick={e => deleteConversation(conv.id, e)}
                  className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all flex-shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-zinc-950">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
          <button
            onClick={() => setShowSidebar(s => !s)}
            className="lg:hidden p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <MessageSquare className="h-4 w-4 text-blue-400" />
          <h2 className="text-sm font-medium text-zinc-100">AI Trenér</h2>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center">
                <MessageSquare className="h-8 w-8 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-100 mb-2">Tvůj AI trenér</h3>
                <p className="text-sm text-zinc-400 max-w-md">
                  Zeptej se na dnešní zdravotní metriky, tréninkový plán, nebo požádej o analýzu výkonu.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  'Jak jsem spal/a dnes?',
                  'Co mám dnes trénovat?',
                  'Jak jsem na tom s HRV tento týden?',
                  'Vygeneruj mi plán na příští týden',
                ].map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      const event = { target: { value: suggestion } } as React.ChangeEvent<HTMLInputElement>;
                      handleInputChange(event);
                    }}
                    className="text-xs px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-full text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map(message => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-7 h-7 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-xs">🏃</span>
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-zinc-800 text-zinc-100 rounded-bl-sm'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-headings:text-zinc-100 prose-strong:text-zinc-100 prose-code:text-blue-300">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xs">🏃</span>
              </div>
              <div className="bg-zinc-800 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 pb-4 pt-2 border-t border-zinc-800">
          <form onSubmit={handleSubmit} className="flex gap-2 items-end">
            <textarea
              value={input}
              onChange={e => handleInputChange(e as unknown as React.ChangeEvent<HTMLInputElement>)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim() && !isLoading) {
                    handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
                  }
                }
              }}
              placeholder="Napiš zprávu... (Enter = odeslat, Shift+Enter = nový řádek)"
              rows={1}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none max-h-32 overflow-y-auto"
              style={{ minHeight: '44px' }}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="flex-shrink-0 w-11 h-11 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
