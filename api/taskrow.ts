import type { IncomingMessage, ServerResponse } from 'node:http';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const { searchParams } = new URL(req.url || '', 'http://localhost');
  const base = process.env.VITE_TASKROW_URL || 'https://we.taskrow.com';
  const url = `${base}/api/v1/Dashboard/TasksByGroup?${searchParams.toString()}`;

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
