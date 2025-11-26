import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check, ChevronDown } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface IdeDropdownProps {
  /**
   * Directory path to open in IDE
   */
  directoryPath?: string;

  /**
   * Button variant
   */
  variant?: 'default' | 'ghost' | 'outline' | 'icon-secondary';

  /**
   * Button size
   */
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm';

  /**
   * Custom button className
   */
  className?: string;
}

/**
 * Dropdown component to open a directory in the user's preferred IDE
 *
 * Features:
 * - Auto-detects available IDEs
 * - Remembers user's preferred editor
 * - Shows dropdown with all available editors
 * - Allows changing the default editor
 */
export const IdeDropdown: React.FC<IdeDropdownProps> = ({
  directoryPath,
  variant = 'outline',
  size = 'sm',
  className,
}) => {
  const [editors, setEditors] = useState<string[]>([]);
  const [preferred, setPreferred] = useState<string>();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Detect available editors on mount
    if (window.electron?.ide) {
      window.electron.ide.detect().then((result: any) => {
        setEditors(result.editors || []);
        setPreferred(result.preferred);
      });
    }
  }, []);

  const handleOpenInEditor = async (editor?: string) => {
    if (!window.electron?.ide) {
      toast.error('IDE integration not available');
      return;
    }

    if (!directoryPath) {
      toast.error('No directory path available');
      return;
    }

    try {
      const request: { file: string; editor?: string } = { file: directoryPath };
      if (editor !== undefined) {
        request.editor = editor;
      }

      const result = await window.electron.ide.openFile(request);

      if (!result.success) {
        toast.error(`Failed to open directory: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to open directory in IDE:', error);
      toast.error('Failed to open directory in IDE');
    }
  };

  const handleSetPreferred = async (editor: string) => {
    if (!window.electron?.ide) return;

    try {
      await window.electron.ide.setPreferred(editor);
      setPreferred(editor);
      toast.success(`Set ${editorDisplayNames[editor] || editor} as default editor`);
    } catch (error) {
      console.error('Failed to set preferred editor:', error);
      toast.error('Failed to set preferred editor');
    }
  };

  const editorDisplayNames: Record<string, string> = {
    code: 'VS Code',
    cursor: 'Cursor',
    windsurf: 'Windsurf',
    webstorm: 'WebStorm',
    phpstorm: 'PhpStorm',
    pycharm: 'PyCharm',
    idea: 'IntelliJ IDEA',
    subl: 'Sublime Text',
    atom: 'Atom',
    vim: 'Vim',
    nvim: 'NeoVim',
    emacs: 'Emacs',
    zed: 'Zed',
  };

  const getDisplayName = (editor: string) => {
    return editorDisplayNames[editor] || editor;
  };

  if (editors.length === 0 || !directoryPath) {
    return null;
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={className}
          title={`Open in ${getDisplayName(preferred || editors[0])}`}
        >
          <span className="text-sm">Open in</span>
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Open in...</div>
        <DropdownMenuSeparator />
        {editors.map((editor) => (
          <DropdownMenuItem
            key={editor}
            onClick={() => {
              handleOpenInEditor(editor);
              setIsOpen(false);
            }}
            className="flex items-center justify-between cursor-pointer"
          >
            <span>{getDisplayName(editor)}</span>
            {editor === preferred && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Set default</div>
        {editors.map((editor) => (
          <DropdownMenuItem
            key={`set-${editor}`}
            onClick={() => {
              handleSetPreferred(editor);
              setIsOpen(false);
            }}
            className="flex items-center justify-between cursor-pointer text-xs"
          >
            <span>Use {getDisplayName(editor)}</span>
            {editor === preferred && <Check className="h-3 w-3" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
