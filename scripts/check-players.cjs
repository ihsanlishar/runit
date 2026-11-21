/* Read-only player lookup checks with a stub Supabase client. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = process.argv[2] || path.resolve(__dirname, '..');
const ts = require(path.join(root, 'node_modules/typescript'));
function load(name, dependencies = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, 'lib', name + '.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, setTimeout, clearTimeout, require(id) { if (!(id in dependencies)) throw Error(id); return dependencies[id]; } });
  return module.exports;
}
let data = [
  { user_id: 'a', display_name: ' Alex ', username: 'alex_1', rsvp_status: 'pending' },
  { user_id: 'b', display_name: 'Blair', username: 'blair_2', rsvp_status: 'accepted' },
];
let error = null;
const calls = [];
const supabase = { rpc(name, args) {
  calls.push({ name, args });
  return Promise.resolve({ data, error });
} };
const api = load('players', { './supabase': { supabase }, './requests': load('requests') });
const plain = value => JSON.parse(JSON.stringify(value));
let checks = 0;
async function check(name, fn) { await fn(); checks++; console.log('PASS', name); }
(async () => {
  await check('uses the roster RPC with the selected game ID, without direct table reads', async () => {
    const result = await api.loadGamePlayers('game-one');
    assert.deepEqual(plain(calls), [{ name: 'get_game_players', args: { p_game_id: 'game-one' } }]);
    assert.equal(result.length, 2);
    assert.equal(result[0].display_name, 'Blair');
    assert.equal(result[1].display_name, 'Alex');
  });
  await check('declined and unknown participant statuses do not appear', async () => {
    data = [...data, { user_id: 'c', rsvp_status: 'declined' }, { user_id: 'd', rsvp_status: 'expired' }];
    assert.deepEqual(plain((await api.loadGamePlayers('game-one')).map(player => player.user_id)), ['b', 'a']);
  });
  await check('blank display names preserve username fallback without inventing names', async () => {
    data = [{ user_id: 'a', display_name: '  ', username: ' alex_1 ', rsvp_status: 'pending' },
      { user_id: 'b', display_name: null, username: null, rsvp_status: 'accepted' }];
    const result = await api.loadGamePlayers('game-one');
    assert.equal(result.find(player => player.user_id === 'a').display_name, null);
    assert.equal(result.find(player => player.user_id === 'a').username, 'alex_1');
    assert.equal(result.find(player => player.user_id === 'b').display_name, null);
  });
  await check('an empty roster remains empty', async () => {
    data = []; assert.equal((await api.loadGamePlayers('game-one')).length, 0);
  });
  await check('RPC permission and server errors propagate for the retry UI', async () => {
    error = { message: 'Permission denied for this game' };
    await assert.rejects(api.loadGamePlayers('game-one'), reason => reason.message === error.message);
    error = null;
  });
  await check('malformed RPC responses produce a readable error', async () => {
    for (const invalid of [null, {}, [null], [{ user_id: 'a', rsvp_status: 'accepted', display_name: 12 }], [{ user_id: 'a' }]]) {
      data = invalid; await assert.rejects(api.loadGamePlayers('game-one'), /matched players could not be read/);
    }
  });
  await check('a missing game identifier does not issue a request', async () => {
    const before = calls.length; await assert.rejects(api.loadGamePlayers('')); assert.equal(calls.length, before);
  });
  console.log(`${checks} player lookup checks passed. All RPC calls were stubbed.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
