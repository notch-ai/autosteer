import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

interface LinkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (url: string, text: string, openInNewTab: boolean) => void;
  initialUrl?: string;
  initialText?: string;
  selectedText?: string;
}

export const LinkDialog: React.FC<LinkDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialUrl = '',
  initialText = '',
  selectedText = '',
}) => {
  const [url, setUrl] = useState(initialUrl);
  const [linkText, setLinkText] = useState(initialText || selectedText);
  const [openInNewTab, setOpenInNewTab] = useState(true);
  const [urlError, setUrlError] = useState('');
  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setUrl(initialUrl);
      setLinkText(initialText || selectedText);
      setUrlError('');
      // Focus URL input when dialog opens
      const timeoutId = setTimeout(() => {
        urlInputRef.current?.focus();
        urlInputRef.current?.select();
      }, 100);

      return () => clearTimeout(timeoutId);
    }
    // Return empty cleanup function for when isOpen is false
    return () => {};
  }, [isOpen, initialUrl, initialText, selectedText]);

  const validateUrl = (value: string): boolean => {
    if (!value.trim()) {
      setUrlError('URL is required');
      return false;
    }

    // Check for obvious invalid characters and patterns
    if (value.includes('!') || value.includes(' ')) {
      setUrlError('Please enter a valid URL');
      return false;
    }

    // Check if it's a valid URL format
    try {
      // If no protocol, add https://
      let urlToValidate = value;
      if (
        !value.match(/^https?:\/\//i) &&
        !value.startsWith('mailto:') &&
        !value.startsWith('tel:')
      ) {
        urlToValidate = `https://${value}`;
      }
      new URL(urlToValidate);
      setUrlError('');
      return true;
    } catch {
      setUrlError('Please enter a valid URL');
      return false;
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUrl(value);
    if (value.trim()) {
      validateUrl(value.trim());
    } else {
      setUrlError('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedUrl = url.trim();
    if (!validateUrl(trimmedUrl)) {
      return;
    }

    // Auto-prepend https:// if no protocol
    let finalUrl = trimmedUrl;
    if (
      !trimmedUrl.match(/^https?:\/\//i) &&
      !trimmedUrl.startsWith('mailto:') &&
      !trimmedUrl.startsWith('tel:')
    ) {
      finalUrl = `https://${trimmedUrl}`;
    }

    const finalText = linkText.trim() || finalUrl;
    onConfirm(finalUrl, finalText, openInNewTab);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      // Submit on Enter (plain or with Ctrl/Cmd) if form is valid
      if (!url.trim() || urlError) {
        return;
      }
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>Insert Link</DialogTitle>
          <DialogDescription>Add a hyperlink to your text</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} role="form" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="link-url">URL</Label>
            <Input
              ref={urlInputRef}
              id="link-url"
              type="text"
              value={url}
              onChange={handleUrlChange}
              placeholder="https://example.com"
              autoComplete="off"
              spellCheck={false}
            />
            {urlError && <span className="text-sm text-destructive">{urlError}</span>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="link-text">Link Text</Label>
            <Input
              id="link-text"
              type="text"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              placeholder="Display text (optional)"
              autoComplete="off"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="open-new-tab"
              checked={openInNewTab}
              onCheckedChange={(checked) => setOpenInNewTab(!!checked)}
            />
            <Label htmlFor="open-new-tab">Open in new tab</Label>
          </div>

          {url && !urlError && (
            <div className="p-3 bg-card rounded border">
              <span className="text-sm text-muted-foreground">Preview:</span>
              <a
                href={url.match(/^https?:\/\//i) ? url : `https://${url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-primary hover:underline"
              >
                {linkText || url}
              </a>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!url.trim() || !!urlError}>
              Insert Link
            </Button>
          </DialogFooter>
        </form>

        <div className="text-sm text-muted-foreground text-center">
          <kbd className="px-1 py-0.5 bg-card rounded text-sm">Ctrl</kbd>+
          <kbd className="px-1 py-0.5 bg-card rounded text-sm">Enter</kbd> to insert
        </div>
      </DialogContent>
    </Dialog>
  );
};
