describe('Token Replacement Script', () => {
  const TOKEN_MAP = {
    'text-text-muted': 'text-muted-foreground',
    'bg-button-special': 'bg-primary',
    'text-text': 'text-foreground',
    'bg-surface': 'bg-card',
  };

  const replaceTokens = (content: string): string => {
    let result = content;

    Object.entries(TOKEN_MAP).forEach(([oldToken, newToken]) => {
      const regex = new RegExp(`\\b${oldToken}\\b`, 'g');
      result = result.replace(regex, newToken);
    });

    return result;
  };

  describe('Basic Token Replacement', () => {
    it('should replace bg-surface with bg-card', () => {
      const input = 'className="bg-surface rounded"';
      const expected = 'className="bg-card rounded"';
      expect(replaceTokens(input)).toBe(expected);
    });

    it('should replace text-text with text-foreground', () => {
      const input = 'className="text-text font-medium"';
      const expected = 'className="text-foreground font-medium"';
      expect(replaceTokens(input)).toBe(expected);
    });

    it('should replace bg-button-special with bg-primary', () => {
      const input = 'className="bg-button-special hover:opacity-90"';
      const expected = 'className="bg-primary hover:opacity-90"';
      expect(replaceTokens(input)).toBe(expected);
    });

    it('should replace text-text-muted with text-muted-foreground', () => {
      const input = 'className="text-text-muted text-sm"';
      const expected = 'className="text-muted-foreground text-sm"';
      expect(replaceTokens(input)).toBe(expected);
    });
  });

  describe('Multiple Token Replacement', () => {
    it('should replace multiple different tokens in one line', () => {
      const input = 'className="bg-surface text-text rounded"';
      const expected = 'className="bg-card text-foreground rounded"';
      expect(replaceTokens(input)).toBe(expected);
    });

    it('should replace tokens across multiple lines', () => {
      const input = `
        <div className="bg-surface">
          <span className="text-text-muted">Hello</span>
        </div>
      `;
      const expected = `
        <div className="bg-card">
          <span className="text-muted-foreground">Hello</span>
        </div>
      `;
      expect(replaceTokens(input)).toBe(expected);
    });

    it('should replace same token multiple times', () => {
      const input = 'bg-surface bg-surface bg-surface';
      const expected = 'bg-card bg-card bg-card';
      expect(replaceTokens(input)).toBe(expected);
    });
  });

  describe('Edge Cases', () => {
    it('should not replace text-text when it is part of text-text-muted', () => {
      const input = 'className="text-text-muted"';
      const result = replaceTokens(input);
      expect(result).toBe('className="text-muted-foreground"');
      expect(result).not.toContain('text-foreground-muted');
    });

    it('should handle tokens in conditional className expressions', () => {
      const input = 'className={cn("bg-surface", isActive && "text-text")}';
      const expected = 'className={cn("bg-card", isActive && "text-foreground")}';
      expect(replaceTokens(input)).toBe(expected);
    });

    it('should handle tokens in template literals', () => {
      const input = 'className={`bg-surface ${isActive ? "text-text" : "text-text-muted"}`}';
      const expected =
        'className={`bg-card ${isActive ? "text-foreground" : "text-muted-foreground"}`}';
      expect(replaceTokens(input)).toBe(expected);
    });

    it('should handle tokens with hyphens in class names', () => {
      const input = 'className="hover:bg-surface focus:text-text"';
      const expected = 'className="hover:bg-card focus:text-foreground"';
      expect(replaceTokens(input)).toBe(expected);
    });

    it('should replace tokens in both comments and code', () => {
      const input = '// Use bg-surface for card backgrounds\nclassName="bg-surface"';
      const expected = '// Use bg-card for card backgrounds\nclassName="bg-card"';
      expect(replaceTokens(input)).toBe(expected);
    });

    it('should handle empty strings', () => {
      const input = '';
      const expected = '';
      expect(replaceTokens(input)).toBe(expected);
    });

    it('should handle strings with no tokens', () => {
      const input = 'className="flex items-center gap-2"';
      const expected = 'className="flex items-center gap-2"';
      expect(replaceTokens(input)).toBe(expected);
    });
  });

  describe('Real Component Examples', () => {
    it('should replace tokens in ChatInterface component', () => {
      const input = `
        <div className={cn(
          'mb-1 group min-w-0 max-w-full select-text',
          message.role === 'user'
            ? 'text-text-muted bg-background rounded px-1 py-1'
            : 'text-text bg-muted rounded px-1 py-1 pb-2'
        )}
      `;

      const result = replaceTokens(input);

      expect(result).toContain('text-muted-foreground');
      expect(result).toContain('text-foreground');
      expect(result).not.toContain('text-text-muted');
      expect(result).not.toContain('text-text ');
    });

    it('should replace tokens in Button component variant definition', () => {
      const input = `
        const buttonVariants = cva(
          "bg-surface text-text hover:bg-button-special",
          {
            variants: {
              variant: {
                default: "bg-surface text-text",
                muted: "text-text-muted"
              }
            }
          }
        )
      `;

      const result = replaceTokens(input);

      expect(result).toContain('bg-card');
      expect(result).toContain('text-foreground');
      expect(result).toContain('bg-primary');
      expect(result).toContain('text-muted-foreground');
    });

    it('should replace tokens in Sidebar component', () => {
      const input = 'className="flex flex-col bg-surface border-r border-border"';
      const expected = 'className="flex flex-col bg-card border-r border-border"';
      expect(replaceTokens(input)).toBe(expected);
    });
  });

  describe('TypeScript/TSX Patterns', () => {
    it('should handle tokens in JSX className prop', () => {
      const input = '<div className="bg-surface text-text" />';
      const expected = '<div className="bg-card text-foreground" />';
      expect(replaceTokens(input)).toBe(expected);
    });

    it('should handle tokens in cn() utility calls', () => {
      const input = 'cn("bg-surface", className)';
      const expected = 'cn("bg-card", className)';
      expect(replaceTokens(input)).toBe(expected);
    });

    it('should handle tokens in style object strings', () => {
      const input = `style={{ backgroundColor: 'bg-surface' }}`;
      const expected = `style={{ backgroundColor: 'bg-card' }}`;
      expect(replaceTokens(input)).toBe(expected);
    });
  });

  describe('Order-Dependent Replacement', () => {
    it('should replace text-text-muted before text-text to avoid double replacement', () => {
      const input = 'text-text-muted text-text';
      const result = replaceTokens(input);

      expect(result).toBe('text-muted-foreground text-foreground');
      expect(result).not.toContain('text-foreground-muted');
    });

    it('should handle overlapping token patterns correctly', () => {
      const input = 'className="text-text text-text-muted bg-surface bg-button-special"';
      const result = replaceTokens(input);

      expect(result).toContain('text-foreground');
      expect(result).toContain('text-muted-foreground');
      expect(result).toContain('bg-card');
      expect(result).toContain('bg-primary');
    });
  });
});
