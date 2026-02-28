const path = require('path');
const { FileStorage } = require('../storage');
const { berlinKeyNow, generateQuestion } = require('../wiki');

const statePath = process.env.STATE_PATH || path.join('/tmp', 'taegliche-quiz-runde-state.json');
const storage = new FileStorage(statePath);

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

function body(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    let b=''; req.on('data', c=>b+=c); req.on('end', ()=>{ try{ resolve(JSON.parse(b||'{}')); } catch(e){ reject(e); } }); req.on('error', reject);
  });
}

module.exports = { storage, mapErr, getDailyQuestion, body };
