import { Component, ReactNode } from "react";

interface State { error: Error | null }

export class RouteErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error("[RouteErrorBoundary]", error); }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 text-center">
          <div className="max-w-md space-y-3">
            <h1 className="text-lg font-semibold">Something went wrong loading this page.</h1>
            <p className="text-sm text-muted-foreground break-words">{this.state.error.message}</p>
            <button
              className="px-4 py-2 rounded-md border text-sm"
              onClick={() => { this.setState({ error: null }); location.reload(); }}
            >Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}