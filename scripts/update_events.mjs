import { writeFile } from 'node:fs/promises';

// Scan multiple official IR listings so event pages and dated earnings releases
// are both included. Each page may yield any number of matching dated links.
const companies = [
  ['Amazon', ['https://ir.aboutamazon.com/events/default.aspx', 'https://ir.aboutamazon.com/news-release/default.aspx']],
  ['Microsoft', ['https://www.microsoft.com/en-us/Investor/events/default.aspx', 'https://www.microsoft.com/en-us/Investor/earnings/FY-2026-Q1/press-release-webcast']],
  ['Alphabet', ['https://abc.xyz/investor/events/', 'https://abc.xyz/investor/']],
  ['Meta Platforms', ['https://investor.atmeta.com/events-and-presentations/default.aspx', 'https://investor.atmeta.com/news-releases/default.aspx']],
  ['Apple', ['https://investor.apple.com/events/default.aspx', 'https://www.apple.com/newsroom/archive/']],
  ['NVIDIA', ['https://investor.nvidia.com/events-and-presentations/default.aspx', 'https://investor.nvidia.com/news/']],
  ['Tesla', ['https://ir.tesla.com/events-and-presentations', 'https://ir.tesla.com/press']],
  ['Dollar General', ['https://investor.dollargeneral.com/events-and-presentations/default.aspx', 'https://investor.dollargeneral.com/news-releases/default.aspx']],
  ['Dollar Tree', ['https://corporate.dollartree.com/investors/events-and-presentations', 'https://corporate.dollartree.com/news-releases']],
  ['Walmart', ['https://stock.walmart.com/events-and-presentations', 'https://stock.walmart.com/news-releases']],
  ['Costco', ['https://investor.costco.com/events-and-presentations', 'https://investor.costco.com/news-releases']],
  ['Target', ['https://investors.target.com/events-and-presentations', 'https://investors.target.com/press-releases']]
];

const headers = { 'user-agent': 'InvestorRelationsEventUpdater/1.0 (+GitHub Actions)', accept: 'text/html,application/xhtml+xml' };
const events = [];
const today = new Date();
const floor = new Date(today); floor.setMonth(floor.getMonth() - 3);
const ceiling = new Date(today); ceiling.setMonth(ceiling.getMonth() + 18);
const datePattern = /\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b|\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})\b/gi;
const allowed = /earnings|quarterly results|investor day|investor conference|presentation|annual meeting|shareholder meeting|special meeting|conference call|financial results/i;
const months = { january:'01', february:'02', march:'03', april:'04', may:'05', june:'06', july:'07', august:'08', september:'09', october:'10', november:'11', december:'12' };

function datesIn(text) {
  return [...text.matchAll(datePattern)].map(match => match[1]
    ? `${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}`
    : `${match[6]}-${months[match[4].toLowerCase()]}-${match[5].padStart(2,'0')}`);
}

function plainText(html) {
  return html.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/\s+/g, ' ').trim();
}

function extractCandidates(html, source) {
  const found = [];
  const linkPattern = /<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(linkPattern)) {
    const text = plainText(match[4]);
    const contextStart = Math.max(0, match.index - 700);
    const contextEnd = Math.min(html.length, match.index + match[0].length + 700);
    const context = plainText(html.slice(contextStart, contextEnd));
    const label = text || plainText(`${match[1]} ${match[3]}`).replace(/\b(class|href|aria-label|title)=/gi, ' ');
    const searchable = `${label} ${context}`;
    if (!allowed.test(searchable)) continue;
    const dates = [...new Set([...datesIn(label), ...datesIn(context)])];
    if (!dates.length) continue;
    const url = new URL(match[2], source).href;
    for (const date of dates) found.push({ date, event: label.slice(0,180) || 'Investor relations event', url });
  }
  return found;
}

for (const [company, sources] of companies) {
  let pagesScanned = 0;
  for (const source of sources) {
    try {
      const response = await fetch(source, { headers, signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      pagesScanned++;
      for (const candidate of extractCandidates(await response.text(), source)) {
        const when = new Date(`${candidate.date}T00:00:00Z`);
        if (Number.isNaN(+when) || when < floor || when > ceiling) continue;
        if (!events.some(event => event.company === company && event.date === candidate.date && event.event === candidate.event)) {
          events.push({ company, ...candidate });
        }
      }
    } catch (error) {
      console.warn(`${company} (${source}): could not refresh (${error.message})`);
    }
  }
  console.log(`${company}: scanned ${pagesScanned}/${sources.length} sources`);
}

events.sort((a,b) => a.date.localeCompare(b.date) || a.company.localeCompare(b.company));
await writeFile('data/events.json', `${JSON.stringify({ updatedAt: new Date().toISOString(), events }, null, 2)}\n`);
console.log(`Wrote ${events.length} events.`);
