const path = require('path');
const { createStorage } = require('../storage');
const { berlinKeyNow, generateQuestion } = require('../wiki');

const statePath = process.env.STATE_PATH || path.join('/tmp', 'taegliche-quiz-runde-state.json');
const storage = createStorage(statePath);
let initialized = false;
async function ensureInit(){ if(!initialized){ await storage.init(); initialized = true; } }

function mapErr(e){
  return e==='CHARACTER_TAKEN' ? [409,'Character already taken.'] :
    e==='UNKNOWN_CHARACTER' ? [400,'Unknown character.'] :
    e==='NOT_FOUND' ? [404,'Character not registered.'] :
    e==='BAD_PASSWORD' ? [401,'Wrong password.'] :
    e==='ALREADY_ANSWERED' ? [409,'Already answered today.'] : [500,'Error'];
}

async function getDailyQuestion() {
  await ensureInit();
  const key = berlinKeyNow();
  let q = await storage.getQuestion(key);
  if (!q) {
    q = await generateQuestion();
    await storage.setQuestion(key, q);
  }
  return { key, ...q };
}

function body(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    let b=''; req.on('data', c=>b+=c); req.on('end', ()=>{ try{ resolve(JSON.parse(b||'{}')); } catch(e){ reject(e); } }); req.on('error', reject);
  });
}

module.exports = { storage, ensureInit, mapErr, getDailyQuestion, body };
