// 점수·제작 시간은 data/results.json 하나에서 온다(페이지에는 같은 내용이 인라인 JSON으로 들어 있다).
// 이 파일은 그 JSON을 그림 그리기 좋은 모양으로 바꾼다. 장면표·메시지·알려진 문제·인용도 모두 results.json에 있다.

export const sum = a => a.reduce((x, y) => x + y, 0);
export const f1 = v => (Math.round(v * 10) / 10).toFixed(1);

/** results.json(J)을 페이지에서 쓰는 모양으로 바꾼다. */
export function fromResults(J) {
  const CRIT = J.criteria.map(c => ({ k: c.key, name: c.name, short: c.short, desc: c.desc }));
  const KEYS = CRIT.map(c => c.k);
  const JUDGES = J.judges.map(j => ({ k: j.key, name: j.name, short: j.short, org: j.org, how: j.tool }));
  const WORKS = Object.fromEntries(J.works.map(w => [w.key, {
    name: w.name, maker: w.maker, title: w.title, theme: w.theme, len: w.lengthSec, parts: w.structure,
    size: w.fileSize, minutes: w.makeMinutes, round: w.firstRound, path: w.path.replace(/index\.html$/, ''),
    message: w.message, player: w.player, scenes: w.scenes.map(x => [x.t, x.name]),
    bug: w.knownIssue ? w.knownIssue.text : '', bugShort: w.knownIssue ? w.knownIssue.short : '',
  }]));
  const QUOTES = J.quotes.map(q => ({ j: q.judge, w: q.work, good: q.kind === 'strength', text: q.text }));
  const ROUNDS = Object.fromEntries(J.rounds.map(r => [r.round, {
    label: `${r.round}라운드`, q: r.question, tags: r.blindTags, works: r.ranking, sources: r.sources,
    judges: Object.fromEntries(Object.entries(r.scores).map(([j, ws]) => [j, Object.fromEntries(Object.entries(ws).map(([w, s]) => [w, KEYS.map(k => s[k])]))])),
    ranks: r.judgeRanking,
  }]));
  const PROCESS = J.process.map(p => ({ w: p.work, label: p.label, total: p.totalApprox, steps: p.steps.map(s => ({ name: s.phase, who: s.by, min: s.minutes, t: s.time, out: s.output })) }));
  const avgCrit = (r, w, i) => { const Jd = ROUNDS[r].judges; const ks = Object.keys(Jd); return sum(ks.map(j => Jd[j][w][i])) / ks.length; };
  const avgTotal = (r, w) => sum(CRIT.map((_, i) => avgCrit(r, w, i)));
  const judgeTotal = (r, j, w) => sum(ROUNDS[r].judges[j][w]);
  // 라운드의 1위 표: { 작품: [채점관 짧은 이름…] } (채점관별 순위의 첫째)
  const firstVotes = r => { const o = {}; Object.entries(ROUNDS[r].ranks).forEach(([j, list]) => { (o[list[0]] = o[list[0]] || []).push(JUDGES.find(x => x.k === j).short); }); return o; };
  const votesText = r => Object.entries(firstVotes(r)).sort((a, b) => b[1].length - a[1].length).map(([w, js]) => `${WORKS[w].name} ${js.length}표(${js.join(' · ')})`).join(', ');
  return { CRIT, JUDGES, WORKS, ROUNDS, PROCESS, QUOTES, avgCrit, avgTotal, judgeTotal, firstVotes, votesText };
}
