/**
 * Portal Container for Test Harness
 *
 * Provides a stable container for React portals during visual testing.
 * This prevents DOM manipulation errors when components are rapidly mounted/unmounted.
 */

import React, { useEffect, useRef } from 'react';

export const TestHarnessPortalContainer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Create portal containers that components might expect
    const portalIds = ['modal-root', 'tooltip-root', 'dropdown-root', 'toast-root'];

    portalIds.forEach((id) => {
      if (!document.getElementById(id)) {
        const portalDiv = document.createElement('div');
        portalDiv.id = id;
        portalDiv.style.position = 'fixed';
        portalDiv.style.top = '0';
        portalDiv.style.left = '0';
        portalDiv.style.width = '100%';
        portalDiv.style.height = '100%';
        portalDiv.style.pointerEvents = 'none';
        portalDiv.style.zIndex = '9999';
        document.body.appendChild(portalDiv);
      }
    });

    // Cleanup function
    return () => {
      // Don't remove portal containers on cleanup to avoid DOM errors
      // They will be cleaned up when the entire app unmounts
    };
  }, []);

  return <div ref={containerRef} className="test-harness-portal-container" />;
};
