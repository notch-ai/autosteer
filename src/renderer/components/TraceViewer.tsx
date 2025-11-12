/**
 * TraceViewer Component (Placeholder for Future Enhancement)
 *
 * This component is a placeholder for a future trace viewer UI that will
 * allow viewing and analyzing SDK message trace logs.
 *
 * Future Features:
 * - Display trace log entries from ~/.autosteer/traces/
 * - Filter by session ID, message type, direction
 * - Search through trace messages
 * - Syntax highlighting for JSON messages
 * - Export filtered results
 * - Timeline view of message flow
 * - Correlation ID tracking visualization
 *
 * Implementation Notes:
 * - Use virtual scrolling for large trace files
 * - Parse JSONL files asynchronously
 * - Implement real-time trace file watching (optional)
 * - Add message diff view for comparing versions
 */

import React from 'react';

interface TraceViewerProps {
  sessionId?: string;
  traceFilePath?: string;
}

/**
 * TraceViewer Component
 *
 * @remarks
 * This is a placeholder component.
 *
 * @example
 * ```tsx
 * <TraceViewer sessionId="session-abc123" />
 * ```
 */
export const TraceViewer: React.FC<TraceViewerProps> = ({ sessionId, traceFilePath }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-muted-foreground">
      <div className="max-w-md text-center space-y-4">
        <h2 className="text-2xl font-semibold">Trace Viewer</h2>
        <p>
          The trace viewer is a future enhancement that will allow you to view and analyze SDK
          message trace logs.
        </p>

        {sessionId && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="text-sm">
              <strong>Session ID:</strong> {sessionId}
            </p>
          </div>
        )}

        {traceFilePath && (
          <div className="mt-2 p-4 bg-muted rounded-lg">
            <p className="text-sm">
              <strong>Trace File:</strong> {traceFilePath}
            </p>
          </div>
        )}

        <div className="mt-6 text-left text-sm space-y-2">
          <p className="font-semibold">Planned Features:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>View trace log entries from ~/.autosteer/traces/</li>
            <li>Filter by session ID, message type, direction</li>
            <li>Search through trace messages</li>
            <li>JSON syntax highlighting</li>
            <li>Correlation ID tracking</li>
            <li>Timeline visualization</li>
          </ul>
        </div>

        <div className="mt-6">
          <p className="text-xs text-muted-foreground">
            Manual trace file viewing: Open{' '}
            <code className="px-1 py-0.5 bg-muted rounded">~/.autosteer/traces/</code> in your file
            explorer
          </p>
        </div>
      </div>
    </div>
  );
};

export default TraceViewer;
