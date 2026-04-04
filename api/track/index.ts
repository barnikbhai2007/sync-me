import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  const { id, quality } = request.query;

  if (!id) {
    return response.status(400).json({ error: 'Track ID is required' });
  }

  try {
    const url = `https://hifi-api-production.up.railway.app/track/?id=${id}&quality=${quality || 'HIGH'}`;
    console.log('Proxying Tidal track request to:', url);
    const res = await axios.get(url, { timeout: 8000 });
    return response.status(200).json(res.data);
  } catch (error: any) {
    console.error('Tidal Track Proxy Error:', error.message);
    return response.status(500).json({ error: 'Failed to fetch track manifest' });
  }
}
