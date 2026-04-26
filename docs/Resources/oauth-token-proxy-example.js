// This file should live in an /api folder if using Vercel
// It handles the exchange of the GitHub temporary 'code' for an 'access_token'

export default async function handler(req, res) {
    // Only allow POST requests for security
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  
    const { code } = req.body;
  
    if (!code) {
      return res.status(400).json({ error: 'No code provided' });
    }
  
    // These should be set as Environment Variables in your Vercel/Netlify dashboard
    // Do NOT hardcode them here, bro!
    const client_id = process.env.GITHUB_CLIENT_ID;
    const client_secret = process.env.GITHUB_CLIENT_SECRET;
  
    try {
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          client_id,
          client_secret,
          code,
        }),
      });
  
      const data = await response.json();
  
      if (data.error) {
        return res.status(400).json(data);
      }
  
      // Send the access_token back to your React app
      return res.status(200).json(data);
    } catch (error) {
      return res.status(500).json({ error: 'Failed to exchange token' });
    }
  }