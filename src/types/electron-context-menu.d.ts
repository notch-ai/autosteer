declare module 'electron-context-menu' {
  import { BrowserWindow, MenuItem } from 'electron';

  interface Options {
    window?: BrowserWindow;
    showInspectElement?: boolean;
    showServices?: boolean;
    showSearchWithGoogle?: boolean;
    showCopyImage?: boolean;
    showCopyImageAddress?: boolean;
    showSaveImageAs?: boolean;
    showCopyLink?: boolean;
    prepend?: (
      defaultActions: MenuItem[],
      parameters: any,
      browserWindow: BrowserWindow
    ) => MenuItem[];
    append?: (
      defaultActions: MenuItem[],
      parameters: any,
      browserWindow: BrowserWindow
    ) => MenuItem[];
  }

  function contextMenu(options?: Options): void;
  export = contextMenu;
}
