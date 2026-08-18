import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React render error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleRecoverState = () => {
    try {
      const backup = localStorage.getItem('mrsketch_project_layout_backup_v1');
      if (backup) {
        localStorage.setItem('mrsketch_project_layout_v1', backup);
      } else {
        localStorage.removeItem('mrsketch_project_layout_v1');
      }
    } catch (e) {
      console.error('Recovery failed:', e);
    }
    window.location.reload();
  };

  private handleDownloadRawBackup = () => {
    try {
      const saved = localStorage.getItem('mrsketch_project_layout_v1') || localStorage.getItem('mrsketch_project_layout_backup_v1');
      if (!saved) {
        alert('No saved layout state found in storage');
        return;
      }
      const blob = new Blob([saved], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `emergency_backup_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e: any) {
      alert(`Export failed: ${e.message}`);
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen w-screen bg-slate-950 text-slate-100 p-6 font-sans">
          <div className="bg-slate-900 border border-red-500/50 rounded-2xl p-8 max-w-lg w-full shadow-2xl flex flex-col items-center text-center gap-4">
            <div className="p-3 bg-red-950/80 text-red-400 rounded-full border border-red-800">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Application Error Encountered</h2>
              <p className="text-xs text-slate-400 mt-1">
                A rendering glitch occurred. Don't worry — your diagram data is safe in auto-save backup.
              </p>
            </div>

            {this.state.error && (
              <div className="w-full bg-slate-950 p-3 rounded-lg border border-slate-800 text-left font-mono text-[11px] text-red-300 max-h-32 overflow-y-auto">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex gap-3 w-full pt-2">
              <button
                onClick={this.handleDownloadRawBackup}
                className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition"
              >
                Download JSON Backup
              </button>
              <button
                onClick={this.handleRecoverState}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg"
              >
                Recover Working State
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
