from pathlib import Path

path = Path('scripts/finish-live-city-integration.mjs')
s = path.read_text()
start = s.find(" const labels=`  const labels=all.map(place=>{")
end_marker = " s=one(s,labels,labelsNew,'only live ad creative labels');"
end = s.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit('Could not locate temporary labels patch block')
replacement = r''' const labelsPattern=/  const labels=all\.map\(place=>\{.*?\n  \}\);/s;
 const labelsNew=[
  "  const labels=all.flatMap(place=>{",
  "    const ad=Boolean(place.adPlotId),zone=Boolean(place.adZoneId),live=ad?liveAdSpaces.get(place.adPlotId):null;if(ad&&!(live?.available===false&&live.ad))return [];",
  "    const button=document.createElement('button');button.type='button';button.className=`outside-roof-label ${ad||zone?'outside-ad-label':place.venueId?'outside-venue-label':'outside-district-label'}`;",
  "    if(ad&&live.ad?.imageDataUrl){button.classList.add('outside-ad-creative');button.innerHTML=`<img src='${esc(live.ad.imageDataUrl)}' alt='${esc(live.ad.title||'Live advertisement')}'>`;}else button.textContent=zone?`▦ ${place.name}`:place.venueId?`${icons[place.id]||'•'} ${place.name}`:place.name;",
  "    button.setAttribute('aria-label',ad?`${live?.ad?.title||'Live advertisement'}. View campaign`:`${place.name}${place.districtName?`, ${place.districtName}`:''}. View destination`);button.dataset.destinationKey=place.key;labelsRoot.append(button);",
  "    return [{place,button,point:new THREE.Vector3(place.x,ad?9:place.height+20,place.z)}];",
  "  });"
 ].join('\n');
 s=regexOne(s,labelsPattern,labelsNew,'only live ad creative labels');'''
s = s[:start] + replacement + s[end + len(end_marker):]
path.write_text(s)
print('Repaired temporary integration patch quoting and newline emission.')
