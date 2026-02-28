const fs = require('fs');
const path = require('path');
const { FileStorage } = require('./storage');
const { berlinKeyNow, generateQuestion } = require('./wiki');

const storage = new FileStorage(path.join(__dirname, 'state.json'));

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
  return e==='CHARACTER_TAKEN' ? [409,'Charakter bereits vergeben.'] :
    e==='UNKNOWN_CHARACTER' ? [400,'Unbekannter Charakter.'] :
    e==='NOT_FOUND' ? [404,'Charakter nicht registriert.'] :
    e==='BAD_PASSWORD' ? [401,'Falsches Passwort.'] :
    e==='ALREADY_ANSWERED' ? [409,'Für heute bereits beantwortet.'] : [500,'Fehler'];
}

async function getDailyQuestion() {
  const key = berlinKeyNow();
  let q = storage.getQuestion(key);
  if (!q) {
    q = await generateQuestion();
    storage.setQuestion(key, q);
  }
  return { key, ...q };
}

async function handler(req,res){
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/bootstrap' && req.method === 'GET') {
    return send(res,200,{ ok:true, ...storage.bootstrap() });
  }

  if (url.pathname === '/api/register' && req.method === 'POST') {
    try {
      const p = await readBody(req);
      const character = String(p.character||'').trim();
      const password = String(p.password||'').trim();
      if (password.length < 4) return send(res,400,{ok:false,error:'Passwort mindestens 4 Zeichen.'});
      const r = storage.register({ character, password });
      if (!r.ok){ const [c,m]=mapErr(r.error); return send(res,c,{ok:false,error:m}); }
      return send(res,200,{ok:true});
    } catch { return send(res,400,{ok:false,error:'Ungültige Anfrage.'}); }
  }

  if (url.pathname === '/api/login' && req.method === 'POST') {
    try {
      const p = await readBody(req);
      const r = storage.login({ character:String(p.character||'').trim(), password:String(p.password||'').trim() });
      if (!r.ok){ const [c,m]=mapErr(r.error); return send(res,c,{ok:false,error:m}); }
      return send(res,200,{ok:true,user:r.user});
    } catch { return send(res,400,{ok:false,error:'Ungültige Anfrage.'}); }
  }

  if (url.pathname === '/api/question/today' && req.method === 'GET') {
    try {
      const character = String(url.searchParams.get('character') || '').trim();
      const q = await getDailyQuestion();
      const alreadyAnswered = character ? storage.hasAnswered(character, q.key) : false;
      return send(res,200,{ ok:true, question:{ key:q.key, prompt:q.prompt, options:q.options }, alreadyAnswered });
    } catch {
      return send(res,500,{ok:false,error:'Konnte Tagesfrage nicht laden.'});
    }
  }

  if (url.pathname === '/api/answer' && req.method === 'POST') {
    try {
      const p = await readBody(req);
      const character = String(p.character||'').trim();
      const password = String(p.password||'').trim();
      const choiceIndex = Number(p.choiceIndex);
      const login = storage.login({ character, password });
      if (!login.ok){ const [c,m]=mapErr(login.error); return send(res,c,{ok:false,error:m}); }

      const q = await getDailyQuestion();
      const isCorrect = choiceIndex === Number(q.correctIndex);
      const r = storage.answer({ character, key:q.key, isCorrect });
      if (!r.ok){ const [c,m]=mapErr(r.error); return send(res,c,{ok:false,error:m}); }
      return send(res,200,{ ok:true, isCorrect, correctIndex:q.correctIndex, points:r.points });
    } catch { return send(res,400,{ok:false,error:'Ungültige Anfrage.'}); }
  }

  const filePath = url.pathname === '/' ? path.join(__dirname, 'index.html') : path.join(__dirname, url.pathname.replace(/^\//,''));
  if (!filePath.startsWith(__dirname) || !fs.existsSync(filePath)) return send(res,404,'Not found','text/plain');
  const ext = path.extname(filePath);
  const types={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json'};
  return send(res,200,fs.readFileSync(filePath),types[ext]||'application/octet-stream');
}

module.exports = { handler };
