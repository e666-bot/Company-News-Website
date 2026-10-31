import { writeFile } from 'node:fs/promises';

// Sources are checked for published event announcements. These public IR endpoints
// are used as discovery sources; the workflow retains the last known feed on failure.
const companies = [
  ['Amazon', 'https://ir.aboutamazon.com/events-and-presentations/default.aspx'],
  ['Microsoft', 'https://www.microsoft.com/en-us/Investor/events/default.aspx'],
  ['Alphabet', 'https://abc.xyz/investor/events/'],
  ['Meta Platforms', 'https://investor.atmeta.com/events-and-presentations/default.aspx'],
  ['Apple', 'https://investor.apple.com/events/default.aspx'],
  ['NVIDIA', 'https://investor.nvidia.com/events-and-presentations/default.aspx'],
  ['Tesla', 'https://ir.tesla.com/events-and-presentations'],
  ['Dollar General', 'https://investor.dollargeneral.com/events-and-presentations/default.aspx'],
  ['Dollar Tree', 'https://corporate.dollartree.com/investors/events-and-presentations'],
  ['Walmart', 'https://stock.walmart.com/events-and-presentations'],
  ['Costco', 'https://investor.costco.com/events-and-presentations'],
  ['Target', 'https://investors.target.com/events-and-presentations']
];

const headers = { 'user-agent': 'InvestorRelationsEventUpdater/1.0 (+GitHub Actions)', accept: 'text/html,application/xhtml+xml' };
const events = [];
const today = new Date();
const floor = new Date(today); floor.setMonth(floor.getMonth() - 3);
const ceiling = new Date(today); ceiling.setMonth(ceiling.getMonth() + 18);
const datePattern = /\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b|\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})\b/gi;
const allowed = /earnings|quarterly results|investor day|investor conference|presentation|annual meeting|shareholder meeting|special meeting|conference call/i;

for (const [company, source] of companies) {
  try {
    const response = await fetch(source, { headers, signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const items = [...html.matchAll(/<(?:a|div|li|article)[^>]*>([\s\S]{0,1600}?)<\/(?:a|div|li|article)>/gi)];
    for (const item of items) {
      const text = item[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
      if (!allowed.test(text)) continue;
      const match = datePattern.exec(text); datePattern.lastIndex = 0;
      if (!match) continue;
      let date;
      if (match[1]) date = `${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}`;
      else date = `${match[6]}-${String(new Date(`${match[4]} ${match[5]}, ${match[6]}`).getMonth()+1).padStart(2,'0')}-${match[5].padStart(2,'0')}`;
      const when = new Date(`${date}T00:00:00Z`);
      if (Number.isNaN(+when) || when < floor || when > ceiling) continue;
      const title = text.replace(datePattern, '').replace(/\s+/g, ' ').trim().slice(0, 180) || 'Investor relations event';
      const href = item[0].match(/\bhref=["']([^"']+)/i)?.[1];
      const url = href ? new URL(href, source).href : source;
      if (!events.some(event => event.company === company && event.date === date && event.event === title)) events.push({ company, date, event: title, url });
    }
    console.log(`${company}: scanned`);
  } catch (error) {
    console.warn(`${company}: could not refresh (${error.message})`);
  }
}

events.sort((a,b) => a.date.localeCompare(b.date) || a.company.localeCompare(b.company));
await writeFile('data/events.json', `${JSON.stringify({ updatedAt: new Date().toISOString(), events }, null, 2)}\n`);
console.log(`Wrote ${events.length} events.`);
