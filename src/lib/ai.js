const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

export async function generateDraft({ thread, userEmail, tone = 'professional', type = 'reply' }) {
  const subject = thread.subject || '';
  const from = thread.from || '';
  const body = thread.body || thread.snippet || '';

  const toneInstructions = {
    professional: 'Write in a professional, warm business tone.',
    friendly: 'Write in a friendly, personable tone.',
    brief: 'Write a very brief, concise reply — 2-3 sentences max.',
    assertive: 'Write in a confident, direct tone.',
  };

  const context = type === 'reply'
    ? `You are drafting a reply email on behalf of Christian Medford, a health insurance agent at Medford Health Group (${userEmail}).`
    : `You are drafting a new email on behalf of Christian Medford, a health insurance agent at Medford Health Group (${userEmail}).`;

  const prompt = `${context}

${toneInstructions[tone] || toneInstructions.professional}

Email thread context:
From: ${from}
Subject: ${subject}
Content: ${body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 800)}

Write ONLY the email body (no subject line, no "Here is a draft:" preamble). 
End with:
Thanks and Have a Great Day,

Christian Medford
Medford Health Group`;

  try {
    const response = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.REACT_APP_ANTHROPIC_KEY || '',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) throw new Error(`API error ${response.status}`);
    const data = await response.json();
    return data.content?.[0]?.text || '';
  } catch (e) {
    console.error('AI draft failed', e);
    return `Hi ${from.split(' ')[0]},\n\nThank you for reaching out. I'll review this and get back to you shortly.\n\nThanks and Have a Great Day,\n\nChristian Medford\nMedford Health Group`;
  }
}

export async function summarizeThread(thread) {
  const body = thread.body || thread.snippet || '';
  const subject = thread.subject || '';

  try {
    const response = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.REACT_APP_ANTHROPIC_KEY || '',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: `Summarize this email in 1-2 sentences for a health insurance agent. Be specific about any action needed. Subject: ${subject}. Content: ${body.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').slice(0,600)}`,
        }],
      }),
    });
    if (!response.ok) throw new Error();
    const data = await response.json();
    return data.content?.[0]?.text || '';
  } catch {
    return null;
  }
}
