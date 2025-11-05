/**
 * Service MSW Handlers
 * Mock Service Worker request handlers for service API endpoints
 */

import { http, HttpResponse } from 'msw';
import { createMockSettings, createMockTerminalData } from '../../factories/service.factory';

/**
 * Settings Service Handlers
 * Mock handlers for settings persistence operations
 */
export const settingsHandlers = [
  // Get all settings
  http.get('/api/settings', () => {
    console.log('[MSW] GET /api/settings');
    return HttpResponse.json(createMockSettings());
  }),

  // Get single setting by key
  http.get('/api/settings/:key', ({ params }) => {
    const { key } = params;
    console.log(`[MSW] GET /api/settings/${key}`);

    const settings = createMockSettings();
    const value = settings[key as keyof typeof settings];

    if (value !== undefined) {
      return HttpResponse.json({ key, value });
    }

    return new HttpResponse(null, {
      status: 404,
      statusText: 'Setting not found',
    });
  }),

  // Update setting
  http.put('/api/settings/:key', async ({ params, request }) => {
    const { key } = params;
    const body = (await request.json()) as { value: unknown };
    console.log(`[MSW] PUT /api/settings/${key}`, body);

    return HttpResponse.json({
      key,
      value: body.value,
      updatedAt: new Date().toISOString(),
    });
  }),

  // Batch update settings
  http.post('/api/settings/batch', async ({ request }) => {
    const updates = (await request.json()) as Record<string, unknown>;
    console.log('[MSW] POST /api/settings/batch', updates);

    return HttpResponse.json({
      success: true,
      updatedCount: Object.keys(updates).length,
      updatedAt: new Date().toISOString(),
    });
  }),

  // Delete setting
  http.delete('/api/settings/:key', ({ params }) => {
    const { key } = params;
    console.log(`[MSW] DELETE /api/settings/${key}`);

    return HttpResponse.json({
      success: true,
      key,
      deletedAt: new Date().toISOString(),
    });
  }),

  // Clear all settings
  http.post('/api/settings/clear', () => {
    console.log('[MSW] POST /api/settings/clear');

    return HttpResponse.json({
      success: true,
      settings: createMockSettings(),
      clearedAt: new Date().toISOString(),
    });
  }),

  // Check if setting exists
  http.head('/api/settings/:key', ({ params }) => {
    const { key } = params;
    console.log(`[MSW] HEAD /api/settings/${key}`);

    const settings = createMockSettings();
    const exists = key in settings;

    return new HttpResponse(null, {
      status: exists ? 200 : 404,
    });
  }),
];

/**
 * Terminal Service Handlers
 * Mock handlers for terminal PTY operations
 */
export const terminalHandlers = [
  // Create terminal
  http.post('/api/terminals', async ({ request }) => {
    const body = (await request.json()) as {
      shell?: string;
      cwd?: string;
      size?: { cols: number; rows: number };
      title?: string;
    };
    console.log('[MSW] POST /api/terminals', body);

    const terminal = createMockTerminalData({
      shell: body.shell,
      cwd: body.cwd,
      size: body.size,
      title: body.title,
    });

    return HttpResponse.json(terminal);
  }),

  // Get all terminals
  http.get('/api/terminals', () => {
    console.log('[MSW] GET /api/terminals');

    return HttpResponse.json([
      createMockTerminalData({ id: 'terminal-1' }),
      createMockTerminalData({ id: 'terminal-2' }),
    ]);
  }),

  // Get terminal by ID
  http.get('/api/terminals/:id', ({ params }) => {
    const { id } = params;
    console.log(`[MSW] GET /api/terminals/${id}`);

    return HttpResponse.json(
      createMockTerminalData({
        id: id as string,
      })
    );
  }),

  // Write to terminal
  http.post('/api/terminals/:id/write', async ({ params, request }) => {
    const { id } = params;
    const body = (await request.json()) as { data: string };
    console.log(`[MSW] POST /api/terminals/${id}/write`, body);

    return HttpResponse.json({
      success: true,
      terminalId: id,
      bytesWritten: body.data.length,
    });
  }),

  // Resize terminal
  http.post('/api/terminals/:id/resize', async ({ params, request }) => {
    const { id } = params;
    const body = (await request.json()) as { cols: number; rows: number };
    console.log(`[MSW] POST /api/terminals/${id}/resize`, body);

    return HttpResponse.json({
      success: true,
      terminalId: id,
      size: body,
    });
  }),

  // Kill terminal
  http.delete('/api/terminals/:id', ({ params }) => {
    const { id } = params;
    console.log(`[MSW] DELETE /api/terminals/${id}`);

    return HttpResponse.json({
      success: true,
      terminalId: id,
      killedAt: new Date().toISOString(),
    });
  }),

  // Terminal data stream (SSE)
  http.get('/api/terminals/:id/stream', ({ params }) => {
    const { id } = params;
    console.log(`[MSW] GET /api/terminals/${id}/stream`);

    // Mock SSE response
    return new HttpResponse('data: {"type":"data","data":"test output\\n"}\n\n', {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }),

  // Get terminal status
  http.get('/api/terminals/:id/status', ({ params }) => {
    const { id } = params;
    console.log(`[MSW] GET /api/terminals/${id}/status`);

    return HttpResponse.json({
      terminalId: id,
      status: 'running',
      isActive: true,
      pid: 12345,
    });
  }),
];

/**
 * Combined service handlers
 * All service-related MSW handlers
 */
export const serviceHandlers = [...settingsHandlers, ...terminalHandlers];

/**
 * Error simulation handlers
 * Handlers for testing error conditions
 */
export const serviceErrorHandlers = [
  // Settings error - not found
  http.get('/api/settings/error/notfound', () => {
    console.log('[MSW] GET /api/settings/error/notfound - 404');
    return new HttpResponse(null, {
      status: 404,
      statusText: 'Not Found',
    });
  }),

  // Settings error - server error
  http.get('/api/settings/error/server', () => {
    console.log('[MSW] GET /api/settings/error/server - 500');
    return new HttpResponse(
      JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to load settings',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }),

  // Terminal error - creation failed
  http.post('/api/terminals/error/creation', () => {
    console.log('[MSW] POST /api/terminals/error/creation - 500');
    return new HttpResponse(
      JSON.stringify({
        error: 'Terminal Creation Failed',
        message: 'Failed to spawn PTY process',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }),

  // Terminal error - write failed
  http.post('/api/terminals/:id/error/write', ({ params }) => {
    const { id } = params;
    console.log(`[MSW] POST /api/terminals/${id}/error/write - 500`);
    return new HttpResponse(
      JSON.stringify({
        error: 'Write Failed',
        message: 'PTY write operation failed',
        terminalId: id,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }),

  // Terminal error - not active
  http.post('/api/terminals/:id/error/inactive', ({ params }) => {
    const { id } = params;
    console.log(`[MSW] POST /api/terminals/${id}/error/inactive - 409`);
    return new HttpResponse(
      JSON.stringify({
        error: 'Terminal Not Active',
        message: 'Terminal is not active',
        terminalId: id,
      }),
      {
        status: 409,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }),

  // Terminal error - limit reached
  http.post('/api/terminals/error/limit', () => {
    console.log('[MSW] POST /api/terminals/error/limit - 429');
    return new HttpResponse(
      JSON.stringify({
        error: 'Limit Reached',
        message: 'Maximum terminal limit reached (10)',
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }),
];
