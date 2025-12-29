interface Env {
  ANTHROPIC_API_KEY: string;
}

interface CoachRequest {
  userData: {
    weight: number;
    height: number;
    age: number;
    goal: string;
    todayKcal: number;
    targetKcal: number;
    todayProtein: number;
    targetProtein: number;
    workoutDone: boolean;
  };
  question?: string;
}

const SYSTEM_PROMPT = `Sei un coach fitness e nutrizionista esperto, amichevole e motivante.
Rispondi SEMPRE in italiano, in modo conciso (max 2-3 frasi).
Usa emoji per rendere il messaggio più coinvolgente.
Basa i tuoi consigli sui dati dell'utente forniti.
Sii specifico e pratico nei suggerimenti.`;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userData, question } = await context.request.json() as CoachRequest;

    const userContext = `
DATI UTENTE:
- Peso: ${userData.weight}kg, Altezza: ${userData.height}cm, Età: ${userData.age} anni
- Obiettivo: ${userData.goal}
- Oggi: ${userData.todayKcal}/${userData.targetKcal} kcal consumate
- Proteine: ${userData.todayProtein}/${userData.targetProtein}g
- Allenamento oggi: ${userData.workoutDone ? 'Sì' : 'No'}

${question ? `DOMANDA: ${question}` : 'Dai un consiglio rapido basato sui dati di oggi.'}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': context.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContext }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Anthropic API error:', error);
      return new Response(JSON.stringify({ error: 'AI service error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const data = await response.json() as { content: Array<{ text: string }> };
    const advice = data.content[0]?.text || 'Non ho consigli al momento.';

    return new Response(JSON.stringify({ advice }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    console.error('Coach API error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};
