import { useRef, useEffect, useState, useCallback } from 'react';
import type { Message, TokenUsage } from 'shared';
import { MODEL_PRICING } from 'shared';
import { CardPreview } from './CardPreview';
import { Button } from './ui/Button';
import { cn, buildNoteFields } from '@/lib/utils';
import { useCreateNote, useAnkiStatus } from '@/hooks/useAnki';
import { useSettingsStore } from '@/hooks/useSettings';
import { useSessionCards } from '@/hooks/useSessionCards';
import { User, Bot, Eye, MessageSquare, Plus, Loader2 } from 'lucide-react';

function MarkedText({ text }: { text: string }) {
  // Render **word** markers as highlighted spans, preserving exact occurrences
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\*\*([^*]+)\*\*$/);
        return match ? (
          <span
            key={i}
            className="bg-yellow-300/40 text-inherit rounded px-0.5 font-semibold underline underline-offset-2 decoration-yellow-400"
          >
            {match[1]}
          </span>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
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
  retryWithContext?: (assistantMsgId: string, context: string) => void;
}

function CardPreviewList({
  messageId,
  previews,
  retryWithContext,
}: {
  messageId: string;
  previews: NonNullable<Message['cardPreviews']>;
  retryWithContext?: (assistantMsgId: string, context: string) => void;
}) {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [showDismissed, setShowDismissed] = useState(false);
  const [addingAll, setAddingAll] = useState(false);

  const { settings } = useSettingsStore();
  const sessionCards = useSessionCards();
  const { data: ankiConnected } = useAnkiStatus();
  const createNote = useCreateNote();

  const handleDismiss = useCallback((idx: number) => {
    setDismissed((prev) => new Set(prev).add(idx));
  }, []);

  const dismissedCount = dismissed.size;

  // Count how many cards haven't been added yet (O(n) via Set lookup)
  const addedWords = sessionCards.getWordsByLemma();
  const unadded = previews.filter((p) => !addedWords.has(p.word.toLowerCase().trim()));
  const showAddAll = previews.length > 1 && unadded.length > 1;

  const handleAddAll = async () => {
    setAddingAll(true);
    const targetDeck = settings.defaultDeck;
    const targetModel = settings.defaultModel;

    for (const preview of unadded) {
      if (!ankiConnected) {
        sessionCards.addToPendingQueue(preview, targetDeck, targetModel);
        continue;
      }
      try {
        const noteId = await createNote.mutateAsync({
          deckName: targetDeck,
          modelName: targetModel,
          fields: buildNoteFields(preview),
          tags: ['auto-generated'],
        });
        sessionCards.addCard(preview, targetDeck, targetModel, noteId);
      } catch (error) {
        console.error('Failed to create card, adding to queue:', error);
        sessionCards.addToPendingQueue(preview, targetDeck, targetModel);
      }
    }
    setAddingAll(false);
  };

  return (
    <div className="mt-4 -mx-1 space-y-3">
      {showAddAll && (
        <div className="flex justify-end">
          <Button
            onClick={handleAddAll}
            disabled={addingAll}
            size="sm"
            variant="outline"
            className="text-xs"
          >
            {addingAll ? (
              <>
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="h-3 w-3 mr-1.5" />
                Add All ({unadded.length})
              </>
            )}
          </Button>
        </div>
      )}
      {previews.map((preview, idx) => (
        <CardPreview
          key={`${messageId}-${preview.word}-${idx}`}
          preview={preview}
          isDismissed={dismissed.has(idx) && !showDismissed}
          onDismiss={() => handleDismiss(idx)}
          assistantMsgId={messageId}
          onRetryWithContext={retryWithContext}
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

export function MessageList({ messages, isStreaming, retryWithContext }: MessageListProps) {
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
      role="log"
      aria-label="Chat messages"
    >
      {messages.map((message, index) => {
        const isLastMessage = index === messages.length - 1;
        const showStreamingIndicator = isStreaming && isLastMessage && message.role === 'assistant';

        return (
          <div
            key={message.id}
            role="article"
            aria-label={`${message.role === 'user' ? 'You' : 'Assistant'}`}
            className={cn(
              'flex gap-2 sm:gap-3',
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {message.role === 'assistant' && (
              <div
                className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-1"
                aria-hidden="true"
              >
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
                  {message.content.includes('**') ? (
                    <MarkedText text={message.content} />
                  ) : (
                    message.content
                  )}
                </div>
              ) : (
                <>
                  {message.refinements && message.refinements.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {message.refinements.map((r, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 text-xs bg-background/50 text-muted-foreground border border-border rounded-full px-2 py-0.5"
                        >
                          <MessageSquare className="h-2.5 w-2.5" />
                          &quot;{r}&quot;
                        </span>
                      ))}
                    </div>
                  )}
                  {showStreamingIndicator && !message.cardPreviews?.length && (
                    <div className="flex gap-1 py-2" role="status" aria-label="Loading response">
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
                <CardPreviewList
                  messageId={message.id}
                  previews={message.cardPreviews}
                  retryWithContext={retryWithContext}
                />
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
              <div
                className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-1"
                aria-hidden="true"
              >
                <User className="w-4 h-4 sm:w-5 sm:h-5 text-secondary-foreground" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
