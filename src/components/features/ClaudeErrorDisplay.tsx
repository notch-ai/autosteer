/**
 * Component for displaying Claude Code errors and warnings
 * Handles stop reasons and HTTP errors gracefully
 */

import { AlertCircle, AlertTriangle, Info, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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
          'An unexpected error occurred on Claude servers. Please try again or contact support.',
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
    const Icon = errorInfo.icon;

    return (
      <Alert variant={errorInfo.variant} className={className}>
        <Icon className="h-4 w-4" />
        <AlertTitle className="flex items-center gap-2">
          {errorInfo.title}
          {requestId && (
            <Badge variant="outline" className="text-[10px] font-mono">
              {requestId}
            </Badge>
          )}
        </AlertTitle>
        <AlertDescription>
          <p className="mb-2">{error.message || errorInfo.description}</p>
          {errorInfo.showRetry && onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry} className="mt-2">
              Retry
            </Button>
          )}
          {requestId && (
            <p className="text-sm text-muted-foreground mt-2">Request ID: {requestId}</p>
          )}
        </AlertDescription>
      </Alert>
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
            <Badge variant="outline" className="text-[10px] font-mono">
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
