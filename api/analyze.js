// /api/analyze — pulls live data + AI analysis for one ticker.
// The Anthropic API key stays on the server (ANTHROPIC_API_KEY env var).
// Only a validated ticker is accepted, so this endpoint can't be abused
// as a general AI proxy.

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";

async function callClaude(prompt, useSearch, maxTokens) {
  const body = {
    model: MODEL,
    max_tokens: maxTokens || 1500,
    messages: [{ role: "user", content: prompt }],
  };
  if (useSearch) body.tools = [{ type: "web_search_20250305", name: "web_search" }];
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error("Anthropic API error " + res.status + ": " + t.slice(0, 200));
  }
  const data = await res.json();
  return (data.content || []).map((b) => (b.type === "text" ? b.text : "")).filter(Boolean).join("\n");
}

function extractJSON(text) {
  const cleaned = text.replace(/```json|```/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON in model response");
  return JSON.parse(cleaned.slice(start, end + 1));
}

const dataPrompt = (t) => `Search the web for current market data on the stock ticker "${t}".
Accuracy rules: only include a number you actually saw in search results. Where possible cross-check figures across two independent sources; if sources materially disagree or you are unsure, use null rather than guessing. Prefer the most recent quote.
Also find 1-2 direct competitors ("peers") and their P/E and revenue growth if available.
Respond with ONLY a JSON object — no prose, no markdown fences. Plain numbers for numeric fields, null when unconfirmed. marketCapUSD must be the full raw number.

{
 "ticker":"${t}",
 "company":"",
 "priceUSD":null,
 "priceAsOf":"",
 "changePctToday":null,
 "marketCapUSD":null,
 "peRatio":null,
 "epsTTM":null,
 "revenueGrowthPct":null,
 "dividendYieldPct":null,
 "week52HighUSD":null,
 "week52LowUSD":null,
 "peers":[{"ticker":"","peRatio":null,"revenueGrowthPct":null}],
 "recentNews":["", ""],
 "upcomingEvents":["", ""],
 "sources":["", ""]
}`;

const analysisPrompt = (data) => `You are a disciplined equity analyst. Below is the ONLY data you may use. You must not introduce any number that does not appear in this data — no figures from memory. If a figure is null, do not mention it numerically. You may compare against DATA.peers using only their stated figures.

DATA:
${JSON.stringify(data, null, 1)}

Respond with ONLY a JSON object, no markdown fences:
{
 "verdict": "Bullish" | "Neutral" | "Bearish",
 "bullCase": "2-3 sentences on why the stock could rise. Any numbers must come verbatim from DATA.",
 "bearCase": "2-3 sentences on why it could fall. Same rule.",
 "catalyst": "One specific upcoming event or trend from DATA's upcomingEvents/recentNews that could move the stock.",
 "invalidation": "One sentence: the specific development that would flip your verdict.",
 "confidence": 1-10 integer reflecting how well DATA supports your view (missing/null fields should lower it)
}`;

export default async function handler(req, res) {
  try {
    const ticker = String(req.query.ticker || "").toUpperCase().trim();
    if (!/^[A-Z.\-]{1,8}$/.test(ticker)) {
      return res.status(400).json({ error: "Invalid ticker" });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: "Server missing ANTHROPIC_API_KEY" });
    }
    const data = extractJSON(await callClaude(dataPrompt(ticker), true, 2500));
    const analysis = extractJSON(await callClaude(analysisPrompt(data), false, 1500));
    res.setHeader("Cache-Control", "s-maxage=300");
    return res.status(200).json({ data, analysis });
  } catch (e) {
    return res.status(502).json({ error: e.message || "Analysis failed" });
  }
}
