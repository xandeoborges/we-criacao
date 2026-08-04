import type { IncomingMessage, ServerResponse } from 'node:http';

const ALLOWED_PATHS = new Set(['Dashboard/TasksByGroup', 'User/ListUsers']);

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const { searchParams } = new URL(req.url || '', 'http://localhost');
  const path = searchParams.get('path') || 'Dashboard/TasksByGroup';
  searchParams.delete('path');

  if (!ALLOWED_PATHS.has(path)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Invalid path' }));
    return;
  }

  const base = process.env.VITE_TASKROW_URL || 'https://we.taskrow.com';
  const url = `${base}/api/v1/${path}?${searchParams.toString()}`;

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
