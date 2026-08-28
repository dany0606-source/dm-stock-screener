// /api/prices — current prices for up to 10 tickers (track-record re-check).

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";

export default async function handler(req, res) {
  try {
    const raw = String(req.query.tickers || "").toUpperCase();
    const tickers = [...new Set(raw.split(",").map(s => s.trim()).filter(t => /^[A-Z.\-]{1,8}$/.test(t)))].slice(0, 10);
    if (!tickers.length) return res.status(400).json({ error: "No valid tickers" });
    const prompt = `Search the web for the current share prices of these stock tickers: ${tickers.join(", ")}.
Respond with ONLY a JSON object mapping each ticker to its latest price in USD as a plain number, e.g. {"AAPL": 230.1}. Use null for any ticker you cannot confirm.`;
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL, max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      }),
    });
    if (!r.ok) throw new Error("Anthropic API error " + r.status);
    const data = await r.json();
    const text = (data.content || []).map(b => b.type === "text" ? b.text : "").join("\n").replace(/```json|```/g, "");
    const s = text.indexOf("{"), e = text.lastIndexOf("}");
    const j = JSON.parse(text.slice(s, e + 1));
    return res.status(200).json(j);
  } catch (e) {
    return res.status(502).json({ error: e.message || "Price check failed" });
  }
}
