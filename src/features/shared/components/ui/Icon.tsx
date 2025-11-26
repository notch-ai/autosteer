import React from 'react';
import { logger } from '@/commons/utils/logger';
import {
  FileText,
  Image,
  Video,
  Music,
  Code,
  Layers,
  Edit,
  Loader2,
  Eye,
  CheckCircle,
  Archive,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  Plus,
  FileDown,
  FileUp,
  Settings,
  MoreVertical,
  Grid3x3,
  List,
  Sun,
  Moon,
  Monitor,
  Check,
  AlertTriangle,
  XCircle,
  Info,
  Pin,
  Paperclip,
  Tag,
  Calendar,
  Clock,
  PencilLine,
  Trash,
  Share2,
  Copy,
  Download,
  Upload,
  Folder,
  FileCode,
  Link,
  Trash2,
  Circle,
  Bell,
  HelpCircle,
  Contrast,
  GitBranch,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/commons/utils';

export type IconName =
  | 'text'
  | 'document'
  | 'image'
  | 'video'
  | 'audio'
  | 'code'
  | 'mixed'
  | 'draft'
  | 'in-progress'
  | 'review'
  | 'completed'
  | 'archived'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'chevron-up'
  | 'search'
  | 'close'
  | 'plus'
  | 'ellipsis-v'
  | 'export'
  | 'import'
  | 'settings'
  | 'grid'
  | 'list'
  | 'sun'
  | 'moon'
  | 'computer'
  | 'check'
  | 'warning'
  | 'error'
  | 'info'
  | 'pin'
  | 'attachment'
  | 'tag'
  | 'calendar'
  | 'clock'
  | 'edit'
  | 'delete'
  | 'share'
  | 'copy'
  | 'download'
  | 'upload'
  | 'folder'
  | 'file'
  | 'file-code'
  | 'archive'
  | 'link'
  | 'trash'
  | 'circle'
  | 'bell'
  | 'circle-check'
  | 'circle-half-stroke'
  | 'circle-question'
  | 'question'
  | 'adjust'
  | 'git'
  | 'git-branch'
  | 'zap';

const iconMap: Record<IconName, LucideIcon> = {
  text: FileText,
  document: FileText,
  image: Image,
  video: Video,
  audio: Music,
  code: Code,
  mixed: Layers,
  draft: Edit,
  'in-progress': Loader2,
  review: Eye,
  completed: CheckCircle,
  archived: Archive,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  search: Search,
  close: X,
  plus: Plus,
  'ellipsis-v': MoreVertical,
  export: FileDown,
  import: FileUp,
  settings: Settings,
  grid: Grid3x3,
  list: List,
  sun: Sun,
  moon: Moon,
  computer: Monitor,
  check: Check,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
  pin: Pin,
  attachment: Paperclip,
  tag: Tag,
  calendar: Calendar,
  clock: Clock,
  edit: PencilLine,
  delete: Trash,
  share: Share2,
  copy: Copy,
  download: Download,
  upload: Upload,
  folder: Folder,
  file: FileCode,
  'file-code': FileCode,
  archive: Archive,
  link: Link,
  trash: Trash2,
  circle: Circle,
  bell: Bell,
  'circle-check': CheckCircle,
  'circle-half-stroke': Contrast,
  'circle-question': HelpCircle,
  question: HelpCircle,
  adjust: Contrast,
  git: GitBranch,
  'git-branch': GitBranch,
  zap: Zap,
};

interface IconProps {
  name: IconName;
  size?: number | 'auto';
  color?: string;
  className?: string;
  onClick?: () => void;
  title?: string;
  'aria-label'?: string;
  role?: string;
}

/**
 * Feature component for Icon
 * Provides a consistent icon library with accessibility support
 * Maintains backward compatibility with legacy Icon API
 *
 * Icon sizing:
 * - size={number}: Fixed pixel size (e.g., size={16})
 * - size="auto": Scales with user's font size preference (1.25x base)
 *   - Small (12px base): 15px icons
 *   - Medium (13px base): 16.25px icons
 *   - Large (14px base): 17.5px icons
 */
export const Icon: React.FC<IconProps> = ({
  name,
  size = 'auto',
  color,
  className,
  onClick,
  title,
  'aria-label': ariaLabel,
  role,
}) => {
  const IconComponent = iconMap[name];

  if (!IconComponent) {
    logger.warn(`Icon "${name}" not found`);
    return null;
  }

  const dynamicSizeClass =
    size === 'auto'
      ? '[width:calc(var(--font-size-base)*1.25)] [height:calc(var(--font-size-base)*1.25)]'
      : '';

  const iconElement = (
    <IconComponent
      {...(size !== 'auto' && { size })}
      color={color}
      className={cn(
        'in-progress' === name && 'animate-spin',
        !color && 'currentColor',
        dynamicSizeClass
      )}
    />
  );

  const wrapperProps = {
    className: cn('inline-flex items-center justify-center', className),
    onClick,
    title,
    'aria-label': ariaLabel || title,
    role: role || (onClick ? 'button' : undefined),
    ...(onClick && {
      tabIndex: 0,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      },
    }),
  };

  if (onClick) {
    return (
      <button
        type="button"
        {...wrapperProps}
        className={cn('cursor-pointer', wrapperProps.className)}
      >
        {iconElement}
      </button>
    );
  }

  return <span {...wrapperProps}>{iconElement}</span>;
};
