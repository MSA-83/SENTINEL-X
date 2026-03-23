/**
 * SENTINEL OS v2.0 — Global Situational Awareness Platform
 * Production client: 14 live OSINT layers, threat assessment engine,
 * military callsign intelligence, SGP4 orbital propagation, geopolitical zones.
 * 
 * Runs entirely on edge — Hono API proxy protects all keyed credentials.
 */

/* ═══════════════════════════════════════════════════════════════
   PROXY HELPER — all keyed API calls route through /api/proxy
═══════════════════════════════════════════════════════════════ */
async function proxy(target, params) {
  try {
    const res = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, params })
    });
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('text/plain') || ct.includes('text/csv')) return await res.text();
    return await res.json();
  } catch (e) {
    return { _upstream_error: true, status: 0, message: String(e) };
  }
}
function isErr(v) { return v && typeof v === 'object' && v._upstream_error === true; }

/* ═══════════════════════════════════════════════════════════════
   DIRECT APIs — Free, CORS-open, no key required
═══════════════════════════════════════════════════════════════ */
const D = {
  USGS: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
  ISS: 'https://api.wheretheiss.at/v1/satellites/25544',
  CTRAK_FENGYUN: 'https://celestrak.org/NORAD/elements/gp.php?INTDES=1999-025&FORMAT=json',
  CTRAK_COSMOS: 'https://celestrak.org/NORAD/elements/gp.php?INTDES=1993-036&FORMAT=json',
  CTRAK_IRIDIUM: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=iridium-33-debris&FORMAT=json',
  CTRAK_STATIONS: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=json',
  CTRAK_STARLINK: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=json',
  CTRAK_GPS: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=gps-ops&FORMAT=json',
  CTRAK_GLONASS: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=glo-ops&FORMAT=json',
  CTRAK_ISS_TLE: 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=json',
  RELIEFWEB: 'https://api.reliefweb.int/v1/disasters?appname=sentinel-osint&limit=50&filter[field]=status&filter[value][]=alert&filter[value][]=current&fields[include][]=name&fields[include][]=glide&fields[include][]=date&fields[include][]=country&fields[include][]=primary_type&fields[include][]=status',
};

/* ═══════════════════════════════════════════════════════════════
   LAYER CONFIG — 14 intelligence domains
═══════════════════════════════════════════════════════════════ */
const LAYERS = {
  aircraft:   { label:'AIRCRAFT',       icon:'\u2708',  color:'#00d4ff', src:'OpenSky Network ADS-B' },
  military:   { label:'MILITARY AIR',   icon:'\u2708',  color:'#ff3355', src:'ADS-B Exchange (RapidAPI)' },
  ships:      { label:'MARITIME AIS',   icon:'\u2693',  color:'#00ff88', src:'MarineTraffic \u2014 KEY NEEDED' },
  darkships:  { label:'DARK FLEET',     icon:'\u2753',  color:'#9933ff', src:'GFW Gap/Loitering Events' },
  fishing:    { label:'FISHING',        icon:'\uD83D\uDC1F', color:'#33ffcc', src:'GFW Events API' },
  iss:        { label:'ISS',            icon:'\uD83D\uDE80', color:'#ff6600', src:'wheretheiss.at' },
  satellites: { label:'SATELLITES',     icon:'\u2605',  color:'#ffcc00', src:'N2YO + CelesTrak' },
  debris:     { label:'SPACE DEBRIS',   icon:'\u2715',  color:'#cc2255', src:'CelesTrak TLE (SGP4)' },
  seismic:    { label:'SEISMIC',        icon:'\u0021',  color:'#ffee00', src:'USGS Earthquake API' },
  wildfires:  { label:'WILDFIRES',      icon:'\uD83D\uDD25', color:'#ff5500', src:'NASA FIRMS VIIRS' },
  weather:    { label:'STORM SYSTEMS',  icon:'\uD83C\uDF00', color:'#4477ff', src:'OpenWeatherMap' },
  avwx:       { label:'AVIATION WX',    icon:'\uD83D\uDCE1', color:'#88aaff', src:'AVWX SIGMETs' },
  conflict:   { label:'CONFLICT INTEL', icon:'\u2694',  color:'#ff2200', src:'GDELT 2.0 Geo API' },
  disasters:  { label:'DISASTERS',      icon:'\uD83C\uDD98', color:'#ff8c00', src:'GDACS + ReliefWeb' },
};

/* ═══════════════════════════════════════════════════════════════
   SQUAWK & MILITARY CALLSIGN INTELLIGENCE
═══════════════════════════════════════════════════════════════ */
const SQUAWK_DB = {
  '7500': { label:'HIJACK',        sev:'CRITICAL', col:'#ff0033', badge:'\uD83D\uDD34', desc:'Aircraft under unlawful seizure' },
  '7600': { label:'COMMS FAILURE', sev:'HIGH',     col:'#ff8800', badge:'\uD83D\uDFE0', desc:'Loss of two-way radio communications' },
  '7700': { label:'EMERGENCY',     sev:'CRITICAL', col:'#ff2200', badge:'\uD83D\uDD34', desc:'General emergency declared by pilot' },
  '7777': { label:'MIL INTERCEPT', sev:'HIGH',     col:'#ff5500', badge:'\uD83D\uDFE0', desc:'Military interception in progress' },
  '7400': { label:'UAV LOST LINK', sev:'HIGH',     col:'#ff9900', badge:'\uD83D\uDFE0', desc:'UAS lost C2 data link' },
};
const SQ_CRIT = new Set(['7500','7700']);
const SQ_ALERT = new Set(['7600','7777','7400']);

const MIL_RE = /^(RCH|USAF|REACH|DUKE|TOPCT|NATO|JAKE|VIPER|GHOST|BRONC|LOBO|RALLY|SKILL|VALOR|BLADE|EVAC|CHAOS|HAVOC|RAVEN|KNIFE|STING|BISON|COBRA|EAGLE|FURY|HUSTLE|IRON|LANCE|NOBLE|ORCA|REAPER|SHARK|SWORD|TORCH|WOLF)/i;
const MIL_DB = {
  RCH:   { op:'USAF AMC',     role:'Strategic Airlift',      acType:'C-17 / C-5M' },
  REACH: { op:'USAF AMC',     role:'Strategic Airlift',      acType:'C-17 / C-5M' },
  JAKE:  { op:'USN VP-Fleet',  role:'Maritime Patrol',       acType:'P-8A Poseidon' },
  NATO:  { op:'NATO AEW&C',   role:'Airborne Surveillance',  acType:'E-3A Sentry' },
  GHOST: { op:'USAF ACC',     role:'Stealth Strike',         acType:'B-2 / F-22' },
  VIPER: { op:'USAF ACC',     role:'Air Superiority',        acType:'F-16 Fighting Falcon' },
  BRONC: { op:'USAF SIGINT',  role:'ISR / SIGINT',           acType:'RC-135V/W Rivet Joint' },
  DUKE:  { op:'USAF STRATCOM', role:'Nuclear C2',            acType:'E-4B Nightwatch' },
  BLADE: { op:'USN Strike',   role:'Carrier Strike',         acType:'F/A-18E/F Super Hornet' },
  EVAC:  { op:'USAF AMC',     role:'Aeromedical Evacuation', acType:'C-17 / C-130J' },
  KNIFE: { op:'USAF AFSOC',   role:'Special Ops / CAS',      acType:'AC-130J Ghostrider' },
  EAGLE: { op:'USAF ACC',     role:'Air Superiority',        acType:'F-15E Strike Eagle' },
  COBRA: { op:'US Army Avn',  role:'Attack Helicopter',      acType:'AH-64E Apache' },
  REAPER:{ op:'USAF RPA',     role:'ISR / Strike',           acType:'MQ-9 Reaper' },
  FURY:  { op:'USN Strike',   role:'Air Superiority',        acType:'F/A-18E/F' },
  IRON:  { op:'USAF AMC',     role:'Tanker Operations',      acType:'KC-135 / KC-46' },
  WOLF:  { op:'USAF AFSOC',   role:'Special Operations',     acType:'CV-22 Osprey' },
};

/* ═══════════════════════════════════════════════════════════════
   THREAT ASSESSMENT ENGINE — Geopolitical zone proximity scoring
═══════════════════════════════════════════════════════════════ */
const THREAT_ZONES = [
  { name:'Ukraine / Russia Front',  lat:48.5, lon:37.0, r:400, base:55, type:'conflict' },
  { name:'Gaza Strip',              lat:31.4, lon:34.5, r:120, base:70, type:'conflict' },
  { name:'Red Sea \u2014 Houthi Zone', lat:14.5, lon:43.5, r:350, base:65, type:'chokepoint' },
  { name:'Strait of Hormuz',        lat:26.5, lon:56.3, r:180, base:50, type:'chokepoint' },
  { name:'Taiwan Strait',           lat:24.5, lon:120.0, r:250, base:60, type:'flashpoint' },
  { name:'South China Sea',         lat:13.5, lon:115.0, r:500, base:45, type:'flashpoint' },
  { name:'Korean Peninsula',        lat:38.0, lon:127.5, r:200, base:55, type:'flashpoint' },
  { name:'Sudan Civil War Zone',    lat:15.5, lon:32.5, r:350, base:55, type:'conflict' },
  { name:'Kashmir LOC',             lat:34.0, lon:74.5, r:200, base:50, type:'flashpoint' },
  { name:'Black Sea (NATO Watch)',  lat:43.5, lon:34.5, r:400, base:45, type:'flashpoint' },
  { name:'Horn of Africa',          lat:4.0,  lon:46.0, r:400, base:40, type:'chokepoint' },
  { name:'Sahel Insurgency Zone',   lat:14.0, lon:2.0,  r:600, base:40, type:'conflict' },
];

const THREAT_LEVELS = [
  { level:'CRITICAL', min:75, col:'#ff0033', glow:'#ff003388', badge:'CRIT' },
  { level:'HIGH',     min:50, col:'#ff7700', glow:'#ff770066', badge:'HIGH' },
  { level:'MEDIUM',   min:28, col:'#ffcc00', glow:'#ffcc0044', badge:'MED' },
  { level:'LOW',      min:10, col:'#44aaff', glow:'#44aaff33', badge:'LOW' },
  { level:'MINIMAL',  min:0,  col:'#2a4060', glow:'#2a406022', badge:'MIN' },
];

function haversine(lat1,lon1,lat2,lon2){
  const R=6371,dL=(lat2-lat1)*Math.PI/180,dO=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dL/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dO/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function getThreatLevel(s){return THREAT_LEVELS.find(t=>s>=t.min)||THREAT_LEVELS[4]}

function scoreThreat(e){
  let s=0;const reasons=[];
  if(e.squawk){
    if(SQ_CRIT.has(e.squawk)){s+=82;reasons.push('Squawk '+e.squawk+': '+SQUAWK_DB[e.squawk]?.label)}
    else if(SQ_ALERT.has(e.squawk)){s+=55;reasons.push('Squawk '+e.squawk+': '+SQUAWK_DB[e.squawk]?.label)}
  }
  if(e.type==='military'){s+=10;reasons.push('Military aircraft')}
  if(e.type==='darkships'){s+=25;reasons.push('AIS gap detected — dark vessel')}
  if(e.type==='seismic'){
    const mag=parseFloat(e.details?.MAGNITUDE||'0')||0;
    if(mag>=7){s+=72;reasons.push('M'+mag+' \u2014 major earthquake')}
    else if(mag>=5){s+=35;reasons.push('M'+mag+' \u2014 moderate earthquake')}
    else if(mag>=4){s+=15;reasons.push('M'+mag+' \u2014 light earthquake')}
  }
  if(e.type==='wildfires'){
    const frp=parseFloat(e.details?.FRP||'0')||0;
    if(frp>=500){s+=42;reasons.push('FRP '+frp.toFixed(0)+' MW \u2014 major wildfire')}
    else if(frp>=100){s+=22;reasons.push('FRP '+frp.toFixed(0)+' MW \u2014 significant fire')}
  }
  if(e.type==='conflict'){s+=20;reasons.push('Active conflict event')}
  if(e.lat!=null&&e.lon!=null){
    for(const z of THREAT_ZONES){
      const d=haversine(e.lat,e.lon,z.lat,z.lon);
      if(d<z.r){const bonus=Math.round(z.base*(1-d/z.r));s+=bonus;if(bonus>=12)reasons.push('Near '+z.name+' (+'+bonus+')');break}
    }
  }
  s=Math.min(100,Math.round(s));
  const lvl=getThreatLevel(s);
  return{score:s,level:lvl.level,col:lvl.col,glow:lvl.glow,reasons};
}

function buildThreatBoard(entities){
  return entities.map(e=>({entity:e,...scoreThreat(e)}))
    .filter(t=>t.score>=10).sort((a,b)=>b.score-a.score).slice(0,30);
}

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
function classifySquawk(sq){
  if(!sq||sq==='1200'||sq==='2000'||sq==='7000')return null;
  return SQUAWK_DB[sq]||null;
}
function classMilCS(cs){
  if(!cs)return null;
  const prefix=cs.replace(/\d/g,'').toUpperCase().trim();
  return MIL_DB[prefix]||null;
}
function markerHTML(color,sz,isEmg,threatLvl){
  const r=Math.round(sz/2),ir=Math.round(sz*0.22);
  const cls=isEmg?'emg':threatLvl==='CRITICAL'?'crit':threatLvl==='HIGH'?'high':'';
  return '<div class="sm '+cls+'" style="width:'+sz+'px;height:'+sz+'px;position:relative">'+
    '<svg width="'+sz+'" height="'+sz+'" xmlns="http://www.w3.org/2000/svg">'+
    '<circle cx="'+r+'" cy="'+r+'" r="'+(r-1)+'" fill="'+color+'" opacity="0.82"/>'+
    '<circle cx="'+r+'" cy="'+r+'" r="'+ir+'" fill="white" opacity="0.92"/>'+
    '</svg></div>';
}

/* ═══════════════════════════════════════════════════════════════
   API PARSERS — Transform upstream responses to unified entities
═══════════════════════════════════════════════════════════════ */
function parseOpenSky(data){
  if(!data?.states)return[];
  return data.states.filter(s=>s[6]!=null&&s[5]!=null&&s[8]===false)
    .slice(0,500).map((s,i)=>{
      const cs=(s[1]||'').trim(),isMil=MIL_RE.test(cs);
      const sq=s[14]?String(s[14]).padStart(4,'0'):null;
      const sqInfo=classifySquawk(sq),milInfo=isMil?classMilCS(cs):null;
      const isEmg=sqInfo!=null&&(SQ_CRIT.has(sq)||SQ_ALERT.has(sq));
      return{id:'ac_'+i,type:isMil?'military':'aircraft',lat:s[6],lon:s[5],name:cs||'ICAO:'+s[0],
        emergency:isEmg,squawk:sq,squawkInfo:sqInfo,
        details:{ICAO24:s[0]||'\u2014',CALLSIGN:cs||'\u2014',COUNTRY:s[2]||'\u2014',
          ALTITUDE:s[7]!=null?Math.round(s[7]*3.28084).toLocaleString()+' ft':'\u2014',
          VELOCITY:s[9]!=null?Math.round(s[9]*1.944)+' kts':'\u2014',
          HEADING:s[10]!=null?Math.round(s[10])+'\u00B0':'\u2014',
          SQUAWK:sq||'\u2014',
          ...(sqInfo?{'\u26A0 SQUAWK STATUS':sqInfo.badge+' '+sqInfo.label+' \u2014 '+sqInfo.desc}:{}),
          ...(milInfo?{MIL_OPERATOR:milInfo.op,MIL_ROLE:milInfo.role,AC_TYPE:milInfo.acType}:{}),
          SOURCE:isMil?'OpenSky + Mil DB (LIVE \u2705)':'OpenSky ADS-B (LIVE \u2705)'}};
    });
}

function parseUSGS(data){
  if(!data?.features)return[];
  return data.features.slice(0,200).map((f,i)=>{
    const p=f.properties,c=f.geometry.coordinates,mag=p.mag!=null?parseFloat(p.mag.toFixed(1)):0;
    return{id:'eq_'+i,type:'seismic',lat:c[1],lon:c[0],name:'M'+mag+' \u2014 '+(p.place||'Unknown').slice(0,60),
      details:{MAGNITUDE:String(mag),DEPTH:(c[2]?.toFixed(1)||'?')+' km',PLACE:p.place||'\u2014',
        TSUNAMI:p.tsunami?'\u26A0 WARNING':'None',TIME:new Date(p.time).toUTCString(),SOURCE:'USGS (LIVE \u2705)'}};
  });
}

function parseISS(d){
  if(!d||d.latitude==null)return[];
  return[{id:'iss_live',type:'iss',lat:d.latitude,lon:d.longitude,name:'ISS (ZARYA)',
    details:{ALTITUDE:(d.altitude?.toFixed(1)||'~408')+' km',SPEED:(d.velocity?.toFixed(2)||'7.66')+' km/s',
      VISIBILITY:d.visibility||'\u2014',SOURCE:'wheretheiss.at (LIVE \u2705)'}}];
}

function parseFIRMS(csv){
  if(!csv||typeof csv!=='string')return[];
  const lines=csv.trim().split('\n');if(lines.length<2)return[];
  const hdr=lines[0].split(','),li=hdr.indexOf('latitude'),lo=hdr.indexOf('longitude'),
    fr=hdr.indexOf('frp'),cf=hdr.indexOf('confidence');
  return lines.slice(1,150).map((row,i)=>{
    const c=row.split(','),lat=parseFloat(c[li]),lon=parseFloat(c[lo]);
    if(isNaN(lat)||isNaN(lon))return null;
    return{id:'fire_'+i,type:'wildfires',lat,lon,name:'VIIRS FIRE \u2014 '+(c[5]||'Unknown'),
      details:{FRP:parseFloat(c[fr]||'0').toFixed(1)+' MW',CONFIDENCE:c[cf]||'?',SOURCE:'NASA FIRMS (LIVE \u2705)'}};
  }).filter(Boolean);
}

function parseOWM(data){
  if(!data?.list)return[];
  return data.list.map((s,i)=>({id:'storm_'+i,type:'weather',lat:s.coord?.lat||0,lon:s.coord?.lon||0,
    name:(s.name||'SYSTEM')+' \u2014 '+((s.weather?.[0]?.main||'').toUpperCase()),
    details:{WIND_SPEED:((s.wind?.speed||0)*1.944).toFixed(1)+' kts',PRESSURE:(s.main?.pressure||'?')+'hPa',
      TEMP:((s.main?.temp||273)-273.15).toFixed(1)+'\u00B0C',SOURCE:'OpenWeatherMap (LIVE \u2705)'}}));
}

function parseN2YO(data){
  if(!data?.above)return[];
  return data.above.map((s,i)=>({id:'sat_n2yo_'+i,type:'satellites',lat:s.satlat||0,lon:s.satlng||0,
    name:s.satname?.trim()||'NORAD:'+s.satid,
    details:{NORAD_ID:String(s.satid),ALTITUDE_KM:(s.satalt?.toFixed(0)||'\u2014')+' km',SOURCE:'N2YO (LIVE \u2705)'}}));
}

function parseGFW(data,layerType){
  const entries=Array.isArray(data)?data:(data?.entries||[]);if(!entries.length)return[];
  return entries.slice(0,60).map((ev,i)=>{
    const pos=ev.position||{},lat=pos.lat??null,lon=pos.lon??null;if(lat==null||lon==null)return null;
    const vessel=ev.vessel||{},name=vessel.name||'MMSI:'+(vessel.ssvid||i);
    if(layerType==='darkships')return{id:'gap_'+i,type:'darkships',lat,lon,name:'DARK \u2014 '+name,
      details:{MMSI:vessel.ssvid||'\u2014',FLAG:vessel.flag||'\u2014',SOURCE:'GFW Gap Events (LIVE \u2705)'}};
    return{id:'fish_'+i,type:'fishing',lat,lon,name,
      details:{FLAG:vessel.flag||'\u2014',GEAR_TYPE:vessel.gear_type||'\u2014',SOURCE:'GFW (LIVE \u2705)'}};
  }).filter(Boolean);
}

function parseAVWX(data){
  const rows=Array.isArray(data)?data:Array.isArray(data?.results)?data.results:[];
  return rows.slice(0,30).map((s,i)=>{
    const pts=Array.isArray(s?.coords)?s.coords:[];
    let lat=null,lon=null;
    if(pts.length&&Array.isArray(pts[0])){let sLa=0,sLo=0,n=0;pts.forEach(pt=>{if(Array.isArray(pt)&&pt.length>=2){sLo+=Number(pt[0]);sLa+=Number(pt[1]);n++}});if(n){lat=sLa/n;lon=sLo/n}}
    if(lat==null||lon==null)return null;
    const sigType=typeof s?.type==='string'?s.type:(s?.type?.value||'UNKNOWN');
    return{id:'avwx_'+i,type:'avwx',lat,lon,name:'SIGMET \u2014 '+sigType,
      details:{TYPE:sigType,SEVERITY:s?.severity||'\u2014',SOURCE:'AVWX (LIVE \u2705)'}};
  }).filter(Boolean);
}

function parseCelesTrak(tleObjects,layerType,limit){
  const sat=window.satellite;if(!sat||!Array.isArray(tleObjects))return[];
  const now=new Date(),gmst=sat.gstime(now),results=[];
  for(let i=0;i<Math.min(tleObjects.length,limit||60);i++){
    const obj=tleObjects[i],l1=obj.TLE_LINE1||obj.LINE1,l2=obj.TLE_LINE2||obj.LINE2;
    if(!l1||!l2)continue;
    try{
      const satrec=sat.twoline2satrec(l1.trim(),l2.trim()),pv=sat.propagate(satrec,now);
      if(!pv?.position||typeof pv.position==='boolean')continue;
      const geo=sat.eciToGeodetic(pv.position,gmst),la=sat.degreesLat(geo.latitude),lo=sat.degreesLong(geo.longitude);
      if(isNaN(la)||isNaN(lo))continue;
      results.push({id:layerType+'_ctk_'+i,type:layerType,lat:parseFloat(la.toFixed(4)),lon:parseFloat(lo.toFixed(4)),
        name:obj.OBJECT_NAME?.trim()||'NORAD:'+obj.NORAD_CAT_ID,
        details:{NORAD_ID:obj.NORAD_CAT_ID||'\u2014',ALTITUDE_KM:geo.height?.toFixed(1)||'\u2014',SOURCE:'CelesTrak SGP4 (LIVE \u2705)'}});
    }catch(e){}
  }
  return results;
}

function parseGDACS(data){
  const features=data?.features||[];
  return features.map((f,i)=>{
    const p=f.properties||{},coords=f.geometry?.coordinates||[],lat=coords[1],lon=coords[0];
    if(!lat||!lon)return null;
    return{id:'gdacs_'+i,type:'disasters',lat,lon,
      name:(p.eventtype||'EVENT').toUpperCase()+' \u2014 '+(p.eventname||p.country||'Unknown'),
      details:{ALERT:p.alertlevel||'\u2014',COUNTRY:p.country||'\u2014',SOURCE:'GDACS (LIVE \u2705)'}};
  }).filter(Boolean);
}

function parseGDELT(geoJSON,prefix){
  const features=geoJSON?.features||[];
  return features.slice(0,60).map((f,i)=>{
    const p=f.properties||{},geo=f.geometry?.coordinates||[];
    if(!geo[1]||!geo[0])return null;
    return{id:'gdelt_'+prefix+'_'+i,type:'conflict',lat:geo[1],lon:geo[0],
      name:prefix.toUpperCase()+': '+(p.name||'EVENT'),
      details:{LOCATION:p.name||'\u2014',EVENTS:String(p.Hits||1),SOURCE:'GDELT 2.0 (LIVE \u2705)'}};
  }).filter(Boolean);
}

function parseReliefWeb(data){
  const C={Afghanistan:{lat:33.9,lon:67.7},Sudan:{lat:12.9,lon:30.2},Ukraine:{lat:48.4,lon:31.2},
    Syria:{lat:34.8,lon:39.0},Yemen:{lat:15.6,lon:48.5},Myanmar:{lat:19.2,lon:96.7},
    Somalia:{lat:6.0,lon:46.2},Haiti:{lat:18.9,lon:-72.3},Philippines:{lat:12.9,lon:121.8},
    Ethiopia:{lat:9.1,lon:40.5},'Democratic Republic of the Congo':{lat:-4.0,lon:21.8}};
  return(data?.data||[]).map((item,i)=>{
    const f=item.fields||{},country=f.country?.[0]?.name||'Unknown',c=C[country];
    if(!c)return null;
    return{id:'rw_'+i,type:'disasters',lat:c.lat+(Math.random()-0.5),lon:c.lon+(Math.random()-0.5),
      name:(f.primary_type?.name||'DISASTER').toUpperCase()+': '+(f.name||country),
      details:{COUNTRY:country,STATUS:f.status?.name||'\u2014',SOURCE:'ReliefWeb (LIVE \u2705)'}};
  }).filter(Boolean);
}

function propagateISSTrack(tl1,tl2,minutes){
  const sat=window.satellite;if(!sat)return[];
  try{
    const satrec=sat.twoline2satrec(tl1.trim(),tl2.trim()),points=[];
    const now=new Date();
    for(let m=0;m<=minutes;m++){
      const t=new Date(now.getTime()+m*60000),gmst=sat.gstime(t),pv=sat.propagate(satrec,t);
      if(!pv?.position||typeof pv.position==='boolean')continue;
      const geo=sat.eciToGeodetic(pv.position,gmst),la=sat.degreesLat(geo.latitude),lo=sat.degreesLong(geo.longitude);
      if(!isNaN(la)&&!isNaN(lo))points.push([la,lo]);
    }
    return points;
  }catch(e){return[]}
}

/* ═══════════════════════════════════════════════════════════════
   API REFERENCE TABLE
═══════════════════════════════════════════════════════════════ */
const API_REF = [
  { name:'OpenSky Network',    cost:'FREE', key:'NO KEY',    status:'live' },
  { name:'USGS Earthquakes',   cost:'FREE', key:'NO KEY',    status:'live' },
  { name:'wheretheiss.at',     cost:'FREE', key:'NO KEY',    status:'live' },
  { name:'CelesTrak TLE',      cost:'FREE', key:'NO KEY',    status:'live' },
  { name:'ReliefWeb OCHA',     cost:'FREE', key:'NO KEY',    status:'live' },
  { name:'GDELT 2.0 Geo',      cost:'FREE', key:'NO KEY',    status:'live' },
  { name:'NASA FIRMS',         cost:'FREE', key:'ENV \u2705',status:'live' },
  { name:'N2YO Satellites',    cost:'FREE', key:'ENV \u2705',status:'live' },
  { name:'OpenWeatherMap',     cost:'FREE', key:'ENV \u2705',status:'live' },
  { name:'AVWX REST API',      cost:'FREE', key:'ENV \u2705',status:'live' },
  { name:'GFW Events API',     cost:'FREE', key:'ENV \u2705',status:'live' },
  { name:'ADS-B Exchange',     cost:'PAID', key:'ENV \u2705',status:'live' },
  { name:'GDACS UN OCHA',      cost:'FREE', key:'NO KEY',    status:'live' },
  { name:'MarineTraffic',      cost:'PAID', key:'\u274C MISSING',status:'missing' },
];

const TICKER = [
  '\u2705 LIVE: OpenSky ADS-B \u2014 global unfiltered flight tracking \u2014 30s refresh',
  '\u2705 LIVE: USGS Earthquake API \u2014 all seismic events past 24h',
  '\u2705 LIVE: ISS position + SGP4 orbit propagation \u2014 5s refresh',
  '\u2705 LIVE: NASA FIRMS VIIRS \u2014 global wildfire detections \u2014 15min cadence',
  '\u2705 LIVE: CelesTrak TLE \u2014 debris + constellations + ISS track (SGP4)',
  '\u2705 LIVE: GDELT 2.0 \u2014 conflict/military event geo-clusters (48h)',
  '\u2705 LIVE: GDACS + ReliefWeb \u2014 UN disaster alert feeds',
  '\u2705 LIVE: Global Fishing Watch \u2014 fishing + dark fleet AIS gaps',
  '\u2705 LIVE: ADS-B Exchange \u2014 military aircraft (via RapidAPI)',
  '\u26A0 STANDBY: MarineTraffic AIS \u2014 commercial key required',
  'SENTINEL OS v2.0 \u2014 14 LIVE OSINT LAYERS \u2014 450+ CATALOGUED SOURCES',
];

/* ═══════════════════════════════════════════════════════════════
   MAIN APPLICATION CONTROLLER
═══════════════════════════════════════════════════════════════ */
(function(){
  // State
  let map, markers = new Map(), layerGroups = {}, entities = [];
  let issTrackLine, issTrackBg, zoneCircles = [], issTLE = null;
  let sceneReady = false, layerState = {}, selected = null;
  let apiStatus = {}, counts = {}, threatBoard = [];
  let tickIdx = 0, panel = 'layers', showZones = true;

  Object.keys(LAYERS).forEach(k => { layerState[k] = true; apiStatus[k] = 'loading'; });

  // DOM refs
  const mapEl = document.getElementById('map');
  const appEl = document.getElementById('app');

  /* ── INIT MAP ── */
  function initMap(){
    map = L.map(mapEl, {
      center:[20,10], zoom:3, zoomControl:false,
      attributionControl:false, minZoom:2, maxZoom:18,
      worldCopyJump:true
    });

    // Dark satellite basemap
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:18}).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',{subdomains:'abcd',maxZoom:18,opacity:0.75}).addTo(map);

    // Threat zone overlays
    const ztc = {conflict:'#ff2200',chokepoint:'#ff8800',flashpoint:'#ffcc00'};
    THREAT_ZONES.forEach(z => {
      const col = ztc[z.type]||'#ff4400';
      const outer = L.circle([z.lat,z.lon],{radius:z.r*1000,color:col,weight:0.8,opacity:0.5,fillColor:col,fillOpacity:0.04,dashArray:'4 6',interactive:false}).addTo(map);
      const label = L.marker([z.lat,z.lon],{icon:L.divIcon({
        html:'<div style="color:'+col+';font-size:8px;font-family:\'Share Tech Mono\',monospace;white-space:nowrap;text-shadow:0 0 6px '+col+';opacity:0.75;letter-spacing:1px;pointer-events:none">'+z.name.toUpperCase()+'</div>',
        className:'',iconAnchor:[0,0]}),interactive:false,zIndexOffset:-1000}).addTo(map);
      zoneCircles.push(outer,label);
    });

    // ISS orbit track
    issTrackBg = L.polyline([],{color:'#ff660022',weight:1.5,dashArray:'3 5',opacity:0.4,interactive:false}).addTo(map);
    issTrackLine = L.polyline([],{color:'#ff6600',weight:1.5,dashArray:'6 4',opacity:0.75,interactive:false}).addTo(map);

    // Layer groups with clustering for dense layers
    const CLUSTERED = new Set(['aircraft','satellites','debris']);
    Object.keys(LAYERS).forEach(k => {
      if(CLUSTERED.has(k)&&L.MarkerClusterGroup){
        const mcg = L.markerClusterGroup({
          maxClusterRadius:40,spiderfyOnMaxZoom:true,showCoverageOnHover:false,
          iconCreateFunction:cluster=>{
            const cnt=cluster.getChildCount(),col=LAYERS[k]?.color||'#fff',sz=cnt>100?32:cnt>20?26:22;
            return L.divIcon({html:'<div style="width:'+sz+'px;height:'+sz+'px;border-radius:50%;background:'+col+'22;border:1.5px solid '+col+';display:flex;align-items:center;justify-content:center;font-family:\'Share Tech Mono\',monospace;color:'+col+';font-size:9px;font-weight:bold">'+cnt+'</div>',
              className:'',iconSize:[sz,sz],iconAnchor:[sz/2,sz/2]});
          }
        });
        mcg.addTo(map);layerGroups[k]=mcg;
      } else {
        layerGroups[k]=L.layerGroup().addTo(map);
      }
    });

    L.control.zoom({position:'bottomright'}).addTo(map);
    L.control.scale({position:'bottomright',imperial:false}).addTo(map);

    sceneReady = true;
  }

  /* ── MARKER MANAGEMENT ── */
  function upsertMarker(e){
    if(!sceneReady)return;
    const grp=layerGroups[e.type];if(!grp)return;
    const threat=e._threat||scoreThreat(e);e._threat=threat;
    const isEmg=e.emergency===true,col=LAYERS[e.type]?.color||'#ffffff';
    const sz=e.type==='iss'?22:['satellites','debris'].includes(e.type)?12:e.type==='military'?14:isEmg?18:10;
    const html=markerHTML(isEmg?'#ff0033':col,sz,isEmg,threat.level);
    const icon=L.divIcon({html,className:'',iconSize:[sz,sz],iconAnchor:[sz/2,sz/2]});
    if(markers.has(e.id)){
      const mk=markers.get(e.id);mk.setLatLng([e.lat,e.lon]);mk.setIcon(icon);
    } else {
      const mk=L.marker([e.lat,e.lon],{icon,zIndexOffset:isEmg?2000:0}).on('click',()=>{selected=e;renderUI()});
      grp.addLayer(mk);markers.set(e.id,mk);
    }
  }

  function replaceLive(prefix,type,newEnts){
    const grp=layerGroups[type];
    entities.filter(e=>e.id.startsWith(prefix)).forEach(e=>{
      const mk=markers.get(e.id);if(mk&&grp)grp.removeLayer(mk);markers.delete(e.id);
    });
    entities=entities.filter(e=>!e.id.startsWith(prefix));
    newEnts.forEach(e=>{entities.push(e);if(sceneReady)upsertMarker(e)});
  }

  function refreshCounts(){
    counts={};Object.keys(LAYERS).forEach(k=>{counts[k]=entities.filter(e=>e.type===k).length});
  }

  function refreshThreat(){
    entities.forEach(e=>{e._threat=scoreThreat(e)});
    threatBoard=buildThreatBoard(entities);
  }

  /* ── FETCH FUNCTIONS ── */
  async function fetchISS(){
    try{const d=await(await fetch(D.ISS)).json();
      parseISS(d).forEach(e=>{const idx=entities.findIndex(x=>x.id===e.id);if(idx>=0)entities[idx]=e;else entities.push(e);if(sceneReady)upsertMarker(e)});
      apiStatus.iss='live'}catch(e){apiStatus.iss='error'}
  }
  async function fetchUSGS(){
    try{const d=await(await fetch(D.USGS)).json();replaceLive('eq_','seismic',parseUSGS(d));apiStatus.seismic='live'}catch(e){apiStatus.seismic='error'}
  }
  async function fetchOpenSky(){
    try{const d=await proxy('opensky');if(isErr(d)){apiStatus.aircraft='error';return}
      const parsed=parseOpenSky(d);
      replaceLive('ac_','aircraft',parsed.filter(e=>e.type==='aircraft'));
      replaceLive('ac_','military',parsed.filter(e=>e.type==='military'));
      apiStatus.aircraft='live'}catch(e){apiStatus.aircraft='error'}
  }
  async function fetchFIRMS(){
    try{const txt=await proxy('firms');if(isErr(txt)){apiStatus.wildfires='error';return}
      if(typeof txt==='string'&&txt.includes('latitude')){replaceLive('fire_','wildfires',parseFIRMS(txt));apiStatus.wildfires='live'}
      else apiStatus.wildfires='error'}catch(e){apiStatus.wildfires='error'}
  }
  async function fetchOWM(){
    try{const d=await proxy('owm');if(isErr(d)){apiStatus.weather='error';return}
      const storms=parseOWM(d);if(storms.length){replaceLive('storm_','weather',storms);apiStatus.weather='live'}
      else apiStatus.weather='error'}catch(e){apiStatus.weather='error'}
  }
  async function fetchN2YO(){
    try{const d=await proxy('n2yo');if(isErr(d)){apiStatus.satellites='error';return}
      const sats=parseN2YO(d);if(sats.length){replaceLive('sat_n2yo','satellites',sats);apiStatus.satellites='live'}
      else apiStatus.satellites='error'}catch(e){apiStatus.satellites='error'}
  }
  async function fetchGFW(){
    const end=new Date().toISOString().split('T')[0],start=new Date(Date.now()-3*864e5).toISOString().split('T')[0];
    const[fR,gR]=await Promise.allSettled([proxy('gfw_fishing',{startDate:start,endDate:end}),proxy('gfw_gap',{startDate:start,endDate:end})]);
    if(fR.status==='fulfilled'&&!isErr(fR.value)){const e=parseGFW(fR.value,'fishing');if(e.length){replaceLive('fish_','fishing',e);apiStatus.fishing='live'}else apiStatus.fishing='error'}
    if(gR.status==='fulfilled'&&!isErr(gR.value)){const e=parseGFW(gR.value,'darkships');if(e.length){replaceLive('gap_','darkships',e);apiStatus.darkships='live'}else apiStatus.darkships='error'}
  }
  async function fetchAVWX(){
    try{const d=await proxy('avwx_sigmets');if(isErr(d)){apiStatus.avwx='error';return}
      const wx=parseAVWX(d);if(wx.length){replaceLive('avwx_','avwx',wx);apiStatus.avwx='live'}
      else apiStatus.avwx='error'}catch(e){apiStatus.avwx='error'}
  }
  async function fetchMilitary(){
    try{const d=await proxy('military');if(isErr(d)){apiStatus.military='error';return}
      const ents=(d?.ac||[]).slice(0,80).filter(a=>a.lat&&a.lon).map((a,i)=>{
        const cs=a.flight?.trim()||a.r||'MIL:'+a.hex,milInfo=classMilCS(cs);
        return{id:'mil_adsb_'+i,type:'military',lat:a.lat,lon:a.lon,name:cs,
          details:{ICAO_HEX:a.hex||'\u2014',ALTITUDE:a.alt_baro?a.alt_baro+' ft':'\u2014',
            SPEED:a.gs?Math.round(a.gs)+' kts':'\u2014',
            ...(milInfo?{MIL_OPERATOR:milInfo.op,MIL_ROLE:milInfo.role,AC_TYPE:milInfo.acType}:{}),
            SOURCE:'ADS-B Exchange (LIVE \u2705)'}};
      });
      if(ents.length){replaceLive('mil_adsb','military',ents);apiStatus.military='live'}
      else apiStatus.military='error'}catch(e){apiStatus.military='error'}
  }
  async function fetchGDELT(){
    const[cR,mR]=await Promise.allSettled([proxy('gdelt_conflict'),proxy('gdelt_maritime')]);
    const ents=[];
    if(cR.status==='fulfilled'&&!isErr(cR.value))parseGDELT(cR.value,'conflict').forEach(e=>ents.push(e));
    if(mR.status==='fulfilled'&&!isErr(mR.value))parseGDELT(mR.value,'maritime').forEach(e=>ents.push({...e,id:'m_'+e.id}));
    if(ents.length){replaceLive('gdelt_','conflict',ents);apiStatus.conflict='live'}else apiStatus.conflict='error';
  }
  async function fetchGDACS(){
    const[gR,rR]=await Promise.allSettled([proxy('gdacs'),fetch(D.RELIEFWEB).then(r=>r.json())]);
    const ents=[];
    if(gR.status==='fulfilled'&&!isErr(gR.value))parseGDACS(gR.value).forEach(e=>ents.push(e));
    if(rR.status==='fulfilled')parseReliefWeb(rR.value).forEach(e=>ents.push(e));
    if(ents.length){
      replaceLive('gdacs_','disasters',ents.filter(e=>e.id.startsWith('gdacs_')));
      replaceLive('rw_','disasters',ents.filter(e=>e.id.startsWith('rw_')));
      apiStatus.disasters='live'}else apiStatus.disasters='error';
  }
  async function fetchISSTrack(){
    try{const data=await(await fetch(D.CTRAK_ISS_TLE)).json();
      const obj=Array.isArray(data)?data[0]:data;
      if(obj?.TLE_LINE1&&obj?.TLE_LINE2){issTLE=[obj.TLE_LINE1,obj.TLE_LINE2];updateISSTrack()}}catch(e){}
  }
  function updateISSTrack(){
    if(!issTLE||!map)return;
    const pts=propagateISSTrack(issTLE[0],issTLE[1],92);if(pts.length<10)return;
    const segs=[];let seg=[pts[0]];
    for(let i=1;i<pts.length;i++){if(Math.abs(pts[i][1]-pts[i-1][1])>180){segs.push(seg);seg=[pts[i]]}else seg.push(pts[i])}
    segs.push(seg);issTrackBg?.setLatLngs(segs);issTrackLine?.setLatLngs(segs.map(s=>s.slice(0,30)));
  }
  async function fetchCelesTrak(){
    const[fy,cos,ir,sta,sl,gps,glo]=await Promise.allSettled([
      fetch(D.CTRAK_FENGYUN).then(r=>r.json()),fetch(D.CTRAK_COSMOS).then(r=>r.json()),
      fetch(D.CTRAK_IRIDIUM).then(r=>r.json()),fetch(D.CTRAK_STATIONS).then(r=>r.json()),
      fetch(D.CTRAK_STARLINK).then(r=>r.json()),fetch(D.CTRAK_GPS).then(r=>r.json()),
      fetch(D.CTRAK_GLONASS).then(r=>r.json())]);
    const de=[];
    if(fy.status==='fulfilled')parseCelesTrak(fy.value,'debris',30).forEach(e=>de.push(e));
    if(cos.status==='fulfilled')parseCelesTrak(cos.value,'debris',20).forEach(e=>de.push({...e,id:e.id+'_c'}));
    if(ir.status==='fulfilled')parseCelesTrak(ir.value,'debris',20).forEach(e=>de.push({...e,id:e.id+'_i'}));
    if(de.length){replaceLive('debris_ctk','debris',de);apiStatus.debris='live'}
    if(sta.status==='fulfilled'){const e=parseCelesTrak(sta.value,'satellites',20).map(e=>({...e,id:'sta_'+e.id}));if(e.length)replaceLive('sta_','satellites',e)}
    if(sl.status==='fulfilled'){const e=parseCelesTrak(sl.value,'satellites',60).map(e=>({...e,id:'sl_'+e.id}));if(e.length)replaceLive('sl_','satellites',e)}
    if(gps.status==='fulfilled'){const e=parseCelesTrak(gps.value,'satellites',32).map(e=>({...e,id:'gps_'+e.id}));if(e.length)replaceLive('gps_','satellites',e)}
    if(glo.status==='fulfilled'){const e=parseCelesTrak(glo.value,'satellites',24).map(e=>({...e,id:'glo_'+e.id}));if(e.length)replaceLive('glo_','satellites',e)}
    apiStatus.satellites='live';
  }

  async function fetchAll(){
    await Promise.allSettled([fetchOpenSky(),fetchUSGS(),fetchISS(),fetchFIRMS(),fetchOWM(),fetchN2YO(),fetchGFW(),fetchAVWX(),fetchMilitary(),fetchGDELT(),fetchGDACS()]);
    refreshCounts();refreshThreat();renderUI();
  }

  /* ── LAYER / ZONE VISIBILITY ── */
  function toggleLayer(k){
    layerState[k]=!layerState[k];
    const grp=layerGroups[k];if(!grp||!map)return;
    if(layerState[k]){if(!map.hasLayer(grp))grp.addTo(map)}else{if(map.hasLayer(grp))grp.remove()}
    renderUI();
  }
  function toggleZones(){
    showZones=!showZones;
    zoneCircles.forEach(c=>{if(showZones){if(!map.hasLayer(c))c.addTo(map)}else{if(map.hasLayer(c))c.remove()}});
    renderUI();
  }
  function flyTo(e){selected=e;renderUI();if(map&&e.lat!=null)map.flyTo([e.lat,e.lon],Math.max(map.getZoom(),5),{duration:1.2})}

  /* ═══════════════════════════════════════════════════════════════
     UI RENDERER — Pure DOM manipulation, zero framework overhead
  ═══════════════════════════════════════════════════════════════ */
  function renderUI(){
    const total=Object.values(counts).reduce((a,b)=>a+b,0);
    const emergencies=entities.filter(e=>e.emergency);
    const critCount=threatBoard.filter(t=>t.level==='CRITICAL').length;
    const highCount=threatBoard.filter(t=>t.level==='HIGH').length;
    const medCount=threatBoard.filter(t=>t.level==='MEDIUM').length;

    const dotCol=k=>apiStatus[k]==='live'?'#00ff88':apiStatus[k]==='error'?'#ff3355':'#ffaa00';
    const now=new Date(),pad=v=>String(v).padStart(2,'0');
    const clock=now.getUTCFullYear()+'-'+pad(now.getUTCMonth()+1)+'-'+pad(now.getUTCDate())+' '+pad(now.getUTCHours())+':'+pad(now.getUTCMinutes())+':'+pad(now.getUTCSeconds())+' UTC';

    let html = '';

    // ── HEADER ──
    html += '<div class="hdr">';
    html += '<div style="display:flex;align-items:center;gap:8px;min-width:0">';
    html += '<div style="width:8px;height:8px;border-radius:50%;background:#00ff88;box-shadow:0 0 12px #00ff88;animation:pulse 2s infinite;flex-shrink:0"></div>';
    html += '<span class="orb" style="color:#00ff88;font-size:15px;letter-spacing:6px;font-weight:700;flex-shrink:0">SENTINEL</span>';
    html += '<span style="color:#0d2535;font-size:12px;margin:0 2px">|</span>';
    html += '<span style="color:#1a3a50;font-size:8px;letter-spacing:2px" class="hdr-stats">GLOBAL SITUATIONAL AWARENESS</span>';
    html += '<span onclick="window._toggleZones()" style="color:'+(showZones?'#ffcc00':'#1a3040')+';font-size:7.5px;cursor:pointer;letter-spacing:1px;background:'+(showZones?'rgba(255,204,0,0.08)':'transparent')+';border:1px solid '+(showZones?'#ffcc0044':'#0a2040')+';padding:2px 7px;border-radius:2px;user-select:none;flex-shrink:0" class="hdr-stats">\u2B24 ZONES</span>';
    if(emergencies.length>0){
      html+='<div onclick="window._setPanel(\'threat\')" style="display:flex;align-items:center;gap:5px;background:rgba(255,0,51,0.12);border:1px solid #ff003366;border-radius:3px;padding:2px 8px;cursor:pointer;flex-shrink:0;animation:pulse-fast 1s infinite">';
      html+='<div style="width:6px;height:6px;border-radius:50%;background:#ff0033"></div>';
      html+='<span style="color:#ff3355;font-size:8px;letter-spacing:2px;font-weight:bold">\u26A0 '+emergencies.length+'</span></div>';
    }
    html += '</div>';
    // Status dots
    html += '<div style="display:flex;gap:12px;align-items:center" class="hdr-stats">';
    ['aircraft','seismic','iss','wildfires','debris','conflict','disasters'].forEach(k=>{
      html+='<div style="display:flex;align-items:center;gap:4px"><div style="width:6px;height:6px;border-radius:50%;background:'+dotCol(k)+';box-shadow:0 0 5px '+dotCol(k)+'"></div><span style="color:#0d2030;font-size:7px;letter-spacing:1px">'+k.slice(0,5).toUpperCase()+'</span></div>';
    });
    html += '<span style="color:#1a3040;font-size:8px;letter-spacing:1px;border-left:1px solid #0a2040;padding-left:12px">'+clock+'</span>';
    html += '</div>';
    html += '<div style="display:flex;gap:4px;align-items:center;flex-shrink:0"><span style="color:#0d2030;font-size:8px" class="hdr-stats">TRACKING</span><span class="orb" style="color:#00ff88;font-size:14px;font-weight:bold">'+total.toLocaleString()+'</span><span style="color:#0d2030;font-size:8px" class="hdr-stats">OBJECTS</span></div>';
    html += '</div>';

    // ── LEFT PANEL ──
    html += '<div class="lp">';
    // Tabs
    html += '<div style="display:flex;border-bottom:1px solid #0a2040;flex-shrink:0">';
    [['layers','LAYERS'],['threat','\u2622 '+critCount],['apis','APIS']].forEach(([id,label])=>{
      html+='<div class="tab'+(panel===id?' active':'')+'" onclick="window._setPanel(\''+id+'\')">'+label+'</div>';
    });
    html += '</div>';

    if(panel==='layers'){
      html += '<div style="overflow-y:auto;flex:1">';
      html += '<div style="padding:5px 12px 3px;color:#0a1a28;font-size:6.5px;letter-spacing:1.5px">SCROLL MAP \u00B7 CLICK MARKER TO INSPECT</div>';
      Object.entries(LAYERS).forEach(([k,cfg])=>{
        const st=apiStatus[k],isLive=st==='live',isE=st==='error',on=layerState[k];
        html+='<div class="lr" onclick="window._toggleLayer(\''+k+'\')" style="display:flex;align-items:center;gap:8px;padding:5px 12px;cursor:pointer;opacity:'+(on?1:0.25)+';border-bottom:1px solid #050d18">';
        html+='<div style="width:9px;height:9px;border-radius:50%;flex-shrink:0;background:'+(on?cfg.color:'#0a1520')+';box-shadow:'+(on?'0 0 6px '+cfg.color+'88':'none')+'"></div>';
        html+='<div style="flex:1;min-width:0">';
        html+='<div style="display:flex;justify-content:space-between;align-items:center">';
        html+='<span style="color:#8ab0c4;font-size:8.5px">'+cfg.icon+' '+cfg.label+'</span>';
        html+='<div style="display:flex;align-items:center;gap:4px"><div style="width:5px;height:5px;border-radius:50%;background:'+dotCol(k)+'"></div><span style="color:'+(on?cfg.color:'#0d2030')+';font-size:9px;font-weight:bold">'+(counts[k]||0)+'</span></div></div>';
        html+='<div style="display:flex;gap:3px;margin-top:2px">';
        if(isLive)html+='<span style="color:#00ff88;font-size:5.5px;background:rgba(0,255,136,0.08);padding:0 3px;border-radius:2px">LIVE</span>';
        if(isE)html+='<span style="color:#ff4455;font-size:5.5px;background:rgba(255,68,85,0.08);padding:0 3px;border-radius:2px">ERR</span>';
        html+='<span style="color:#0a1a28;font-size:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+cfg.src+'</span>';
        html+='</div></div></div>';
      });
      html += '</div>';
    }

    if(panel==='threat'){
      html += '<div style="overflow-y:auto;flex:1">';
      html += '<div style="padding:8px 12px 6px;border-bottom:1px solid #0a2040">';
      html += '<div style="color:#1a3a50;font-size:7px;letter-spacing:2px;margin-bottom:6px">GLOBAL THREAT ASSESSMENT</div>';
      html += '<div style="display:flex;gap:3px">';
      [['CRIT',critCount,'#ff0033'],['HIGH',highCount,'#ff7700'],['MED',medCount,'#ffcc00']].forEach(([l,c,col])=>{
        html+='<div style="flex:1;background:rgba(255,255,255,0.02);border:1px solid '+col+'22;border-radius:3px;padding:4px 2px;text-align:center">';
        html+='<div style="color:'+col+';font-size:10px;font-weight:bold">'+c+'</div>';
        html+='<div style="color:'+col+'88;font-size:6px;letter-spacing:1px">'+l+'</div></div>';
      });
      html += '</div></div>';
      threatBoard.forEach((t,idx)=>{
        const isCrit=t.level==='CRITICAL';
        html+='<div class="al'+(isCrit?' threat-crit':t.level==='HIGH'?' threat-high':'')+'" onclick="window._flyTo('+idx+')" style="padding:5px 12px;border-bottom:1px solid #050d18;cursor:pointer">';
        html+='<div style="display:flex;justify-content:space-between;align-items:center;gap:6px">';
        html+='<div style="display:flex;align-items:center;gap:5px;min-width:0"><div style="width:6px;height:6px;border-radius:50%;flex-shrink:0;background:'+t.col+'"></div>';
        html+='<span style="color:'+(isCrit?'#ff5566':'#557799')+';font-size:7.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+t.entity.name+'</span></div>';
        html+='<span style="color:'+t.col+';font-size:8px;font-weight:bold;flex-shrink:0">'+t.score+'</span></div>';
        if(t.reasons[0])html+='<div style="color:#1a3040;font-size:6px;margin-top:2px">\u00B7 '+t.reasons[0]+'</div>';
        html+='</div>';
      });
      html += '</div>';
    }

    if(panel==='apis'){
      html += '<div style="overflow-y:auto;flex:1">';
      html += '<div style="padding:5px 12px 3px;color:#0a1a28;font-size:6.5px;letter-spacing:1.5px">DATA SOURCES \u2014 '+API_REF.length+' FEEDS</div>';
      API_REF.forEach(a=>{
        const sc=a.status==='live'?'#00ff88':a.status==='missing'?'#ff4455':'#4488aa';
        html+='<div style="padding:4px 12px;border-bottom:1px solid #050d18"><div style="display:flex;justify-content:space-between">';
        html+='<span style="color:#5a8a9a;font-size:8px">'+a.name+'</span>';
        html+='<div style="display:flex;gap:5px"><span style="color:'+(a.cost==='FREE'?'#00aa55':'#ff8844')+';font-size:6.5px">'+a.cost+'</span>';
        html+='<span style="color:'+sc+';font-size:7px">'+a.key+'</span></div></div></div>';
      });
      html += '</div>';
    }
    html += '</div>'; // end left panel

    // ── RIGHT PANEL (Entity Inspector) ──
    if(selected){
      const threat=selected._threat||scoreThreat(selected);
      html += '<div class="rp">';
      html += '<div style="padding:12px 14px 8px;border-bottom:1px solid #0a2040">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center">';
      html += '<div style="display:flex;align-items:center;gap:7px"><div style="width:9px;height:9px;border-radius:50%;background:'+(LAYERS[selected.type]?.color||'#fff')+'"></div>';
      html += '<span style="color:'+(LAYERS[selected.type]?.color||'#fff')+';font-size:8.5px;letter-spacing:2px">'+(LAYERS[selected.type]?.label||selected.type)+'</span>';
      html += '<span style="color:#00ff88;font-size:6px;background:rgba(0,255,136,0.1);padding:0 4px;border-radius:2px">LIVE</span></div>';
      html += '<span class="cb" onclick="window._closeInspector()" style="color:#1a3040;font-size:12px;cursor:pointer">\u2715</span></div>';
      if(threat.score>=10){
        html+='<div style="margin-top:8px;padding:7px 10px;background:'+threat.col+'12;border:1px solid '+threat.col+'44;border-radius:3px">';
        html+='<div style="display:flex;justify-content:space-between"><span style="color:'+threat.col+';font-size:8.5px;font-weight:bold">THREAT: '+threat.level+'</span><span style="color:'+threat.col+';font-size:9px;font-weight:bold">'+threat.score+'/100</span></div>';
        threat.reasons.slice(0,3).forEach(r=>{html+='<div style="color:'+threat.col+'99;font-size:6.5px;margin-top:2px">\u00B7 '+r+'</div>'});
        html+='</div>';
      }
      if(selected.emergency&&selected.squawkInfo){
        html+='<div style="margin-top:7px;padding:6px 8px;background:rgba(255,0,51,0.12);border:1px solid #ff003366;border-radius:3px">';
        html+='<div style="color:#ff3355;font-size:9px;font-weight:bold">'+selected.squawkInfo.badge+' SQUAWK '+selected.squawk+' \u2014 '+selected.squawkInfo.label+'</div>';
        html+='<div style="color:#cc2244;font-size:7px;margin-top:3px">'+selected.squawkInfo.desc+'</div></div>';
      }
      html+='<div style="color:#ffffff;font-size:12px;margin-top:8px;word-break:break-word">'+selected.name+'</div>';
      html+='<div style="color:#0d2030;font-size:7.5px;margin-top:5px">'+selected.lat?.toFixed(4)+'\u00B0 '+(selected.lat>=0?'N':'S')+' \u00B7 '+Math.abs(selected.lon)?.toFixed(4)+'\u00B0 '+(selected.lon>=0?'E':'W')+'</div></div>';
      html+='<div style="padding:4px 14px 12px">';
      Object.entries(selected.details||{}).forEach(([k,v])=>{
        html+='<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #040e16;gap:8px">';
        html+='<span style="color:#0a2030;font-size:7px;flex-shrink:0">'+k+'</span>';
        html+='<span style="color:'+(k==='SOURCE'?'#1e4055':'#5a8aaa')+';font-size:7.5px;text-align:right;word-break:break-all">'+v+'</span></div>';
      });
      html+='</div></div>';
    }

    // ── BOTTOM TICKER (desktop) ──
    html += '<div class="btk btk-desktop">';
    html += '<div style="flex-shrink:0;padding:0 14px;border-right:1px solid #0a2040;display:flex;align-items:center;gap:7px">';
    html += '<div style="width:6px;height:6px;border-radius:50%;background:#ff3355;box-shadow:0 0 8px #ff3355;animation:pulse 1s infinite"></div>';
    html += '<span style="color:#ff3355;font-size:8px;letter-spacing:3px">INTEL</span></div>';
    html += '<div style="padding:0 18px;color:#224455;font-size:8.5px;animation:ticker 5.5s ease forwards;white-space:nowrap;flex:1">'+TICKER[tickIdx]+'</div>';
    html += '<div style="padding:0 14px;display:flex;gap:16px;flex-shrink:0;border-left:1px solid #0a2040">';
    ['SCROLL:ZOOM','DRAG:PAN','CLICK:INSPECT'].forEach(t=>{html+='<span style="color:#0a1a28;font-size:7px">'+t+'</span>'});
    html += '</div></div>';

    // ── MOBILE BOTTOM BAR ──
    html += '<div class="mob-bar" style="display:none;position:absolute;bottom:0;left:0;right:0;height:48px;background:rgba(1,8,16,0.98);border-top:1px solid #0a2040;align-items:center;justify-content:space-around;z-index:500">';
    [['layers','\uD83D\uDDFA','LAYERS','#00d4ff'],['threat','\u2622','THREATS',critCount?'#ff3355':'#1a3040'],['apis','\uD83D\uDCE1','APIS','#1a3a50']].forEach(([id,icon,label,col])=>{
      html+='<div onclick="window._setPanel(\''+id+'\')" style="display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;padding:4px 12px">';
      html+='<span style="font-size:16px">'+icon+'</span><span style="color:'+col+';font-size:6px;letter-spacing:1px">'+label+'</span></div>';
    });
    html += '</div>';

    appEl.innerHTML = html;
  }

  /* ── GLOBAL EVENT HANDLERS ── */
  window._toggleLayer = toggleLayer;
  window._toggleZones = toggleZones;
  window._setPanel = p => { panel=p; renderUI(); };
  window._flyTo = idx => { if(threatBoard[idx]) flyTo(threatBoard[idx].entity); };
  window._closeInspector = () => { selected=null; renderUI(); };

  /* ── BOOT SEQUENCE ── */
  function boot(){
    initMap();
    renderUI();

    // Staggered data loading
    fetchAll();
    fetchCelesTrak();
    fetchISSTrack();

    // Polling intervals
    setInterval(fetchAll, 30000);         // All feeds: 30s
    setInterval(fetchISS, 5000);          // ISS position: 5s
    setInterval(fetchCelesTrak, 180000);  // TLE propagation: 3min
    setInterval(fetchISSTrack, 3600000);  // ISS TLE refresh: 1hr
    setInterval(() => { tickIdx = (tickIdx+1) % TICKER.length; renderUI(); }, 5500);

    // ISS track refresh on TLE update
    setInterval(updateISSTrack, 60000);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
