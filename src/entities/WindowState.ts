export interface WindowState {
  id: string;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isMaximized?: boolean;
  isFullScreen?: boolean;
}
