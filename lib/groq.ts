/**
 * Factory for Groq API requests.
 * Since API keys are provided by the client in headers,
 * this helper simplifies fetch calls to Groq.
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1';

export async function groqFetch(
  endpoint: string,
  apiKey: string,
  options: RequestInit = {}
) {
  const url = `${GROQ_API_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(error.error?.message || `Groq API error: ${response.status}`);
  }

  return response;
}
