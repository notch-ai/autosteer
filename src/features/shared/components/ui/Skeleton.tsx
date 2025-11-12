import React from 'react';
import { Skeleton as UISkeleton } from '@/components/ui/skeleton';
import { cn } from '@/commons/utils/ui/cn';

// Legacy interface for backward compatibility
interface SkeletonProps {
  variant?: 'text' | 'title' | 'block' | 'card' | 'circle';
  width?: string | number;
  height?: string | number;
  count?: number;
  className?: string;
}

/**
 * Legacy Skeleton component that preserves the original API while using the new UI skeleton internally.
 * This maintains backward compatibility for existing code while leveraging the new shadcn/ui components.
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  count = 1,
  className,
}) => {
  const skeletons = Array.from({ length: count }, (_, i) => i);

  const getSkeletonClasses = () => {
    switch (variant) {
      case 'title':
        return 'h-6 w-3/4 mb-2';
      case 'block':
        return 'h-4 w-full mb-1';
      case 'card':
        return 'h-32 w-full rounded-lg';
      case 'circle':
        return 'rounded-full aspect-square';
      case 'text':
      default:
        return 'h-4 w-full mb-1';
    }
  };

  const style: React.CSSProperties = {
    width: width ? (typeof width === 'number' ? `${width}px` : width) : undefined,
    height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined,
  };

  return (
    <>
      {skeletons.map((index) => (
        <UISkeleton key={index} className={cn(getSkeletonClasses(), className)} style={style} />
      ))}
    </>
  );
};

// Specific skeleton components for common use cases
export const SkeletonAgent: React.FC = () => (
  <div className="space-y-2">
    <div className="flex items-center space-x-2">
      <Skeleton variant="circle" width={20} height={20} />
      <Skeleton variant="title" width="60%" />
      <Skeleton variant="circle" width={20} height={20} />
    </div>
    <Skeleton variant="text" count={2} />
    <div className="flex space-x-2">
      <Skeleton width={60} height={16} />
      <Skeleton width={80} height={16} />
    </div>
  </div>
);

export const SkeletonResource: React.FC = () => (
  <div className="space-y-2">
    <Skeleton variant="block" height={80} />
    <Skeleton variant="text" />
    <Skeleton width="60%" height={14} />
  </div>
);

export const SkeletonContent: React.FC = () => (
  <div className="space-y-4">
    <div className="space-y-2">
      <Skeleton variant="title" width="70%" />
      <div className="flex space-x-2">
        <Skeleton width={80} height={24} />
        <Skeleton width={100} height={24} />
        <Skeleton width={60} height={24} />
      </div>
    </div>
    <div className="space-y-2">
      <Skeleton variant="text" count={3} />
      <Skeleton variant="block" height={200} />
      <Skeleton variant="text" count={4} />
    </div>
  </div>
);
