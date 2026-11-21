/* Contract and failure-path checks. All Supabase/storage operations are stubbed. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = process.argv[2] || path.resolve(__dirname, '..');
const ts = require(path.join(root, 'node_modules/typescript'));
function load(name, dependencies = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, 'lib', name + '.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { exports: module.exports, module, setTimeout, clearTimeout, console,
    require(id) { if (!(id in dependencies)) throw new Error('Unexpected dependency: ' + id); return dependencies[id]; },
  });
  return module.exports;
}
const plain = value => JSON.parse(JSON.stringify(value));
const schedule = load('schedule');
const requests = load('requests');
const slot = (day = 1, start = '17:00', end = '20:00') => ({ day_of_week: day, start_time: start, end_time: end });
const saved = { sports: ['tennis'], slots: [slot()] };
let count = 0;
async function check(name, fn) { await fn(); count++; console.log('PASS', name); }

(async () => {
  await check('requires sports and availability', () => {
    assert.ok(schedule.validateSchedule([], [slot()])); assert.ok(schedule.validateSchedule(['tennis'], []));
  });
  await check('rejects unsupported sports, invalid days and reversed times', () => {
    assert.ok(schedule.validateSchedule(['golf'], [slot()]));
    for (const invalid of [slot(0), slot(8), slot(1, '25:00'), slot(1, '20:00', '17:00'), slot(1, '17:00', '17:00')]) assert.ok(schedule.validateSchedule(['tennis'], [invalid]));
  });
  await check('highlights both overlapping windows', () => {
    const slots = [slot(), slot(1, '18:00', '21:00')];
    assert.ok(schedule.windowIssue(slots, 0)); assert.ok(schedule.windowIssue(slots, 1));
  });
  await check('accepts adjacent windows, saved minutes and midnight endings', () => {
    assert.equal(schedule.validateSchedule(['tennis'], [slot(), slot(1, '20:00', '24:00'), slot(3, '17:30:00', '20:45:00')]), null);
  });
  await check('malformed times have a safe editor label', () => {
    assert.equal(schedule.timeLabel('bad'), 'Choose time'); assert.equal(schedule.timeLabel('24:00'), '12 AM (next day)');
  });
  await check('dirty comparison ignores row order and zero seconds', () => {
    assert.equal(schedule.scheduleKey(saved), schedule.scheduleKey({ sports: ['tennis'], slots: [slot(1, '17:00:00', '20:00:00')] }));
    assert.equal(schedule.scheduleKey({ sports: ['tennis','soccer'], slots: [slot(2),slot()] }), schedule.scheduleKey({ sports: ['soccer','tennis'], slots: [slot(),slot(2)] }));
  });
  await check('dirty comparison detects changed minutes and nonzero seconds', () => {
    assert.notEqual(schedule.scheduleKey(saved), schedule.scheduleKey({ sports: ['tennis'], slots: [slot(1, '17:30')] }));
    assert.notEqual(schedule.scheduleKey(saved), schedule.scheduleKey({ sports: ['tennis'], slots: [slot(1, '17:00:05')] }));
  });
  await check('copying replaces only selected days and preserves source', () => {
    const original = [slot(),slot(2,'10:00','12:00'),slot(7)];
    const result = schedule.copyDay(original, 1, [1,2,2,3]);
    assert.equal(result.filter(item=>item.day_of_week===2).length,1);
    assert.equal(result.find(item=>item.day_of_week===2).start_time,'17:00');
    assert.equal(result.find(item=>item.day_of_week===7).start_time,'17:00');
    assert.equal(original[1].start_time,'10:00');
  });
  await check('read timeout rejects a stalled request', async () => {
    await assert.rejects(requests.readWithTimeout(new Promise(()=>{}), 5), /taking too long/);
  });
  await check('read timeout preserves success and original failures', async () => {
    assert.equal(await requests.readWithTimeout(Promise.resolve('ok'), 20),'ok');
    await assert.rejects(requests.readWithTimeout(Promise.reject(new Error('Read failed')),20),/Read failed/);
  });

  let preferences = [{ sport_id: 3, sports: { id: 3, slug: 'tennis' } }];
  let availability = [slot(),slot(1,'18:00','21:00')];
  let readError = null;
  let rpcError = null;
  let gameData = [];
  let saveData = null;
  const scopes = [];
  const calls = [];
  const client = {
    from(table) {
      const query = {
        select() { return query; }, order() { return query; },
        eq(column,id) { scopes.push([table,column,id]); return query; },
        then(resolve,reject) { return Promise.resolve({ data: table === 'user_sports' ? preferences : availability, error: readError }).then(resolve,reject); },
      }; return query;
    },
    async rpc(name,payload) { calls.push({ name, payload }); return { data: name === 'get_my_games' ? gameData : saveData, error: rpcError }; },
  };
  const api = load('matchmaking', { './supabase': { supabase: client }, './schedule': schedule, './requests': requests });
  await check('overlapping saved windows load for repair without data loss', async () => {
    const result = await api.loadSchedule('account-a'); assert.equal(result.slots.length,2); assert.ok(schedule.validateSchedule(result.sports,result.slots));
  });
  await check('both schedule reads are scoped to the signed-in account', () => assert.equal(scopes.filter(item=>item[1]==='user_id'&&item[2]==='account-a').length,2));
  await check('unreadable preferences and failed reads are reported', async () => {
    preferences = [{ sport_id: 'unknown', sports: null }]; await assert.rejects(api.loadSchedule('a'), /could not be read/);
    readError = { message: 'Read denied' }; await assert.rejects(api.loadSchedule('a'), error=>error.message==='Read denied'); readError=null;
  });
  await check('saving sends the complete schedule once and never calls matching separately', async () => {
    await api.saveSchedule(['tennis','soccer'], [slot(),slot(3)]);
    assert.equal(calls.length,1); assert.equal(calls[0].name,'save_my_schedule');
    assert.equal(calls[0].payload.p_sports.length,2); assert.equal(calls[0].payload.p_slots.length,2);
  });
  await check('schedule save preserves removed-game metadata from the backend', async () => {
    saveData = { removed_count: 1, removed_games: [{ game_id: 'removed-game', sport: 'tennis', starts_at: '2099-01-01T20:00:00Z', venue_name: 'Court 2', reason: 'availability_changed', new_offers: 1 }] };
    assert.deepEqual(plain(await api.saveSchedule(saved.sports, saved.slots)), saveData);
  });
  await check('zero removals preserve the ordinary save-success result', async () => {
    saveData = { removed_count: 0, removed_games: [] };
    assert.deepEqual(plain(await api.saveSchedule(saved.sports, saved.slots)), saveData);
  });
  await check('older save responses remain compatible without inventing removals', async () => {
    saveData = null;
    assert.deepEqual(plain(await api.saveSchedule(saved.sports, saved.slots)), { removed_count: 0, removed_games: [] });
  });
  await check('invalid schedules never reach the backend', async () => {
    const before=calls.length; await assert.rejects(api.saveSchedule([],[])); assert.equal(calls.length,before);
  });
  await check('backend write failures are surfaced', async () => {
    rpcError={message:'Matching failed'}; await assert.rejects(api.saveSchedule(saved.sports,saved.slots), error=>error.message==='Matching failed'); rpcError=null;
  });
  await check('backend game selection is not hidden by device clock filtering', async () => {
    gameData=[{id:'old',sport:'tennis',status:'confirmed',rsvp_status:'pending',starts_at:'2001-01-01T20:00:00Z',player_count:2}, {id:'future',sport:'tennis',status:'confirmed',rsvp_status:'pending',starts_at:'2099-01-01T20:00:00Z',player_count:2}, {id:'pending',sport:'tennis',status:'pending',rsvp_status:'pending',starts_at:'2099-01-01T20:00:00Z',player_count:2}];
    const games=await api.loadGames(); assert.deepEqual(plain(games.map(game=>game.id)),['old','future']);
  });
  await check('malformed game records produce a readable error', async () => {
    for (const data of [null,[null],[{id:'a',starts_at:'bad'}]]) { gameData=data; await assert.rejects(api.loadGames(), /could not be read|not a list/); }
  });

  const storage = new Map();
  let failStorage = false;
  let releaseWrite;
  const storageClient = {
    async getItem(key) { if(failStorage) throw new Error('Storage unavailable'); return storage.get(key) ?? null; },
    async setItem(key,value) { if(failStorage) throw new Error('Storage unavailable'); if(releaseWrite) await releaseWrite; storage.set(key,value); },
    async removeItem(key) { if(failStorage) throw new Error('Storage unavailable'); storage.delete(key); },
  };
  const drafts = load('drafts', { '@react-native-async-storage/async-storage': storageClient, './schedule': schedule });
  const base=schedule.scheduleKey(saved);
  const changed={sports:['soccer'],slots:[slot(3)]};
  await check('drafts are isolated by account', async () => {
    await drafts.storeDraft('a',changed,base); assert.equal((await drafts.readDraft('a',saved)).sports[0],'soccer'); assert.equal(await drafts.readDraft('b',saved),null);
  });
  await check('drafts preserve the saved baseline for conflict warnings', async () => {
    assert.equal((await drafts.readDraft('a',{sports:['badminton'],slots:[slot(4)]})).base,base);
  });
  await check('already-saved drafts are automatically cleared', async () => {
    await drafts.storeDraft('b',saved,base); assert.equal(await drafts.readDraft('b',saved),null);
  });
  await check('a delayed autosave cannot recreate a discarded draft', async () => {
    let release; releaseWrite=new Promise(resolve=>{release=resolve;});
    const write=drafts.storeDraft('a',changed,base); await new Promise(resolve=>setImmediate(resolve));
    const clear=drafts.clearDraft('a'); release(); await Promise.all([write,clear]); releaseWrite=null;
    assert.equal(await drafts.readDraft('a',saved),null);
  });
  await check('draft writes snapshot values before entering the queue', async () => {
    const value={sports:['tennis'],slots:[slot(5)]}; const write=drafts.storeDraft('a',value,base); value.sports[0]='soccer'; await write;
    assert.equal((await drafts.readDraft('a',saved)).sports[0],'tennis');
  });
  await check('storage failure is reported and does not poison subsequent writes', async () => {
    failStorage=true; await assert.rejects(drafts.storeDraft('a',changed,base),/Storage unavailable/);
    failStorage=false; await drafts.storeDraft('a',changed,base); assert.equal((await drafts.readDraft('a',saved)).sports[0],'soccer');
  });
  await check('corrupt drafts are rejected without modifying the remote schedule', async () => {
    storage.set('runit:schedule-draft:v1:c','{bad'); await assert.rejects(drafts.readDraft('c',saved));
    assert.equal(saved.slots[0].start_time,'17:00');
  });
  console.log(`\n${count} frontend checks passed. No live Supabase operations were performed.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
