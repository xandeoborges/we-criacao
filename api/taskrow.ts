import type { IncomingMessage, ServerResponse } from 'node:http';

// Path inclui o prefixo de versão (ex: 'v1/User/ListUsers', 'v2/tasks/taskPanel/listTasks')
// — o Taskrow tem endpoints v1 e v2 coexistindo, não é sempre a mesma versão.
const ALLOWED_PATHS = new Set(['v1/User/ListUsers', 'v2/tasks/taskPanel/listTasks']);

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const { searchParams } = new URL(req.url || '', 'http://localhost');
  const path = searchParams.get('path') || 'v2/tasks/taskPanel/listTasks';
  searchParams.delete('path');

  if (!ALLOWED_PATHS.has(path)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Invalid path' }));
    return;
  }

  const base = process.env.VITE_TASKROW_URL || 'https://we.taskrow.com';
  const url = `${base}/api/${path}?${searchParams.toString()}`;

  const apiRes = await fetch(url, {
    headers: {
      __identifier: process.env.VITE_TASKROW_API_KEY || '',
      Accept: 'application/json',
    },
  });

  const data = await apiRes.text();
  res.statusCode = apiRes.status;
  res.setHeader('Content-Type', 'application/json');
  res.end(data);
}
