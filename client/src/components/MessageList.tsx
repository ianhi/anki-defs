import { useRef, useEffect } from 'react';
import type { Message } from 'shared';
import ReactMarkdown from 'react-markdown';
import { CardPreview } from './CardPreview';
import { cn } from '@/lib/utils';
import { User, Bot } from 'lucide-react';

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

export function MessageList({ messages, isStreaming }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-3 max-w-md px-4">
          <p className="text-2xl font-medium">Bangla Vocabulary</p>
          <p className="text-base">
            Type a Bangla word to get its definition and create flashcards, or paste a sentence to
            analyze it.
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
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
      {messages.map((message, index) => {
        const isLastMessage = index === messages.length - 1;
        const showStreamingIndicator = isStreaming && isLastMessage && message.role === 'assistant';

        return (
          <div
            key={message.id}
            className={cn('flex gap-3', message.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            {message.role === 'assistant' && (
              <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-1">
                <Bot className="w-5 h-5 text-primary-foreground" />
              </div>
            )}

            <div
              className={cn(
                'max-w-[85%] rounded-xl px-5 py-4',
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground text-lg'
                  : 'bg-muted text-foreground'
              )}
            >
              {message.role === 'user' ? (
                <div className="whitespace-pre-wrap">{message.content}</div>
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

              {message.cardPreview && (
                <div className="mt-4 -mx-1">
                  <CardPreview preview={message.cardPreview} />
                </div>
              )}
            </div>

            {message.role === 'user' && (
              <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-1">
                <User className="w-5 h-5 text-secondary-foreground" />
              </div>
            )}
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}
