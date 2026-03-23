const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM_PROMPT = `You are an expert AI automation consultant at Trivox AI. Analyze this business audit and return ONLY a valid JSON object with this exact structure. Do NOT wrap in markdown code fences. Do NOT include any text outside the JSON object.

{
  "overallScore": 0-100,
  "scoreLabel": "string (e.g. High Automation Potential)",
  "weeklyHoursSaved": number,
  "annualROI": number,
  "paybackPeriodMonths": number,
  "topProcesses": [
    { "name": "string", "hoursSaved": number, "difficulty": "Easy|Medium|Complex", "impact": "High|Medium|Low", "description": "string — specific to their business" }
  ],
  "areaScores": {
    "leadManagement": 0-100,
    "clientOnboarding": 0-100,
    "scheduling": 0-100,
    "communication": 0-100,
    "dataOperations": 0-100
  },
  "quickWins": ["string", "string", "string"],
  "summary": "2-3 sentence personalized summary referencing their specific answers, industry, and pain points"
}

Rules:
- overallScore should reflect how much automation potential exists (higher = more room to improve)
- weeklyHoursSaved should be realistic based on their reported manual work
- annualROI should be a dollar figure based on their revenue and deal size
- paybackPeriodMonths should reflect a realistic AI automation implementation timeline
- topProcesses should have exactly 3 items, ranked by impact
- quickWins should be immediately actionable, specific to their business
- All descriptions must reference their specific answers — no generic advice
- Be aggressive but realistic with projections`;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {
  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { answers, lead } = JSON.parse(event.body);

    if (!answers || !Array.isArray(answers)) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Invalid request: answers array required' }),
      };
    }

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: JSON.stringify({ answers, lead }),
        },
      ],
    });

    let text = response.content?.[0]?.text || '';

    // Strip markdown fences if present
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    // Validate JSON
    const parsed = JSON.parse(text);

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    };
  } catch (error) {
    console.error('Audit function error:', error.message);

    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error.message || 'Failed to generate audit report',
      }),
    };
  }
};
