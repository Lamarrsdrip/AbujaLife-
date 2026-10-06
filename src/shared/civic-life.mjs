export const CIVIC_META = Object.freeze({
  fictional:true,
  title:'AbujaLife Presidential Election',
  notice:'Fictional AbujaLife game politics only. Real candidates, parties, results and public authorities are not represented or endorsed.',
  cycleDays:28,
  nominationFee:25_000_000,
  nominationReputation:20,
  nominationCloseDay:9,
  pollingCheckInMinutes:20,
  governmentBudget:1_000_000_000,
  termLimit:2,
  enforcementName:'EFCC storyline',
});

export const CIVIC_PARTIES = Object.freeze([
  Object.freeze({id:'capital-forward',name:'Capital Forward Party',short:'CFP',motto:'Build. Work. Move Abuja.'}),
  Object.freeze({id:'new-abuja',name:'New Abuja Movement',short:'NAM',motto:'A city that works for everybody.'}),
  Object.freeze({id:'peoples-civic',name:"People's Civic Alliance",short:'PCA',motto:'Community first, city together.'}),
]);

export const CIVIC_PHASES = Object.freeze([
  Object.freeze({id:'nominations',startDay:0,endDay:5,title:'Party nominations',story:'Visit the fictional INEC experience, buy a nomination ticket and enter the race.'}),
  Object.freeze({id:'campaign',startDay:5,endDay:13,title:'Campaign season',story:'Campaign across Abuja, hold real multiplayer rallies and build support.'}),
  Object.freeze({id:'debates',startDay:13,endDay:17,title:'Debates & town halls',story:'Candidates meet at ICC Abuja for debates and public questions.'}),
  Object.freeze({id:'voting',startDay:17,endDay:20,title:'Voting open',story:'Return to your home district, head outside and cast one server-authoritative vote.'}),
  Object.freeze({id:'results',startDay:20,endDay:28,title:'Results & government',story:'The elected AbujaLife President gets a finite city budget and the city reacts to every decision.'}),
]);

export const CIVIC_CAMPAIGN_ACTIONS = Object.freeze([
  Object.freeze({id:'street-canvass',name:'Street canvass',score:8,heat:0,requiresPublic:true,description:'Walk your district, meet residents and ask what they want from AbujaLife.'}),
  Object.freeze({id:'eagle-square-rally',name:'Eagle Square rally',score:24,heat:0,venueId:'eagle-square-hub',description:'A large public rally where residents can gather around the candidate.'}),
  Object.freeze({id:'icc-townhall',name:'ICC town hall',score:18,heat:0,venueId:'international-conference-centre',description:'Take public questions in a multiplayer town hall.'}),
  Object.freeze({id:'debate-performance',name:'Presidential debate',score:30,heat:0,venueId:'international-conference-centre',phase:'debates',description:'Take part in the cycle debate and earn momentum from participation.'}),
  Object.freeze({id:'community-project',name:'Community project',score:14,heat:-4,cost:2_500_000,requiresPublic:true,description:'Fund a visible fictional community activity with game Naira and build trust.'}),
  Object.freeze({id:'risky-backer',name:'Accept a risky backer',score:28,heat:28,description:'A deliberately abstract fictional shortcut: more momentum, much more financial-crime scrutiny. No laundering method is depicted.'}),
  Object.freeze({id:'opaque-campaign-spend',name:'Approve opaque campaign spending',score:34,heat:36,cost:5_000_000,description:'A fictional integrity-risk decision with no real-world evasion technique or payment method.'}),
  Object.freeze({id:'declare-finances',name:'Publish campaign finances',score:4,heat:-24,venueId:'efcc-hq',description:'Cooperate with the fictional EFCC storyline, publish the campaign record and reduce scrutiny.'}),
  Object.freeze({id:'court-hearing',name:'Attend court hearing',score:-4,heat:-18,venueId:'federal-high-court-hub',requiresCase:true,description:'Appear for a fictional due-process hearing after an investigation. Outcomes depend on the game integrity record.'}),
]);

export const CIVIC_GOVERNMENT_ACTIONS = Object.freeze([
  Object.freeze({id:'city-cleanup',name:'City clean-up & lighting drive',cost:50_000_000,integrity:5,venueId:'city-gate-plaza',durationHours:24,description:'Fund a city-wide clean-up and public-space lighting event.'}),
  Object.freeze({id:'youth-festival',name:'Abuja youth festival',cost:120_000_000,integrity:4,venueId:'eagle-square-hub',durationHours:24,description:'Open a multiplayer music, games and creator festival at Eagle Square.'}),
  Object.freeze({id:'transport-week',name:'Public transport week',cost:80_000_000,integrity:5,venueId:'city-gate-plaza',durationHours:24,description:'Run a city story event around buses, shared rides and movement.'}),
  Object.freeze({id:'business-summit',name:'Abuja business summit',cost:90_000_000,integrity:3,venueId:'wtc-abuja-hub',durationHours:24,description:'Host a networking and jobs event around the WTC business district.'}),
  Object.freeze({id:'unreviewed-contract',name:'Push an unreviewed contract',cost:160_000_000,integrity:-22,heat:35,venueId:'national-assembly-hub',durationHours:12,description:'A fictional risky government choice that can trigger investigation. No real procurement workaround is depicted.'}),
]);

export const CIVIC_STORY_THRESHOLDS = Object.freeze({review:45,raid:78,detention:100,disqualify:120});

const DAY=86400000;
const EPOCH=Date.parse('2026-10-01T00:00:00+01:00');
export function civicCycle(now=Date.now()){
  const length=CIVIC_META.cycleDays*DAY,index=Math.floor((now-EPOCH)/length),start=EPOCH+index*length,end=start+length;
  const day=Math.max(0,Math.min(CIVIC_META.cycleDays-1,(now-start)/DAY));
  const phase=CIVIC_PHASES.find(row=>day>=row.startDay&&day<row.endDay)||CIVIC_PHASES.at(-1);
  return Object.freeze({id:`presidential-${index}`,index,startAt:start,endAt:end,day,phase,nextPhaseAt:start+phase.endDay*DAY,nominationOpen:day<CIVIC_META.nominationCloseDay});
}
export function civicParty(id){return CIVIC_PARTIES.find(p=>p.id===id)||null;}
export function civicAction(id){return CIVIC_CAMPAIGN_ACTIONS.find(a=>a.id===id)||null;}
export function civicGovernmentAction(id){return CIVIC_GOVERNMENT_ACTIONS.find(a=>a.id===id)||null;}
