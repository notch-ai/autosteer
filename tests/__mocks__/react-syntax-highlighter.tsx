export const Prism = ({ children }: { children: string }) => {
  return <pre>{children}</pre>;
};

export const SyntaxHighlighter = Prism;
