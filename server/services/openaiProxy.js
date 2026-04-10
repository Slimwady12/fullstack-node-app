import { OpenAI } from 'openai';

const FORCED_MODEL = 'gpt-5.4-mini';

function sanitizeMessages(messages) {
  return messages.map(msg => ({
    role: msg.role || 'user',
    content: msg.content?.slice(0, 10000) || '',
  }));
}

function validateOpenAIResponse(response) {
  if (!response || !response.choices || !response.choices[0]) {
    throw new Error('Invalid OpenAI response structure');
  }

  const choice = response.choices[0];
  if (!choice.message || !choice.message.content) {
    throw new Error('Missing content in OpenAI response');
  }

  return {
    content: choice.message.content,
    tokens: {
      input: response.usage?.prompt_tokens || 0,
      output: response.usage?.completion_tokens || 0,
    },
  };
}

async function callOpenAI({ messages, temperature = 0.7, userId }) {
  const startTime = Date.now();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    const latency = Date.now() - startTime;
    throw {
      code: 'MISSING_API_KEY',
      message: 'OpenAI API key not configured. Set OPENAI_API_KEY in .env file.',
      latency,
    };
  }

  const sanitizedMessages = sanitizeMessages(messages);

  try {
    const openai = new OpenAI({ apiKey });

    console.log(`[openaiProxy] Calling OpenAI API for user ${userId}, model: ${FORCED_MODEL}, messages: ${sanitizedMessages.length}`);

    const response = await openai.chat.completions.create({
      model: FORCED_MODEL,
      messages: sanitizedMessages,
      temperature: Math.min(Math.max(temperature, 0), 2),
      max_completion_tokens: 4000,
    });

    const validated = validateOpenAIResponse(response);
    const latency = Date.now() - startTime;

    console.log(`[openaiProxy] Success for user ${userId}, model: ${response.model}, tokens: ${JSON.stringify(validated.tokens)}, latency: ${latency}ms`);

    return {
      content: validated.content,
      tokens: validated.tokens,
      model: FORCED_MODEL,
      latency,
      simulationMode: false,
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    console.error(`[openaiProxy] Error for user ${userId}:`, error.message);

    if (error.code === 'insufficient_quota') {
      throw {
        code: 'QUOTA_EXCEEDED',
        message: 'OpenAI API quota exceeded. Please check your billing status.',
        latency,
      };
    }

    if (error.code === 'rate_limit_exceeded') {
      throw {
        code: 'RATE_LIMIT',
        message: 'OpenAI API rate limit exceeded. Please try again later.',
        latency,
      };
    }

    throw {
      code: 'OPENAI_ERROR',
      message: error.message || 'Failed to get response from OpenAI',
      latency,
    };
  }
}

export {
  callOpenAI,
  sanitizeMessages,
  validateOpenAIResponse,
  FORCED_MODEL,
};
