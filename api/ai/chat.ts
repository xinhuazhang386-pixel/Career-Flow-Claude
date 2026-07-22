import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { messages, temperature = 0.7, response_format, apiKey: clientApiKey, apiUrl: clientApiUrl } = request.body;

    if (!messages || !Array.isArray(messages)) {
      return response.status(400).json({ error: 'Invalid request: messages are required.' });
    }

    // 优先使用客户端传入的 API Key，否则用环境变量
    const apiKey = clientApiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return response.status(500).json({
        error: '未配置 API Key。请在设置页面配置你的 OpenAI API Key。'
      });
    }

    // 优先使用客户端传入的 API URL，否则用环境变量，最后默认 OpenAI 官方
    const baseUrl = clientApiUrl || process.env.OPENAI_API_URL || 'https://api.openai.com';

    const apiResponse = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature,
        response_format
      })
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json().catch(() => ({}));
      return response.status(apiResponse.status).json({
        error: 'AI 服务暂时不可用，请检查 API Key 是否正确。',
        details: errorData
      });
    }

    const data = await apiResponse.json();
    return response.status(200).json(data);
  } catch (error) {
    console.error('Proxy Error:', error);
    return response.status(500).json({ error: 'Internal Server Error' });
  }
}
