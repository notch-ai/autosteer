import React from 'react';
import { Toaster } from '../ui/sonner';

export interface ToastProviderProps {
  children: React.ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  return (
    <>
      {children}
      <Toaster position="bottom-right" />
    </>
  );
};
