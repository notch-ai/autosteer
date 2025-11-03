import React from 'react';
import { Toaster } from '@/components/ui/sonner';

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
