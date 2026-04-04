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

  try {
    const res = await axios.get(`https://yt-search-nine.vercel.app/search?q=${encodeURIComponent(q as string)}`);
    // Ensure we return a consistent array format
    const results = Array.isArray(res.data) ? res.data : (res.data.results || res.data.items || []);
    
    return response.status(200).json(results);
  } catch (error: any) {
    console.error('YouTube Search Error:', error.message);
    return response.status(500).json({ error: 'Failed to fetch YouTube results' });
  }
}
