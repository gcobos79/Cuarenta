// Niveles 1, 2 y 3 de Don Barajón, copiados del juego (V1.03.29) sin cambios de lógica.
// Usan un estado global S visto desde Don (asiento 1). El simulador fija S antes de cada llamada.
'use strict';
const { R, makeDeck, shuffle, legalCaptures } = require('../motor/reglas.js');

let S = null;
let donStrategicNote = '';
const donLearning = { riskWeight: 2.4 }; // valor inicial del juego (sin aprendizaje acumulado)

function rule38On() { return !!(S && S.rule38); }
function rule38At38(p) { return rule38On() && S.score[p] === 38; }
function falta4DealerPending(p) { return !!(S && S.falta4 && S.section === 1 && S.dealer === p && S.s1Captured && !S.s1Captured[p]); }
function rondaValueOfHand(h) { const m = {}; h.forEach(c => { m[c.value] = (m[c.value] || 0) + 1; }); const v = Object.keys(m).find(k => m[k] === 3); return v === undefined ? null : Number(v); }
function disjointCaptureRoutes(options, limit) { const used = new Set(); let n = 0; for (const o of [...options].sort((a, b) => a.length - b.length)) { if (n >= limit) break; if (o.some(x => used.has(x.id))) continue; o.forEach(x => used.add(x.id)); n++; } return n; }
function donShouldClaimRonda() {
  const v = S.rondaVal && S.rondaVal[1]; if (v === null || v === undefined) return false;
  if (rule38At38(1)) return false;
  if (S.score[1] + 2 >= 40) return true;
  if ([...S.table, ...S.captured[0], ...S.captured[1]].some(x => x.value === v)) return true;
  const pool = unseenPoolForDon().length; if (!pool) return true;
  const p4 = Math.min(1, S.hands[0].length / pool);
  const mine = S.hands[1].find(x => x.value === v);
  const routes = mine ? disjointCaptureRoutes(legalCaptures(mine, S.table), 2) : 0;
  const safe = Math.min(3, routes + (S.dealer === 1 ? 1 : 0));
  const risk = safe >= 3 ? 0 : p4;
  return 2 > 4 * risk;
}
function donRondaExposurePoints(c, o) { return S.rondaClaimed && S.rondaClaimed[1] && S.rondaVal && S.rondaVal[1] === c.value && !o.length ? 4 : 0; }
function donRondaFallChanceOnPlayer(c) {
  if (!S.rondaClaimed || !S.rondaClaimed[0] || !S.lastPlayed || S.lastPlayed.player !== 0) return 0;
  const pool = unseenPoolForDon(), v = S.lastPlayed.card.value, cands = [];
  for (let u = 1; u <= 10; u++) { const n = pool.filter(x => x.value === u).length + (u === v ? 1 : 0); if (n >= 3) cands.push(u); }
  return c.value === v && cands.includes(v) ? 1 / cands.length : 0;
}
function knownOutsidePlayerHand() {
  const known = [...S.hands[1], ...S.table, ...S.captured[0], ...S.captured[1]];
  const ids = new Set(known.map(c => c.id));
  return makeDeck().filter(c => ids.has(c.id));
}
function unseenPoolForDon() {
  const known = knownOutsidePlayerHand();
  const ids = new Set(known.map(c => c.id));
  return makeDeck().filter(c => !ids.has(c.id));
}
function sampleOpponentHands(pool, count, size) {
  const out = [];
  for (let n = 0; n < count; n++) { const shuffled = shuffle(pool); out.push(shuffled.slice(0, Math.min(size, shuffled.length))); }
  return out;
}
function evaluateDonLevel5(candidate, opponentSamples) {
  const { c, o } = candidate;
  const afterCapture = S.table.filter(x => !o.some(y => y.id === x.id));
  const capturedCount = o.length + (o.length ? 1 : 0);
  const clears = o.length > 0 && afterCapture.length === 0;
  const caida = !!(S.lastPlayed && S.lastPlayed.player === 0 && S.lastPlayed.card.value === c.value && o.some(y => y.id === S.lastPlayed.card.id));
  let score = capturedCount * 3.2 + (caida ? 7 : 0) + (clears ? 6 : 0);
  if (caida) score += 2.0;
  if (clears) score += 2.0;
  const tableAfterDon = o.length ? afterCapture : [...afterCapture, c];
  if (!o.length) score -= c.value >= 8 ? 1.5 : c.value >= 6 ? .9 : .35;
  if (o.length) score += Math.max(0, 7 - c.value) * .18;
  const nextDonHand = S.hands[1].filter(x => x.id !== c.id);
  let replyRisk = 0, replyValue = 0, donFollowUp = 0, fallReplies = 0, cleanReplies = 0;
  for (const hand of opponentSamples) {
    let bestOpponent = -Infinity, bestDonAfter = 0, bestFall = false, bestClean = false;
    for (const pc of hand) {
      const options = legalCaptures(pc, tableAfterDon);
      const playerChoices = options.length ? options : [[]];
      for (const take of playerChoices) {
        const playerCaptures = take.length > 0;
        const playerFall = playerCaptures && pc.value === c.value && take.some(x => x.id === c.id);
        const playerClean = playerCaptures && take.length === tableAfterDon.length;
        const playerCaptureCount = playerCaptures ? take.length + 1 : 0;
        const tableAfterPlayer = playerCaptures ? tableAfterDon.filter(x => !take.some(y => y.id === x.id)) : [...tableAfterDon, pc];
        let donBest = 0;
        for (const dc of nextDonHand) {
          const donOptions = legalCaptures(dc, tableAfterPlayer);
          for (const donTake of donOptions) {
            const donFall = donTake.length > 0 && donTake.some(x => x.id === pc.id) && dc.value === pc.value;
            const donClean = donTake.length > 0 && donTake.length === tableAfterPlayer.length;
            const value = (donTake.length + 1) * 1.55 + (donFall ? 5.5 : 0) + (donClean ? 4.5 : 0);
            if (value > donBest) donBest = value;
          }
        }
        const immediate = (playerCaptureCount * 1.75) + (playerFall ? 7 : 0) + (playerClean ? 6 : 0);
        const opponentUtility = immediate - donBest * .34;
        if (opponentUtility > bestOpponent) { bestOpponent = opponentUtility; bestDonAfter = donBest; bestFall = playerFall; bestClean = playerClean; }
      }
    }
    if (bestOpponent > 0) replyRisk++;
    replyValue += Math.max(0, bestOpponent);
    donFollowUp += bestDonAfter;
    if (bestFall) fallReplies++;
    if (bestClean) cleanReplies++;
  }
  const n = Math.max(1, opponentSamples.length);
  const riskRate = replyRisk / n, expectedReply = replyValue / n, expectedDonFollowUp = donFollowUp / n;
  const fallRate = fallReplies / n, cleanRate = cleanReplies / n;
  score -= riskRate * donLearning.riskWeight + expectedReply * .58;
  score -= fallRate * 2.2 + cleanRate * 2.8;
  score -= donRondaExposurePoints(c, o) * 4.5 * fallRate;
  if (caida) score += donRondaFallChanceOnPlayer(c) * 4 * 4.5;
  if (rule38At38(1) && caida) score += 1000;
  if (rule38At38(0)) score -= fallRate * 1000;
  if (falta4DealerPending(1) && o.length) score += 18;
  if (S.falta4 && S.section === 1 && S.dealer === 0 && S.s1Captured && !S.s1Captured[0]) score -= riskRate * 18;
  score += expectedDonFollowUp * .42;
  const unseen = unseenPoolForDon();
  const rankCounts = Object.fromEntries(R.map(r => [r, unseen.filter(x => x.rank === r).length]));
  const playerHandSize = S.hands[0].length;
  const exposedValueRisk = tableAfterDon.reduce((sum, x) => { const copies = rankCounts[x.rank] || 0; return sum + Math.min(1, copies / 4) * (playerHandSize / 5) * .12; }, 0);
  score -= exposedValueRisk;
  const nextValues = new Set(nextDonHand.map(x => x.value));
  const futureFlex = nextDonHand.reduce((sum, x) => sum + (nextValues.has(x.value) ? .12 : .04), 0);
  score += futureFlex;
  return { ...candidate, score };
}
function chooseDonLevel5(candidates) {
  const pool = unseenPoolForDon();
  const samples = sampleOpponentHands(pool, 128, S.hands[0].length);
  const ranked = candidates.map(x => evaluateDonLevel5(x, samples));
  ranked.sort((a, b) => b.score - a.score);
  return ranked[0];
}
function level6ContextScore(candidate) {
  const { c, o } = candidate, tableAfter = o.length ? S.table.filter(x => !o.some(y => y.id === x.id)) : [...S.table, c];
  const takes = o.length > 0, captured = o.length + (takes ? 1 : 0), clean = takes && tableAfter.length === 0;
  const fall = !!(S.lastPlayed && S.lastPlayed.player === 0 && S.lastPlayed.card.value === c.value && o.some(x => x.id === S.lastPlayed.card.id));
  const donAfter = S.captured[1].length + captured, playerCards = S.captured[0].length;
  const donScore = S.score[1] + (fall ? 2 : 0) + (clean ? 2 : 0), playerScore = S.score[0];
  const pool = unseenPoolForDon(), rankLeft = pool.filter(x => x.rank === c.rank).length, handSize = S.hands[0].length;
  let probability = 0;
  if (rankLeft > 0 && handSize > 0 && pool.length >= handSize) { const choose = (n, k) => { if (k < 0 || k > n) return 0; let v = 1; for (let i = 1; i <= k; i++) v = v * (n - i + 1) / i; return v; }; probability = 1 - choose(pool.length - rankLeft, handSize) / choose(pool.length, handSize); }
  let score = captured * 3.4 + (fall ? 8 : 0) + (clean ? 8 : 0);
  if (donScore >= 36) score += takes ? 5 : 0;
  if (donScore >= 38) score += takes ? 10 : 0;
  if (playerScore >= 36) score += takes ? 4 : 0;
  if (playerScore >= 38) score += takes ? 7 : 0;
  const donAfterCount = donAfter, playerCount = playerCards;
  if (donAfterCount >= 18) score += captured * 0.9;
  if (playerCount >= 18) score += takes ? 2 : 0;
  if (S.captured[1].length < 20 && donAfterCount >= 20) score += 7;
  const exposed = tableAfter.reduce((v, x) => v + (pool.filter(y => y.rank === x.rank).length ? 0.5 : 0), 0);
  score -= exposed * probability * 5;
  score -= donRondaExposurePoints(c, o) * 4 * probability;
  if (fall) score += donRondaFallChanceOnPlayer(c) * 4 * 4;
  if (rule38At38(1) && fall) score += 1000;
  if (rule38At38(0) && !takes) score -= probability * 1000;
  if (falta4DealerPending(1) && takes) score += 16;
  if (S.falta4 && S.section === 1 && S.dealer === 0 && S.s1Captured && !S.s1Captured[0] && !takes) score -= probability * 16;
  return { score };
}
function chooseDonLevel6(candidates) {
  const ranked = candidates.map(candidate => ({ ...candidate, l6: level6ContextScore(candidate) }));
  ranked.sort((a, b) => b.l6.score - a.l6.score);
  const topScore = ranked[0].l6.score;
  const tied = ranked.filter(x => Math.abs(x.l6.score - topScore) < 1e-9);
  return tied[Math.floor(Math.random() * tied.length)];
}
// aiTurn del juego, sin la llamada a commit.
function aiChoose(aiLevel) {
  const candidates = [];
  for (const c of S.hands[1]) { const opts = legalCaptures(c, S.table); if (opts.length) { for (const o of opts) candidates.push({ c, o }); } else candidates.push({ c, o: [] }); }
  const level = { 1: 4, 2: 6, 3: 5 }[aiLevel || 1] || 4;
  if (level === 5) return chooseDonLevel5(candidates);
  if (level === 6) return chooseDonLevel6(candidates);
  const ranked = candidates.map(x => {
    const take = x.o.length, clears = take > 0 && S.table.length === take;
    const caida = !!(S.lastPlayed && S.lastPlayed.player === 0 && S.lastPlayed.card.value === x.c.value && x.o.some(y => y.id === S.lastPlayed.card.id));
    const immediate = (caida ? 2 : 0) + (clears ? 2 : 0);
    let score = take * 2 + immediate * 3;
    if (level >= 3 && take) score += Math.max(0, 8 - x.c.value) * 0.22;
    if (level >= 4 && take) score += Math.min(3, x.o.length) * 0.35;
    if (level >= 5) { score += x.o.length ? 1.2 : 0; score -= x.o.length === 0 && S.table.some(t => t.value === x.c.value) ? 1 : 0; }
    return { ...x, score };
  });
  const max = Math.max(...ranked.map(x => x.score));
  const pool = ranked.filter(x => x.score === max);
  return pool[Math.floor(Math.random() * pool.length)];
}

module.exports = {
  choose(view, aiLevel) { S = view; const r = aiChoose(aiLevel); S = null; return r; },
  shouldClaimRonda(view) { S = view; const r = donShouldClaimRonda(); S = null; return r; },
  rondaValueOfHand,
};
