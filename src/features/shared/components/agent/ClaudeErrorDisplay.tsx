/**
 * Component for displaying Claude Code errors and warnings
 * Handles stop reasons and HTTP errors gracefully
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, AlertTriangle, CircleAlert, Info, XCircle } from 'lucide-react';

interface ClaudeErrorDisplayProps {
  error?: {
    type:
      | 'invalid_request_error'
      | 'authentication_error'
      | 'permission_error'
      | 'not_found_error'
      | 'request_too_large'
      | 'rate_limit_error'
      | 'api_error'
      | 'overloaded_error';
    message: string;
  };
  stopReason?:
    | 'end_turn'
    | 'max_tokens'
    | 'stop_sequence'
    | 'tool_use'
    | 'pause_turn'
    | 'refusal'
    | 'model_context_window_exceeded';
  stopSequence?: string | null;
  requestId?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Get user-friendly error information based on error type
 */
function getErrorInfo(errorType: NonNullable<ClaudeErrorDisplayProps['error']>['type']): {
  title: string;
  description: string;
  icon: typeof XCircle;
  variant: 'destructive' | 'default';
  showRetry: boolean;
} {
  switch (errorType) {
    case 'authentication_error':
      return {
        title: 'Authentication Error',
        description: 'There is an issue with your API key. Please check your settings.',
        icon: XCircle,
        variant: 'destructive',
        showRetry: false,
      };

    case 'rate_limit_error':
      return {
        title: 'Rate Limit Exceeded',
        description: 'Your account has hit a rate limit. Please wait a moment before trying again.',
        icon: AlertCircle,
        variant: 'destructive',
        showRetry: true,
      };

    case 'overloaded_error':
      return {
        title: 'Service Temporarily Overloaded',
        description: 'The API is experiencing high traffic. Please try again in a moment.',
        icon: AlertCircle,
        variant: 'destructive',
        showRetry: true,
      };

    case 'api_error':
      return {
        title: 'API Error',
        description:
          'An unexpected error occurred on the Claude servers. This may be due to tool use concurrency issues or other temporary problems. Please try again.',
        icon: XCircle,
        variant: 'destructive',
        showRetry: true,
      };

    case 'invalid_request_error':
      return {
        title: 'Invalid Request',
        description: 'There was an issue with the request format. Please check your input.',
        icon: AlertCircle,
        variant: 'destructive',
        showRetry: false,
      };

    case 'permission_error':
      return {
        title: 'Permission Error',
        description: 'Your API key does not have permission to use this resource.',
        icon: XCircle,
        variant: 'destructive',
        showRetry: false,
      };

    case 'not_found_error':
      return {
        title: 'Resource Not Found',
        description: 'The requested resource could not be found.',
        icon: AlertCircle,
        variant: 'destructive',
        showRetry: false,
      };

    case 'request_too_large':
      return {
        title: 'Request Too Large',
        description: 'Your request exceeds the maximum size limit of 32 MB.',
        icon: AlertCircle,
        variant: 'destructive',
        showRetry: false,
      };

    default:
      return {
        title: 'Error',
        description: 'An unexpected error occurred.',
        icon: XCircle,
        variant: 'destructive',
        showRetry: true,
      };
  }
}

/**
 * Get user-friendly stop reason information
 */
function getStopReasonInfo(stopReason: ClaudeErrorDisplayProps['stopReason']): {
  title: string;
  description: string;
  icon: typeof Info;
  variant: 'default' | 'destructive';
  isWarning: boolean;
} | null {
  switch (stopReason) {
    case 'max_tokens':
      return {
        title: 'Response Truncated',
        description: 'Claude reached the maximum token limit. The response was cut off.',
        icon: AlertTriangle,
        variant: 'default',
        isWarning: true,
      };

    case 'model_context_window_exceeded':
      return {
        title: 'Context Window Limit Reached',
        description:
          "Claude reached the model's context window limit. The response was limited by available context.",
        icon: AlertTriangle,
        variant: 'default',
        isWarning: true,
      };

    case 'refusal':
      return {
        title: 'Request Declined',
        description:
          'Claude declined to respond due to safety concerns. Please rephrase your request.',
        icon: XCircle,
        variant: 'destructive',
        isWarning: false,
      };

    case 'stop_sequence':
      return {
        title: 'Stopped at Custom Sequence',
        description: 'Claude encountered a custom stop sequence.',
        icon: Info,
        variant: 'default',
        isWarning: false,
      };

    case 'pause_turn':
      return {
        title: 'Operation Paused',
        description: 'A long-running operation was paused. Continuing...',
        icon: Info,
        variant: 'default',
        isWarning: false,
      };

    // Don't show alerts for normal stop reasons
    case 'end_turn':
    case 'tool_use':
      return null;

    default:
      return null;
  }
}

export function ClaudeErrorDisplay({
  error,
  stopReason,
  stopSequence,
  requestId,
  onRetry,
  className,
}: ClaudeErrorDisplayProps) {
  if (error) {
    const errorInfo = getErrorInfo(error.type);

    const isConcurrencyError =
      error.message.includes('400') && error.message.includes('concurrency');
    const isRewindSuggested = error.message.includes('/rewind');

    return (
      <div className={`flex gap-2 ${className || ''}`}>
        <CircleAlert className="h-4 w-4 text-red flex-shrink-0 mt-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium leading-none tracking-tight text-foreground mb-1">
            {error.message || errorInfo.description}
          </div>
          {isConcurrencyError && (
            <div className="mt-2 space-y-2 text-sm text-foreground">
              <p className="font-medium">What happened?</p>
              <p>
                Claude tried to use multiple tools at once, which isn't currently supported. This
                usually happens when processing complex requests with many parallel operations.
              </p>
              {isRewindSuggested && (
                <>
                  <p className="font-medium">How to fix it:</p>
                  <div className="space-y-1">
                    <p>• Use the command: /rewind to recover your conversation</p>
                    <p>• Then retry your request</p>
                    <p>• Consider breaking complex requests into smaller steps</p>
                  </div>
                </>
              )}
            </div>
          )}

          {errorInfo.showRetry && onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry} className="mt-2">
              Retry
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (stopReason) {
    const stopInfo = getStopReasonInfo(stopReason);

    if (!stopInfo) {
      return null; // Don't display anything for normal stop reasons
    }

    const Icon = stopInfo.icon;

    return (
      <Alert variant={stopInfo.variant} className={className}>
        <Icon className="h-4 w-4" />
        <AlertTitle className="flex items-center gap-2">
          {stopInfo.title}
          {requestId && (
            <Badge variant="outline" className="text-xs font-mono">
              {requestId}
            </Badge>
          )}
        </AlertTitle>
        <AlertDescription>
          <p>{stopInfo.description}</p>
          {stopReason === 'stop_sequence' && stopSequence && (
            <p className="text-sm text-muted-foreground mt-1">
              Stop sequence: <code className="font-mono">{stopSequence}</code>
            </p>
          )}
          {requestId && (
            <p className="text-sm text-muted-foreground mt-2">Request ID: {requestId}</p>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
