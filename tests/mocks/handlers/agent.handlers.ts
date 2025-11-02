import { http, HttpResponse } from 'msw';

export const agentHandlers = [
  http.get('/api/agents', () => {
    return HttpResponse.json([
      {
        id: 'test-agent-1',
        title: 'Test Agent',
        content: 'Test content',
        preview: 'Test preview',
        type: 'assistant',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
        resourceIds: [],
        projectId: 'test-project',
      },
    ]);
  }),

  http.post('/api/agents', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      id: 'new-agent-id',
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }),

  http.put('/api/agents/:id', async ({ params, request }) => {
    const { id } = params;
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({
      id,
      ...body,
      updatedAt: new Date().toISOString(),
    });
  }),

  http.delete('/api/agents/:id', ({ params }) => {
    return HttpResponse.json({ success: true, id: params.id });
  }),
];
