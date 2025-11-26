import { CircleCheck, XCircle } from 'lucide-react';
import { memo } from 'react';

interface PermissionActionDisplayProps {
  type: 'accepted' | 'rejected';
  file_path: string;
  old_string?: string | undefined;
  new_string?: string | undefined;
  content?: string | undefined;
}

export const PermissionActionDisplay = memo<PermissionActionDisplayProps>(
  ({ type, file_path, old_string, new_string, content }) => {
    const isAccepted = type === 'accepted';

    return (
      <div className={`rounded-lg py-2`}>
        <div className="flex items-start gap-2 mb-1">
          {isAccepted ? (
            <CircleCheck className="h-4 w-4 text-success flex-shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 text-danger flex-shrink-0" />
          )}
          <div className="text-sm">
            {isAccepted ? 'Update' : 'Rejected update to'} {file_path}
          </div>
        </div>

        {/* Show the diff if we have old/new strings */}
        {(old_string || new_string) && (
          <div className="space-y-0 overflow-hidden max-h-[400px] overflow-y-auto mb-2 mx-2">
            {old_string && (
              <div>
                {old_string.split('\n').map((line: string, i: number) => (
                  <div
                    key={`old-${i}`}
                    className="flex font-mono text-sm leading-5 bg-red-50 dark:bg-red-950"
                  >
                    <span className="inline-block px-2 text-right select-none flex-shrink-0 w-16 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300">
                      {i + 1}
                    </span>
                    <span className="px-2 select-none text-red-600 dark:text-red-400">-</span>
                    <span className="flex-1 pr-3 text-foreground">{line || ' '}</span>
                  </div>
                ))}
              </div>
            )}

            {new_string && (
              <div>
                {new_string.split('\n').map((line: string, i: number) => (
                  <div
                    key={`new-${i}`}
                    className="flex font-mono text-sm leading-5 bg-green-50 dark:bg-green-950"
                  >
                    <span className="inline-block px-2 text-right select-none flex-shrink-0 w-16 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                      {i + 1}
                    </span>
                    <span className="px-2 select-none text-green-600 dark:text-green-400">+</span>
                    <span className="flex-1 pr-3 text-foreground">{line || ' '}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Show content if it's a Write operation (new file) */}
        {content && !old_string && (
          <div className="space-y-0 overflow-hidden max-h-[400px] overflow-y-auto mb-2 mx-2">
            <div>
              {content
                .split('\n')
                .slice(0, 50)
                .map((line: string, i: number) => (
                  <div
                    key={`content-${i}`}
                    className="flex font-mono text-sm leading-5 bg-green-50 dark:bg-green-950"
                  >
                    <span className="inline-block px-2 text-right select-none flex-shrink-0 w-16 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                      {i + 1}
                    </span>
                    <span className="px-2 select-none text-green-600 dark:text-green-400">+</span>
                    <span className="flex-1 pr-3 text-foreground">{line || ' '}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {isAccepted && (
          <div className="text-sm text-muted-foreground">
            Updated <span className="font-mono">{file_path.split('/').pop()}</span> with{' '}
            {(new_string || content || '').split('\n').length} additions
          </div>
        )}
      </div>
    );
  }
);

PermissionActionDisplay.displayName = 'PermissionActionDisplay';
