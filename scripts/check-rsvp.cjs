/* No real users or backend writes: verifies the RSVP RPC contracts with a stub client. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = process.argv[2] || path.resolve(__dirname, '..');
const ts = require(path.join(root, 'node_modules/typescript'));
function load(file, dependencies = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, 'lib', file + '.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, setTimeout, clearTimeout, require(id) {
    if (!(id in dependencies)) throw Error('Unexpected dependency: ' + id);
    return dependencies[id];
  } });
  return module.exports;
}
const requests = load('requests');
const schedule = load('schedule');
const calls = [];
let result = { data: null, error: null };
const supabase = { async rpc(name, payload) { calls.push({ name, payload }); return result; } };
const api = load('rsvp', { './supabase': { supabase }, './requests': requests });
const games = load('matchmaking', { './supabase': { supabase }, './requests': requests, './schedule': schedule });
const plain = value => JSON.parse(JSON.stringify(value));
const game = { id: 'game-a', sport: 'tennis', starts_at: '2099-01-01T20:00:00Z', status: 'confirmed', rsvp_status: 'pending', player_count: 2 };
const offer = { offer_id: 'offer-a', game_id: 'game-a', sport: 'tennis', starts_at: game.starts_at, expires_at: '2099-01-01T19:00:00Z', venue_name: 'Court 2', offer_status: 'pending' };
let count = 0;
async function check(name, fn) { await fn(); count++; console.log('PASS', name); }
(async () => {
  await check('refreshes offers with the exact no-argument RPC', async () => {
    await api.refreshGameOffers(); assert.deepEqual(plain(calls.at(-1)), { name: 'refresh_game_offers' });
  });
  await check('RSVP accept/decline use exact backend parameters', async () => {
    for (const response of ['accept', 'decline']) {
      await api.respondToGame('game-a', response);
      assert.deepEqual(plain(calls.at(-1)), { name: 'respond_to_game_rsvp', payload: { p_game_id: 'game-a', p_response: response } });
    }
  });
  await check('invitation responses send offer ID, not game ID', async () => {
    for (const response of ['accept', 'decline']) {
      await api.respondToOffer('offer-a', response);
      assert.deepEqual(plain(calls.at(-1)), { name: 'respond_to_game_offer', payload: { p_offer_id: 'offer-a', p_response: response } });
    }
  });
  await check('invalid responses never reach Supabase', async () => {
    const before = calls.length;
    await assert.rejects(api.respondToGame('', 'accept'));
    await assert.rejects(api.respondToOffer('offer-a', 'yes'));
    assert.equal(calls.length, before);
  });
  await check('SQL errors propagate without pretending success', async () => {
    result = { data: null, error: { message: 'Offer expired' } };
    for (const operation of [() => api.respondToGame('game-a','accept'), () => api.respondToOffer('offer-a','accept'), api.refreshGameOffers, api.loadOffers]) {
      await assert.rejects(operation(), error => error.message === 'Offer expired');
    }
  });
  await check('explicit business-rule failures are surfaced', async () => {
    result = { data: { success: false, message: 'Game is full' }, error: null };
    await assert.rejects(api.respondToOffer('offer-a','accept'), /Game is full/);
    result = { data: { ok: false, error: 'Response rejected' }, error: null };
    await assert.rejects(api.respondToGame('game-a','decline'), /Response rejected/);
  });
  await check('offer details and expiration are read from actual RPC fields', async () => {
    result = { data: [offer], error: null };
    const offers = await api.loadOffers();
    assert.equal(calls.at(-1).name, 'get_my_offers'); assert.equal(offers[0].id, 'offer-a');
    assert.equal(offers[0].expires_at, offer.expires_at); assert.equal(offers[0].venue_name, 'Court 2');
    assert.equal(api.canRespondToOffer(offers[0], Date.parse('2099-01-01T18:00:00Z')), true);
  });
  await check('supports id/status aliases without generating offer identifiers', async () => {
    const { offer_id, offer_status, ...fields } = offer;
    result = { data: [{ ...fields, id: offer_id, status: offer_status }], error: null };
    assert.equal((await api.loadOffers())[0].id, 'offer-a');
  });
  await check('empty invitations remain empty; malformed responses report errors', async () => {
    result = { data: [], error: null }; assert.equal((await api.loadOffers()).length, 0);
    for (const data of [null, [null], [{ ...offer, expires_at: null }], [{ ...offer, offer_id: null }]]) {
      result = { data, error: null }; await assert.rejects(api.loadOffers());
    }
  });
  await check('offers cannot be acted on at expiration, after start, or after resolution', () => {
    const item = { ...offer, id: offer.offer_id, status: 'pending' };
    assert.equal(api.canRespondToOffer(item, Date.parse(offer.expires_at)), false);
    assert.equal(api.canRespondToOffer({ ...item, starts_at: '2001-01-01T20:00:00Z' }), false);
    for (const status of ['accepted', 'declined', 'expired']) assert.equal(api.canRespondToOffer({ ...item, status }), false);
  });
  await check('pending players can accept/decline; accepted players can only decline', () => {
    const before = Date.parse('2099-01-01T18:00:00Z');
    assert.equal(api.canRespondToGame('pending', game.starts_at, 'accept', before), true);
    assert.equal(api.canRespondToGame('pending', game.starts_at, 'decline', before), true);
    assert.equal(api.canRespondToGame('accepted', game.starts_at, 'accept', before), false);
    assert.equal(api.canRespondToGame('accepted', game.starts_at, 'decline', before), true);
    assert.equal(api.canRespondToGame('declined', game.starts_at, 'accept', before), false);
  });
  await check('no RSVP changes are offered at or after game start', () => {
    for (const status of ['pending', 'accepted']) for (const response of ['accept', 'decline']) {
      assert.equal(api.canRespondToGame(status, game.starts_at, response, Date.parse(game.starts_at)), false);
    }
  });
  await check('declined participants are excluded only from refreshed server results', async () => {
    result = { data: [game, { ...game, id: 'declined-game', rsvp_status: 'declined' }, { ...game, id: 'going-game', rsvp_status: 'accepted' }], error: null };
    assert.deepEqual(plain((await games.loadGames()).map(item => item.id)), ['game-a', 'going-game']);
  });
  await check('missing RSVP fields produce an error instead of inventing a pending RSVP', async () => {
    const { rsvp_status, ...missing } = game; result = { data: [missing], error: null };
    await assert.rejects(games.loadGames(), /could not be read/);
  });
  console.log(`\n${count} RSVP checks passed. All backend operations were stubbed.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
