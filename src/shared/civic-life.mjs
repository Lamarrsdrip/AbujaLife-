export const CIVIC_META = Object.freeze({
  fictional: true,
  title: 'AbujaLife Presidential Election',
  notice: 'This is a fictional in-game election. It does not represent, endorse or simulate any real candidate, party, result or public authority.',
  cycleDays: 28,
  nominationFee: 25_000_000,
  nominationReputation: 20,
  pollingCheckInMinutes: 20,
});

export const CIVIC_PARTIES = Object.freeze([
  Object.freeze({ id:'capital-forward', name:'Capital Forward Party', short:'CFP', motto:'Build. Work. Move Abuja.' }),
  Object.freeze({ id:'new-abuja', name:'New Abuja Movement', short:'NAM', motto:'A city that works for everybody.' }),
  Object.freeze({ id:'peoples-civic', name:"People's Civic Alliance", short:'PCA', motto:'Community first, city together.' }),
]);

export const CIVIC_PHASES = Object.freeze([
  Object.freeze({ id:'nominations', startDay:0, endDay:5, title:'Party nominations', story:'Buy a fictional party nomination ticket at the INEC HQ game destination and enter the race.' }),
  Object.freeze({ id:'campaign', startDay:5, endDay:13, title:'Campaign season', story:'Hold rallies, meet residents and build public support across Abuja.' }),
  Object.freeze({ id:'debates', startDay:13, endDay:17, title:'Debates & town halls', story:'Candidates meet at the ICC for live debates and public questions.' }),
  Object.freeze({ id:'voting', startDay:17, endDay:20, title:'Voting open', story:'Head outside to your district polling unit, check in and cast one vote.' }),
  Object.freeze({ id:'results', startDay:20, endDay:28, title:'Results & government', story:'The city watches the result, celebrates, protests peacefully and reacts to the new administration.' }),
]);

export const CIVIC_CAMPAIGN_ACTIONS = Object.freeze([
  Object.freeze({ id:'street-canvass', name:'Door-to-door canvass', score:8, heat:0, description:'Meet residents and ask what they want from the city.' }),
  Object.freeze({ id:'eagle-square-rally', name:'Hold an Eagle Square rally', score:24, heat:0, venueId:'eagle-square-hub', description:'A large public rally where other residents can gather around the candidate.' }),
  Object.freeze({ id:'icc-townhall', name:'ICC town hall', score:18, heat:0, venueId:'international-conference-centre', description:'Answer questions in a public multiplayer town hall.' }),
  Object.freeze({ id:'debate-performance', name:'Presidential debate', score:30, heat:0, venueId:'international-conference-centre', phase:'debates', description:'Take part in the cycle debate and earn momentum from participation.' }),
  Object.freeze({ id:'risky-backer', name:'Take a risky backer deal', score:28, heat:28, description:'A fictional shortcut that creates campaign momentum but raises financial-crime scrutiny. No real-world method is depicted.' }),
  Object.freeze({ id:'declare-finances', name:'Publish campaign finances', score:4, heat:-22, venueId:'efcc-hq', description:'Take the transparent route, reduce scrutiny and protect campaign credibility.' }),
]);

const DAY = 86400000;
const EPOCH = Date.parse('2026-10-01T00:00:00+01:00');
export function civicCycle(now=Date.now()) {
  const length=CIVIC_META.cycleDays*DAY,index=Math.floor((now-EPOCH)/length),start=EPOCH+index*length,end=start+length;
  const day=Math.max(0,Math.min(CIVIC_META.cycleDays-1,(now-start)/DAY));
  const phase=CIVIC_PHASES.find(row=>day>=row.startDay&&day<row.endDay)||CIVIC_PHASES.at(-1);
  return Object.freeze({ id:`presidential-${index}`, index, startAt:start, endAt:end, day, phase, nextPhaseAt:start+phase.endDay*DAY });
}

export function civicParty(id){return CIVIC_PARTIES.find(p=>p.id===id)||null;}
export function civicAction(id){return CIVIC_CAMPAIGN_ACTIONS.find(a=>a.id===id)||null;}
