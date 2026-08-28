# DM Stock Screener — self-hosted website

An AI stock screener with a verification layer: anyone can open the site
and analyse ANY ticker — no Claude account, no login. The AI runs on YOUR
Anthropic API key, kept secret on the server.

Built by Danyal Malik using the Anthropic Claude API.

## What's in this folder

- `index.html` — the whole website (frontend + verification engine)
- `api/analyze.js` — server function: pulls live data + AI analysis for a ticker
- `api/chart.js` — server function: reconstructs OHLC candles per timeframe
- `api/prices.js` — server function: current prices for the track record

The endpoints only accept stock tickers — nobody can use your key as a
general AI proxy.

## Deploy (Vercel, free tier) — about 30 minutes

1. **Get an Anthropic API key**
   - Go to console.anthropic.com → sign up → Billing → add a payment method.
   - IMPORTANT: set a monthly spend limit (e.g. $5) in Billing → Limits.
     This is your safety net — the site is public, so anyone can run
     analyses that cost you money.
   - Create an API key under "API Keys" and copy it.

2. **Put this folder on GitHub**
   - Create a free github.com account → New repository (e.g. `dm-stock-screener`).
   - Upload all files KEEPING the folder structure (`api/` must stay a folder).
     GitHub's web uploader: "uploading an existing file" → drag the whole folder in.

3. **Deploy on Vercel**
   - Go to vercel.com → sign up with your GitHub account.
   - "Add New… → Project" → import your repository → leave all settings
     as default → before deploying, open "Environment Variables" and add:
       Name:  ANTHROPIC_API_KEY
       Value: (paste your key)
   - Click Deploy. Two minutes later you get a live URL like
     `dm-stock-screener.vercel.app`. That's your website — send it to anyone.

4. **Optional**
   - Custom domain: Vercel → project → Settings → Domains (buy one anywhere, ~£10/yr).
   - Cheaper model: add env var `CLAUDE_MODEL` (see Anthropic's docs at
     docs.claude.com for current model names — a Haiku-class model is
     several times cheaper per analysis).

## Costs

Each full analysis makes 2 AI calls with web search, plus 1 per chart
timeframe opened — a few pence per full run. With a $5 monthly cap you
get a healthy number of runs and a hard ceiling on surprises. Check
current pricing at docs.claude.com.

## Notes

- Track-record history is stored in each visitor's own browser (localStorage).
- Data comes from AI web search, not an exchange feed — the whole point of
  the verification layer is to catch and flag anything that doesn't reconcile.
- Not investment advice; keep the footer disclaimer.
