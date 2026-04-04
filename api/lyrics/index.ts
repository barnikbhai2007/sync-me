import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  const { id } = request.query;

  if (!id) {
    return response.status(400).json({ error: 'Track ID is required' });
  }

  try {
    const url = `https://hifi-api-production.up.railway.app/lyrics/?id=${id}`;
    const res = await axios.get(url, { timeout: 8000 });
    return response.status(200).json(res.data);
  } catch (error: any) {
    return response.status(500).json({ error: 'Failed to fetch lyrics' });
  }
}
