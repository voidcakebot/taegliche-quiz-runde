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
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

function decodeHtml(str = '') {
  return String(str)
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&uuml;/g, 'ü')
    .replace(/&ouml;/g, 'ö')
    .replace(/&auml;/g, 'ä')
    .replace(/&Uuml;/g, 'Ü')
    .replace(/&Ouml;/g, 'Ö')
    .replace(/&Auml;/g, 'Ä')
    .replace(/&nbsp;/g, ' ');
}

async function fromTheTriviaApi() {
  const categories = [
    'history', 'science', 'geography', 'film_and_tv', 'music', 'sport_and_leisure', 'general_knowledge'
  ];
  const c = categories[Math.floor(Math.random() * categories.length)];
  const url = `https://the-trivia-api.com/v2/questions?limit=1&categories=${encodeURIComponent(c)}&difficulties=easy,medium`;
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) return null;
  const arr = await r.json();
  const q = arr?.[0];
  if (!q?.question?.text || !q?.correctAnswer || !Array.isArray(q?.incorrectAnswers)) return null;

  const correct = decodeHtml(q.correctAnswer);
  const options = shuffle([correct, ...q.incorrectAnswers.map(decodeHtml)]).slice(0, 4);
  const correctIndex = options.findIndex((x) => x === correct);
  if (correctIndex < 0) return null;

  return {
    prompt: decodeHtml(q.question.text),
    options,
    correctIndex,
    sourceTitle: `TheTriviaAPI:${c}`,
    createdAt: new Date().toISOString()
  };
}

async function fromOpenTdb() {
  const url = 'https://opentdb.com/api.php?amount=1&type=multiple&encode=url3986';
  const r = await fetch(url);
  if (!r.ok) return null;
  const j = await r.json();
  const item = j?.results?.[0];
  if (!item?.question || !item?.correct_answer || !Array.isArray(item?.incorrect_answers)) return null;

  const q = decodeURIComponent(item.question);
  const correct = decodeURIComponent(item.correct_answer);
  const options = shuffle([correct, ...item.incorrect_answers.map((x) => decodeURIComponent(x))]);
  const correctIndex = options.findIndex((x) => x === correct);
  if (correctIndex < 0) return null;

  return {
    prompt: q,
    options,
    correctIndex,
    sourceTitle: `OpenTDB:${item.category || 'mixed'}`,
    createdAt: new Date().toISOString()
  };
}

async function generateQuestion() {
  return (await fromTheTriviaApi()) || (await fromOpenTdb()) || (() => { throw new Error('No quiz provider available'); })();
}

module.exports = { berlinKeyNow, generateQuestion };
