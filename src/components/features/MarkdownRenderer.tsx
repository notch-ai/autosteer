import { cn } from '@/commons/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import React from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import { Prism as SyntaxHighlighterBase } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

// Type assertion to fix TypeScript incompatibility with react-syntax-highlighter
const SyntaxHighlighter = SyntaxHighlighterBase as any;

export interface MarkdownRendererProps {
  content: string;
  className?: string;
  linkTarget?: '_blank' | '_self';
  allowedElements?: string[];
  disallowedElements?: string[];
}

/**
 * Feature component for MarkdownRenderer
 * Migrated to use shadcn/ui components for all visual elements
 * Provides markdown parsing with syntax highlighting and custom rendering
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className,
  linkTarget = '_blank',
  allowedElements,
  disallowedElements,
}) => {
  const components: Partial<Components> = {
    // Code blocks with syntax highlighting
    code({ inline, className: codeClassName, children, ...props }: any) {
      const match = /language-(\w+)/.exec(codeClassName || '');
      const language = match ? match[1] : '';

      if (!inline && language) {
        return (
          <Card className="my-0.5 p-0 overflow-hidden max-w-full">
            <div className="bg-muted px-3 py-2 border-b border-border">
              <Badge variant="secondary" className="text-sm">
                {language}
              </Badge>
            </div>
            <div className="overflow-x-auto max-w-full">
              <SyntaxHighlighter
                style={vscDarkPlus as any}
                language={language}
                PreTag="div"
                customStyle={{
                  margin: 0,
                  borderRadius: 0,
                  fontSize: '0.875rem',
                  padding: '1rem',
                  backgroundColor: 'transparent',
                  overflowX: 'auto',
                  maxWidth: '100%',
                }}
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            </div>
          </Card>
        );
      }

      // Inline code
      return (
        <code className="inline-code-highlight" {...props}>
          {children}
        </code>
      );
    },

    // Custom link renderer
    a({ href, children, ...props }: any) {
      const handleClick = (e: React.MouseEvent) => {
        if (linkTarget === '_blank' && href) {
          e.preventDefault();
          if (window.electron?.shell) {
            window.electron.shell.openExternal(href);
          } else {
            window.open(href, '_blank', 'noopener,noreferrer');
          }
        }
      };

      return (
        <a
          href={href}
          onClick={handleClick}
          className={cn(
            'text-primary hover:text-primary/80',
            'underline underline-offset-2',
            'transition-colors'
          )}
          target={linkTarget}
          rel={linkTarget === '_blank' ? 'noopener noreferrer' : undefined}
          {...props}
        >
          {children}
        </a>
      );
    },

    // Custom pre renderer for code blocks without language
    pre({ children, ...props }: any) {
      // Check if the child is a code element without language
      if (
        React.isValidElement(children) &&
        children.type === 'code' &&
        !(children.props as any)?.className
      ) {
        const codeContent = String((children.props as any)?.children || '').replace(/\n$/, '');
        return (
          <Card className="my-0.5 p-0 overflow-hidden max-w-full">
            <div className="overflow-x-auto max-w-full">
              <SyntaxHighlighter
                style={vscDarkPlus as any}
                language="text"
                PreTag="div"
                customStyle={{
                  margin: 0,
                  borderRadius: 0,
                  fontSize: '0.875rem',
                  padding: '1rem',
                  overflowX: 'auto',
                  maxWidth: '100%',
                }}
                {...props}
              >
                {codeContent}
              </SyntaxHighlighter>
            </div>
          </Card>
        );
      }
      return (
        <pre
          className={cn(
            'overflow-x-auto p-4 my-0.5 max-w-full',
            'bg-muted rounded-md',
            'text-sm font-mono'
          )}
          {...props}
        >
          {children}
        </pre>
      );
    },

    // Headings with proper styling
    h1: ({ children, ...props }: any) => (
      <h1 className="text-base font-bold mt-2 mb-1 text-text" {...props}>
        {children}
      </h1>
    ),
    h2: ({ children, ...props }: any) => (
      <h2 className="text-base font-semibold mt-1.5 mb-1 text-text" {...props}>
        {children}
      </h2>
    ),
    h3: ({ children, ...props }: any) => (
      <h3 className="text-sm font-semibold mt-1 mb-0.5 text-text" {...props}>
        {children}
      </h3>
    ),
    h4: ({ children, ...props }: any) => (
      <h4 className="text-sm font-medium mt-1 mb-0.5 text-text" {...props}>
        {children}
      </h4>
    ),
    h5: ({ children, ...props }: any) => (
      <h5 className="text-sm font-medium mt-1 mb-0.5 text-text" {...props}>
        {children}
      </h5>
    ),
    h6: ({ children, ...props }: any) => (
      <h6 className="text-sm font-medium mt-1 mb-0.5 text-text-muted" {...props}>
        {children}
      </h6>
    ),

    // Paragraphs
    p: ({ children, ...props }: any) => (
      <p className="my-0.5 leading-relaxed text-text break-words" {...props}>
        {children}
      </p>
    ),

    // Lists
    ul: ({ children, ...props }: any) => (
      <ul className="my-1 ml-6 list-disc space-y-1 text-text" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }: any) => (
      <ol className="my-1 ml-6 list-decimal space-y-1 text-text" {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }: any) => (
      <li className="pl-1" {...props}>
        {children}
      </li>
    ),

    // Blockquotes
    blockquote: ({ children, ...props }: any) => (
      <Alert className="my-0.5 border-l-4 border-border" {...props}>
        <AlertDescription className="text-text-muted italic">{children}</AlertDescription>
      </Alert>
    ),

    // Horizontal rule
    hr: ({ ...props }: any) => <Separator className="my-3" {...props} />,

    // Tables with shadcn styling
    table: ({ children, ...props }: any) => (
      <div className="my-0.5 overflow-x-auto max-w-full">
        <table className="w-full border-collapse" {...props}>
          {children}
        </table>
      </div>
    ),
    thead: ({ children, ...props }: any) => (
      <thead className="border-b border-border bg-muted" {...props}>
        {children}
      </thead>
    ),
    tbody: ({ children, ...props }: any) => (
      <tbody className="divide-y divide-border" {...props}>
        {children}
      </tbody>
    ),
    tr: ({ children, ...props }: any) => (
      <tr className="hover:bg-muted/50 transition-colors" {...props}>
        {children}
      </tr>
    ),
    th: ({ children, ...props }: any) => (
      <th className="px-4 py-2 text-left font-semibold text-text" {...props}>
        {children}
      </th>
    ),
    td: ({ children, ...props }: any) => (
      <td className="px-4 py-2 text-text" {...props}>
        {children}
      </td>
    ),

    // Images
    img: ({ src, alt, ...props }: any) => (
      <img
        src={src}
        alt={alt}
        className={cn('my-0.5 max-w-full h-auto', 'rounded-md border border-border')}
        loading="lazy"
        {...props}
      />
    ),

    // Strong/Bold
    strong: ({ children, ...props }: any) => (
      <strong className="font-semibold text-text" {...props}>
        {children}
      </strong>
    ),

    // Emphasis/Italic
    em: ({ children, ...props }: any) => (
      <em className="italic" {...props}>
        {children}
      </em>
    ),

    // Strikethrough
    del: ({ children, ...props }: any) => (
      <del className="line-through text-text-muted" {...props}>
        {children}
      </del>
    ),

    // Task lists (GFM)
    input: ({ type, checked, ...props }: any) => {
      if (type === 'checkbox') {
        return <Checkbox checked={checked} disabled className="mr-2" {...props} />;
      }
      return <input type={type} {...props} />;
    },
  };

  return (
    <div
      data-testid="markdown-renderer"
      className={cn(
        'markdown-content',
        'max-w-full overflow-x-hidden overflow-y-visible',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={components}
        allowedElements={allowedElements}
        disallowedElements={disallowedElements}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
