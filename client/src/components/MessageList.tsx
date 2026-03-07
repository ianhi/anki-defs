import { useRef, useEffect, useState, useCallback } from 'react';
import type { Message, TokenUsage } from 'shared';
import { MODEL_PRICING } from 'shared';
import ReactMarkdown from 'react-markdown';
import { CardPreview } from './CardPreview';
import { cn } from '@/lib/utils';
import { User, Bot, Eye } from 'lucide-react';

function HighlightedText({ text, words }: { text: string; words: string[] }) {
  // Build a regex that matches any of the highlighted words
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'g');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        words.includes(part) ? (
          <span
            key={i}
            className="bg-yellow-300/40 text-inherit rounded px-0.5 font-semibold underline underline-offset-2 decoration-yellow-400"
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function formatCost(usage: TokenUsage): string {
  const pricing = usage.model ? MODEL_PRICING[usage.model] : undefined;
  if (!pricing) return '';
  const cost =
    (usage.inputTokens * pricing.input + usage.outputTokens * pricing.output) / 1_000_000;
  if (cost === 0) return '';
  return cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(2)}`;
}

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
}

// Render assistant message - use markdown only when not streaming
function AssistantMessage({ content, isStreaming }: { content: string; isStreaming: boolean }) {
  // During streaming, show plain text to avoid broken markdown rendering
  if (isStreaming) {
    return <div className="whitespace-pre-wrap text-base leading-relaxed">{content}</div>;
  }

  // After streaming completes, render with markdown
  return (
    <div className="prose prose-base dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-headings:my-3">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

function CardPreviewList({
  messageId,
  previews,
}: {
  messageId: string;
  previews: NonNullable<Message['cardPreviews']>;
}) {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [showDismissed, setShowDismissed] = useState(false);

  const handleDismiss = useCallback((idx: number) => {
    setDismissed((prev) => new Set(prev).add(idx));
  }, []);

  const dismissedCount = dismissed.size;

  return (
    <div className="mt-4 -mx-1 space-y-3">
      {previews.map((preview, idx) => (
        <CardPreview
          key={`${messageId}-${preview.word}-${idx}`}
          preview={preview}
          isDismissed={dismissed.has(idx) && !showDismissed}
          onDismiss={() => handleDismiss(idx)}
        />
      ))}
      {dismissedCount > 0 && (
        <button
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          onClick={() => setShowDismissed(!showDismissed)}
        >
          <Eye className="h-3 w-3" />
          {showDismissed ? 'Hide dismissed' : `Show ${dismissedCount} dismissed`}
        </button>
      )}
    </div>
  );
}

export function MessageList({ messages, isStreaming }: MessageListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, isStreaming]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-3 max-w-md px-6">
          <p className="text-xl sm:text-2xl font-medium">Bangla Vocabulary</p>
          <p className="text-sm sm:text-base">
            Type a Bangla word or sentence to get definitions and create flashcards.
          </p>
          <div className="text-sm space-y-1 mt-4">
            <p>Examples:</p>
            <p className="font-medium">পানি • সুন্দর • ভালো</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto px-2 py-3 sm:px-4 sm:py-6 space-y-4 sm:space-y-6"
    >
      {messages.map((message, index) => {
        const isLastMessage = index === messages.length - 1;
        const showStreamingIndicator = isStreaming && isLastMessage && message.role === 'assistant';

        return (
          <div
            key={message.id}
            className={cn(
              'flex gap-2 sm:gap-3',
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {message.role === 'assistant' && (
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-1">
                <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
              </div>
            )}

            <div
              className={cn(
                'max-w-[90%] sm:max-w-[85%] rounded-xl px-3 py-2.5 sm:px-5 sm:py-4',
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground text-base sm:text-lg'
                  : 'bg-muted text-foreground'
              )}
            >
              {message.role === 'user' ? (
                <div className="whitespace-pre-wrap">
                  {message.highlightedWords && message.highlightedWords.length > 0 ? (
                    <HighlightedText text={message.content} words={message.highlightedWords} />
                  ) : (
                    message.content
                  )}
                </div>
              ) : (
                <>
                  <AssistantMessage
                    content={message.content}
                    isStreaming={showStreamingIndicator}
                  />
                  {showStreamingIndicator && !message.content && (
                    <div className="flex gap-1 py-2">
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                      <span
                        className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                        style={{ animationDelay: '0.1s' }}
                      />
                      <span
                        className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                        style={{ animationDelay: '0.2s' }}
                      />
                    </div>
                  )}
                </>
              )}

              {message.cardPreviews && message.cardPreviews.length > 0 && (
                <CardPreviewList messageId={message.id} previews={message.cardPreviews} />
              )}

              {message.role === 'assistant' && message.tokenUsage && !showStreamingIndicator && (
                <div
                  className="mt-2 text-xs text-muted-foreground tabular-nums"
                  title={`Input: ${message.tokenUsage.inputTokens} | Output: ${message.tokenUsage.outputTokens} | ${message.tokenUsage.model ?? message.tokenUsage.provider}`}
                >
                  {message.tokenUsage.inputTokens + message.tokenUsage.outputTokens} tok
                  {(() => {
                    const cost = formatCost(message.tokenUsage);
                    return cost ? ` · ${cost}` : '';
                  })()}
                </div>
              )}
            </div>

            {message.role === 'user' && (
              <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-1">
                <User className="w-4 h-4 sm:w-5 sm:h-5 text-secondary-foreground" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
