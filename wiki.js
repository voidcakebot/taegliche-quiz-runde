function berlinKeyNow() {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  const parts = Object.fromEntries(dtf.formatToParts(new Date()).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  let y = Number(parts.year), m = Number(parts.month), d = Number(parts.day);
  const hh = Number(parts.hour), mm = Number(parts.minute);
  if (hh < 8 || (hh === 8 && mm < 30)) {
    const tmp = new Date(Date.UTC(y, m - 1, d));
    tmp.setUTCDate(tmp.getUTCDate() - 1);
    y = tmp.getUTCFullYear(); m = tmp.getUTCMonth() + 1; d = tmp.getUTCDate();
  }
  const pad = (n)=>String(n).padStart(2,'0');
  return `${y}-${pad(m)}-${pad(d)}`;
}

function shuffle(a) {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
}

async function randomTitle() {
  const u = 'https://en.wikipedia.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=1&format=json';
  const r = await fetch(u);
  const j = await r.json();
  return j?.query?.random?.[0]?.title || null;
}

async function fetchSummary(title) {
  const t = encodeURIComponent(title);
  const u = `https://en.wikipedia.org/api/rest_v1/page/summary/${t}`;
  const r = await fetch(u, { headers: { 'accept': 'application/json' } });
  if (!r.ok) return null;
  const j = await r.json();
  if (!j?.extract || !j?.title) return null;
  return { title: j.title, extract: j.extract };
}

async function generateQuestion() {
  let summary = null;
  for (let i=0;i<8 && !summary;i++) {
    const t = await randomTitle();
    if (!t) continue;
    const s = await fetchSummary(t);
    if (s && s.extract.length > 120) summary = s;
  }
  if (!summary) throw new Error('Could not generate question from Wikipedia');

  const sentence = summary.extract.split('. ').slice(0,2).join('. ');
  const prompt = `Aus welchem Wikipedia-Artikel stammt dieser Hinweis?\n\n"${sentence}"`;

  const distractors = new Set();
  while (distractors.size < 3) {
    const t = await randomTitle();
    if (!t) continue;
    if (t.toLowerCase() === summary.title.toLowerCase()) continue;
    distractors.add(t);
  }

  const options = shuffle([summary.title, ...distractors]);
  const correctIndex = options.findIndex((o)=>o === summary.title);
  return { prompt, options, correctIndex, sourceTitle: summary.title, createdAt: new Date().toISOString() };
}

module.exports = { berlinKeyNow, generateQuestion };
