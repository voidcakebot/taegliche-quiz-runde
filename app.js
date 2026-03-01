const fs = require('fs');
const path = require('path');
const { createStorage } = require('./storage');
const { berlinKeyNow, generateRound } = require('./wiki');

const storage = createStorage(path.join(__dirname, 'state.json'));
let initialized = false;

function send(res, code, data, type='application/json') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(type === 'application/json' ? JSON.stringify(data) : data);
}

function readBody(req) {
  return new Promise((resolve,reject)=>{
    let b=''; req.on('data',c=>b+=c); req.on('end',()=>{ try{ resolve(JSON.parse(b||'{}')); } catch(e){ reject(e); } }); req.on('error',reject);
  });
}

function mapErr(e){
  return e==='CHARACTER_TAKEN' ? [409,'Character already taken.'] :
    e==='UNKNOWN_CHARACTER' ? [400,'Unknown character.'] :
    e==='NOT_FOUND' ? [404,'Character not registered.'] :
    e==='BAD_PASSWORD' ? [401,'Wrong password.'] :
    e==='ALREADY_ANSWERED' ? [409,'Already answered this question today.'] :
    e==='BAD_QUESTION_INDEX' ? [400,'Invalid question index.'] : [500,'Error'];
}

async function getDailyRound() {
  const key = berlinKeyNow();
  let q = await storage.getQuestion(key);
  if (!q || !Array.isArray(q.questions) || q.questions.length !== 3) {
    q = await generateRound(3);
    await storage.setQuestion(key, q);
  }
  return { key, ...q };
}

async function ensureInit() {
  if (initialized) return;
  await storage.init();
  initialized = true;
}

async function handler(req,res){
  await ensureInit();
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/bootstrap' && req.method === 'GET') {
    return send(res,200,{ ok:true, ...(await storage.bootstrap()) });
  }

  if (url.pathname === '/api/register' && req.method === 'POST') {
    try {
      const p = await readBody(req);
      const character = String(p.character||'').trim();
      const password = String(p.password||'').trim();
      if (password.length < 4) return send(res,400,{ok:false,error:'Password must be at least 4 characters.'});
      const r = await storage.register({ character, password });
      if (!r.ok){ const [c,m]=mapErr(r.error); return send(res,c,{ok:false,error:m}); }
      return send(res,200,{ok:true});
    } catch { return send(res,400,{ok:false,error:'Invalid request.'}); }
  }

  if (url.pathname === '/api/login' && req.method === 'POST') {
    try {
      const p = await readBody(req);
      const r = await storage.login({ character:String(p.character||'').trim(), password:String(p.password||'').trim() });
      if (!r.ok){ const [c,m]=mapErr(r.error); return send(res,c,{ok:false,error:m}); }
      return send(res,200,{ok:true,user:r.user});
    } catch { return send(res,400,{ok:false,error:'Invalid request.'}); }
  }

  if (url.pathname === '/api/question-today' && req.method === 'GET') {
    try {
      const character = String(url.searchParams.get('character') || '').trim();
      const requestedIndex = Number(url.searchParams.get('questionIndex') || 0);
      const round = await getDailyRound();
      let progress = { answered:[false,false,false], answeredCount:0 };
      if (character) progress = await storage.getProgress(character, round.key);
      const firstOpen = progress.answered.findIndex((v)=>!v);
      const nextIndex = firstOpen === -1 ? 2 : firstOpen;
      const questionIndex = Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex <= 2
        ? Math.min(requestedIndex, nextIndex)
        : nextIndex;
      const q = round.questions[questionIndex];
      return send(res,200,{ ok:true, key: round.key, questionIndex, totalQuestions:3, progress, finished: progress.answeredCount >= 3, question:{ prompt:q.prompt, options:q.options } });
    } catch {
      return send(res,500,{ok:false,error:'Could not load daily questions.'});
    }
  }

  if (url.pathname === '/api/answer' && req.method === 'POST') {
    try {
      const p = await readBody(req);
      const character = String(p.character||'').trim();
      const password = String(p.password||'').trim();
      const questionIndex = Number(p.questionIndex);
      const choiceIndex = Number(p.choiceIndex);
      const timedOut = Boolean(p.timedOut);

      const login = await storage.login({ character, password });
      if (!login.ok){ const [c,m]=mapErr(login.error); return send(res,c,{ok:false,error:m}); }

      const round = await getDailyRound();
      const q = round.questions[questionIndex];
      const isCorrect = !timedOut && choiceIndex === Number(q.correctIndex);
      const r = await storage.answer({ character, key:round.key, questionIndex, isCorrect });
      if (!r.ok){ const [c,m]=mapErr(r.error); return send(res,c,{ok:false,error:m}); }
      return send(res,200,{ ok:true, isCorrect, timedOut, correctIndex:q.correctIndex, points:r.points, answered:r.answered, answeredCount:r.answeredCount, roundFinished:r.answeredCount >= 3 });
    } catch { return send(res,400,{ok:false,error:'Invalid request.'}); }
  }

  if (url.pathname === '/api/generate-daily' && (req.method === 'GET' || req.method === 'POST')) {
    try {
      const q = await getDailyRound();
      return send(res, 200, { ok: true, key: q.key, totalQuestions: q.questions.length });
    } catch {
      return send(res, 500, { ok:false, error:'Could not generate daily round' });
    }
  }

  if (url.pathname === '/api/reset-users' && req.method === 'POST') {
    try {
      const p = await readBody(req);
      if (String(p.confirm || '') !== 'RESET_USERS') return send(res, 400, { ok:false, error:'Missing confirm token.' });
      await storage.clearUsers();
      return send(res, 200, { ok:true });
    } catch {
      return send(res, 500, { ok:false, error:'Reset failed' });
    }
  }

  const filePath = url.pathname === '/' ? path.join(__dirname, 'index.html') : path.join(__dirname, url.pathname.replace(/^\//,''));
  if (!filePath.startsWith(__dirname) || !fs.existsSync(filePath)) return send(res,404,'Not found','text/plain');
  const ext = path.extname(filePath);
  const types={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json'};
  return send(res,200,fs.readFileSync(filePath),types[ext]||'application/octet-stream');
}

module.exports = { handler };
