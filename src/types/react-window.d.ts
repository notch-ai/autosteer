/**
 * Type declarations for react-window
 *
 * react-window provides its own types but TypeScript may have trouble resolving them.
 * This declaration file provides the necessary types for our usage.
 */

declare module 'react-window' {
  import * as React from 'react';

  export interface ListChildComponentProps<T = any> {
    data: T;
    index: number;
    style: React.CSSProperties;
  }

  export interface VariableSizeListProps<T = any> {
    children: React.ComponentType<ListChildComponentProps<T>>;
    height: number | string;
    itemCount: number;
    itemSize: (index: number) => number;
    width: number | string;
    itemData?: T;
    overscanCount?: number;
    className?: string;
    style?: React.CSSProperties;
    onScroll?: (props: { scrollOffset: number; scrollUpdateWasRequested: boolean }) => void;
    ref?: React.Ref<VariableSizeList<T>>;
  }

  export class VariableSizeList<T = any> extends React.Component<VariableSizeListProps<T>> {
    scrollToItem(index: number, align?: 'start' | 'center' | 'end' | 'smart'): void;
    resetAfterIndex(index: number, shouldForceUpdate?: boolean): void;
  }

  export interface FixedSizeListProps<T = any> {
    children: React.ComponentType<ListChildComponentProps<T>>;
    height: number | string;
    itemCount: number;
    itemSize: number;
    width: number | string;
    itemData?: T;
    overscanCount?: number;
    onScroll?: (props: { scrollOffset: number; scrollUpdateWasRequested: boolean }) => void;
    ref?: React.Ref<FixedSizeList<T>>;
  }

  export class FixedSizeList<T = any> extends React.Component<FixedSizeListProps<T>> {
    scrollToItem(index: number, align?: 'start' | 'center' | 'end' | 'smart'): void;
  }
}
