// /api/chart — reconstructs OHLC candles for one ticker + timeframe.

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";

const TFS = {
  "1D": "the most recent trading day, hourly candles (about 7 candles)",
  "1W": "the past week, one candle per trading day (about 5 candles)",
  "1M": "the past month, one candle per trading day (about 20 candles)",
  "3M": "the past 3 months, one candle per week (about 13 candles)",
  "6M": "the past 6 months, one candle per week (about 26 candles)",
  "1Y": "the past year, one candle per month (12 candles)",
  "ALL": "the stock's full listed history, one candle per year (at most 20 candles, from the earliest year you can confirm)",
};

async function callClaude(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      messages: [{ role: "user", content: prompt }],
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    }),
  });
  if (!res.ok) throw new Error("Anthropic API error " + res.status);
  const data = await res.json();
  return (data.content || []).map((b) => (b.type === "text" ? b.text : "")).filter(Boolean).join("\n");
}

function extractCandles(text) {
  const cleaned = text.replace(/```json|```/g, "");
  const start = cleaned.indexOf("{");
  if (start !== -1) {
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          try {
            const j = JSON.parse(cleaned.slice(start, i + 1));
            if (Array.isArray(j.candles) && j.candles.length) return j;
          } catch (e) {}
          break;
        }
      }
    }
  }
  // Salvage: recover complete candle objects even if the outer JSON was truncated/messy
  const objs = text.match(/\{[^{}]*"t"\s*:[^{}]*\}/g) || [];
  const candles = [];
  for (const o of objs) { try { const c = JSON.parse(o); if (c && c.t != null) candles.push(c); } catch (e) {} }
  if (!candles.length) throw new Error("No usable price history returned. This ticker may have too little public price history for search to reconstruct.");
  return { candles, asOf: "", approx: true, note: "Response was partially recovered from a messy model reply." };
}

const chartPrompt = (t, spec) => `Search the web for the historical share price of stock ticker "${t}" covering ${spec}.
Reconstruct OHLC candles from the price history you can actually find. Do NOT invent precision: if you only find closing prices, derive open from the prior close and set high/low to the max/min of those two, and set "approx" to true. If you cannot find enough history, return fewer candles rather than guessing.
Respond with ONLY a JSON object:
{"candles":[{"t":"short label","o":0,"h":0,"l":0,"c":0}],"asOf":"","approx":true,"note":""}
Chronological order, oldest first, all prices in USD as plain numbers.
Output the JSON compactly on a single line with no spaces, and output nothing before or after it.`;

export default async function handler(req, res) {
  try {
    const ticker = String(req.query.ticker || "").toUpperCase().trim();
    const tf = String(req.query.tf || "1M");
    if (!/^[A-Z.\-]{1,8}$/.test(ticker) || !TFS[tf]) {
      return res.status(400).json({ error: "Invalid ticker or timeframe" });
    }
    const j = extractCandles(await callClaude(chartPrompt(ticker, TFS[tf])));
    res.setHeader("Cache-Control", "s-maxage=600");
    return res.status(200).json(j);
  } catch (e) {
    return res.status(502).json({ error: e.message || "Chart failed" });
  }
}
