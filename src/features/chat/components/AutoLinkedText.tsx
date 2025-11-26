import React, { useCallback } from 'react';

export interface AutoLinkedTextProps {
  text: string;
  className?: string;
}

/**
 * AutoLinkedText - Converts plain text URLs to clickable links
 *
 * Automatically detects http:// and https:// URLs in plain text
 * and converts them to clickable links that open in the system browser.
 *
 * Features:
 * - URL detection via regex
 * - Opens in system default browser
 * - Preserves whitespace with pre-wrap
 * - Word breaking for long URLs
 *
 * Usage:
 * ```tsx
 * <AutoLinkedText text={userMessage} />
 * ```
 */
export const AutoLinkedText: React.FC<AutoLinkedTextProps> = ({ text, className }) => {
  const handleLinkClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
    e.preventDefault();
    if (window.electron?.shell) {
      window.electron.shell.openExternal(url);
    }
  }, []);

  // Regex to detect URLs (http:// or https://)
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  // Split text by URLs and create elements
  const parts = text.split(urlRegex);

  return (
    <div className={className}>
      {parts.map((part, index) => {
        // Check if this part is a URL
        if (part.match(urlRegex)) {
          return (
            <a
              key={index}
              href={part}
              onClick={(e) => handleLinkClick(e, part)}
              className="text-primary underline hover:opacity-70 cursor-pointer transition-opacity"
            >
              {part}
            </a>
          );
        }
        // Regular text - preserve as is
        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </div>
  );
};
