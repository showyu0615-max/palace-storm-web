(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ExploreCore = factory();
})(globalThis, function () {
  'use strict';
  const blank = () => ({ clues: [], values: [1,1,1], factors: [], attempts: 0, hints: 0, complete: false, filmSeen: false, talkSeen: false });
  function fresh() { return { version: 2, current: -1, muted: true, levels: Array.from({ length: 12 }, blank) }; }
  function unlocked(s, i) { return Number.isInteger(i) && i >= 0 && i < 12 && (i === 0 || s.levels[i - 1].complete); }
  function enter(s, i) { if (!unlocked(s, i)) return false; s.current = i; return true; }
  function collect(s, i, id, p) {
    if (!unlocked(s, i) || !p.clues.some(c => c.id === id)) return false;
    if (!s.levels[i].clues.includes(id)) s.levels[i].clues.push(id);
    return true;
  }
  function verify(s, i, values, p) {
    if (!unlocked(s, i)) return { correct: false, reason: 'locked' };
    const l = s.levels[i];
    if (!p.clues.every(c => l.clues.includes(c.id))) return { correct: false, reason: 'clues' };
    if (!Array.isArray(values) || values.length !== 3 || values.some((v,n) => v === null || String(v).trim() === '' || !Number.isInteger(Number(v)) || Number(v) < (['prime','supply'].includes(p.mechanic) && n === 1 ? 0 : 1) || Number(v) > (['cut','group','formation','supply'].includes(p.mechanic)&&n>0?500:60))) return { correct: false, reason: 'input' };
    l.values = values.map(Number);
    if (l.complete) return { correct: true, already: true };
    l.attempts++;
    if (!l.values.every((v, n) => v === p.solution[n])) {
      l.hints = Math.min(3, l.hints + 1);
      return { correct: false, reason: 'mismatch' };
    }
    l.complete = true;
    return { correct: true, already: false };
  }
  function evidence(s) { return s.levels.filter(l => l.complete).length; }
  function reputation(s) { return evidence(s) * 10; }
  function restore(raw) {
    try {
      const s = JSON.parse(raw);
      if (!s || s.version !== 2 || !Number.isInteger(s.current) || s.current < -1 || s.current > 11 || typeof s.muted !== 'boolean' || !Array.isArray(s.levels) || s.levels.length !== 12) return null;
      for (let i = 0; i < 12; i++) {
        const l = s.levels[i];
        if (!l || !Array.isArray(l.clues) || l.clues.length > 3 || !l.clues.every(c => typeof c === 'string') || new Set(l.clues).size !== l.clues.length) return null;
        if (!Array.isArray(l.values) || l.values.length !== 3 || l.values.some((v,n) => !Number.isInteger(v) || v < ([2,8].includes(i)&&n===1?0:1) || v > ([3,5,8,9].includes(i)&&n>0?500:60))) return null;
        if(l.factors===undefined)l.factors=[];
        if(!Array.isArray(l.factors)||l.factors.length>20||l.factors.some(v=>![2,3,5,7].includes(v)))return null;
        if (!Number.isInteger(l.attempts) || l.attempts < 0 || !Number.isInteger(l.hints) || l.hints < 0 || l.hints > 3) return null;
        if (['complete','filmSeen','talkSeen'].some(k => typeof l[k] !== 'boolean')) return null;
        if (i > 0 && l.complete && !s.levels[i - 1].complete) return null;
      }
      if (s.current >= 0 && !unlocked(s, s.current)) return null;
      return s;
    } catch { return null; }
  }
  return { fresh, unlocked, enter, collect, verify, evidence, reputation, restore };
});
