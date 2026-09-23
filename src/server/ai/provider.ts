import { ApiError } from '@/lib/api';

export async function generateJson(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || 'llama-3.3-70b-versatile';

  if (!apiKey) {
    console.error('[AI Provider Error]: AI_API_KEY environment variable is missing.');
    throw ApiError.badGateway('AI service is not configured');
  }

  const endpoint = 'https://api.groq.com/openai/v1/chat/completions';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20-second timeout

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(
        `[AI Provider Error]: Service returned HTTP status ${response.status} (${response.statusText})`
      );
      throw ApiError.badGateway('AI service provider error');
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data?.choices?.[0]?.message?.content;

    if (!content || typeof content !== 'string') {
      console.error('[AI Provider Error]: Empty or invalid response payload structure.');
      throw ApiError.badGateway('Invalid response payload received from AI service');
    }

    return content;
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[AI Provider Error]: Request timed out after 20 seconds.');
      throw ApiError.badGateway('AI service request timed out');
    }

    console.error('[AI Provider Error]: Network failure or unexpected exception occurred.');
    throw ApiError.badGateway('Failed to connect to AI service');
  }
}
