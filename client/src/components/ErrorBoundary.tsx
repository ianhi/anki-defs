import { Component, type ErrorInfo, type ReactNode } from 'react';
import { createLogger } from '@/lib/logger';

const log = createLogger('ErrorBoundary');

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    log.error(error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="p-4 text-sm text-destructive">
          <p className="font-medium">Something went wrong</p>
          <p className="text-muted-foreground mt-1">{this.state.error.message}</p>
          <button
            className="mt-2 text-xs underline hover:no-underline"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
