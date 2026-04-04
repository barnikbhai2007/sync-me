import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  const { q } = request.query;

  if (!q) {
    return response.status(400).json({ error: 'Query parameter "q" is required' });
  }

  const encodedQuery = encodeURIComponent(q as string);
  const endpoints = [
    `https://hifi-api-production.up.railway.app/search/?s=${encodedQuery}`,
    `https://tidal-api-sigma.vercel.app/search?q=${encodedQuery}`
  ];

  let results = [];
  let success = false;

  for (const endpoint of endpoints) {
    try {
      console.log('Proxying Tidal search to:', endpoint);
      const res = await axios.get(endpoint, { timeout: 5000 });
      const data = res.data;

      if (data?.data?.items) results = data.data.items;
      else if (data?.items) results = data.items;
      else if (Array.isArray(data?.data)) results = data.data;
      else if (Array.isArray(data)) results = data;

      if (results.length > 0) {
        success = true;
        break;
      }
    } catch (e: any) {
      console.warn(`Proxy search failed for ${endpoint}:`, e.message);
    }
  }

  if (success) {
    return response.status(200).json(results);
  } else {
    return response.status(500).json({ error: 'Tidal search failed on all endpoints' });
  }
}
