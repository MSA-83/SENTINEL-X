/**
 * SENTINEL OS v3.0 — Global Multi-Domain Situational Awareness Platform
 * Production Client: 16+ live OSINT layers, threat assessment engine,
 * multi-domain fusion, military callsign intelligence, SGP4 orbital propagation,
 * geopolitical zone monitoring, GDELT article-based conflict intel.
 *
 * Architecture: Zero-framework DOM renderer with edge BFF proxy
 * Performance: GPU-accelerated CSS, marker clustering, phased data loading
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
async function intelFetch(category) {
  try {
    const res = await fetch('/api/intel/gdelt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category })
    });
    return await res.json();
  } catch (e) {
    return { events: [], error: String(e) };
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
  CTRAK_MILITARY: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=military&FORMAT=json',
  // ReliefWeb routed through proxy to avoid CORS and appname issues
};

/* ═══════════════════════════════════════════════════════════════
   LAYER CONFIG — 16+ intelligence domains
═══════════════════════════════════════════════════════════════ */
const LAYERS = {
  aircraft:   { label:'AIRCRAFT',        icon:'\u2708',       color:'#00ccff', src:'OpenSky Network ADS-B', domain:'AVIATION' },
  military:   { label:'MILITARY AIR',    icon:'\u2708',       color:'#ff3355', src:'ADS-B Exchange (RapidAPI)', domain:'AVIATION' },
  ships:      { label:'MARITIME AIS',    icon:'\u2693',       color:'#00ff88', src:'MarineTraffic — KEY NEEDED', domain:'MARITIME' },
  darkships:  { label:'DARK FLEET',      icon:'\u2753',       color:'#9933ff', src:'GFW AIS Gap Events', domain:'MARITIME' },
  fishing:    { label:'FISHING',         icon:'\uD83D\uDC1F', color:'#33ffcc', src:'GFW Events API', domain:'MARITIME' },
  iss:        { label:'ISS',             icon:'\uD83D\uDE80', color:'#ff6600', src:'wheretheiss.at + SGP4', domain:'ORBITAL' },
  satellites: { label:'SATELLITES',      icon:'\u2605',       color:'#ffcc00', src:'N2YO + CelesTrak', domain:'ORBITAL' },
  debris:     { label:'SPACE DEBRIS',    icon:'\u2715',       color:'#cc2255', src:'CelesTrak TLE (SGP4)', domain:'ORBITAL' },
  milsat:     { label:'MIL SATELLITES',  icon:'\u2742',       color:'#ff4488', src:'CelesTrak Military', domain:'ORBITAL' },
  seismic:    { label:'SEISMIC',         icon:'\u0021',       color:'#ffee00', src:'USGS Earthquake API', domain:'ENVIRONMENTAL' },
  wildfires:  { label:'WILDFIRES',       icon:'\uD83D\uDD25', color:'#ff5500', src:'NASA FIRMS VIIRS', domain:'ENVIRONMENTAL' },
  weather:    { label:'STORM SYSTEMS',   icon:'\uD83C\uDF00', color:'#4477ff', src:'OpenWeatherMap', domain:'ENVIRONMENTAL' },
  avwx:       { label:'AVIATION WX',     icon:'\uD83D\uDCE1', color:'#88aaff', src:'AVWX SIGMETs', domain:'ENVIRONMENTAL' },
  conflict:   { label:'CONFLICT INTEL',  icon:'\u2694',       color:'#ff2200', src:'GDELT 2.0 Article Intel', domain:'GEOPOLITICAL' },
  disasters:  { label:'DISASTERS',       icon:'\uD83C\uDD98', color:'#ff8c00', src:'GDACS + ReliefWeb', domain:'ENVIRONMENTAL' },
  cyber:      { label:'CYBER THREATS',   icon:'\uD83D\uDD12', color:'#66ffcc', src:'GDELT Cyber Intel', domain:'CYBER' },
  nuclear:    { label:'NUCLEAR INTEL',   icon:'\u2622',       color:'#ff00ff', src:'GDELT Nuclear Monitoring', domain:'WMD' },
};

/* ═══════════════════════════════════════════════════════════════
   SQUAWK & MILITARY CALLSIGN INTELLIGENCE
═══════════════════════════════════════════════════════════════ */
const SQUAWK_DB = {
  '7500': { label:'HIJACK', sev:'CRITICAL', col:'#ff0033', badge:'\uD83D\uDD34', desc:'Aircraft under unlawful seizure — immediate response required' },
  '7600': { label:'COMMS FAILURE', sev:'HIGH', col:'#ff8800', badge:'\uD83D\uDFE0', desc:'Loss of two-way radio communications' },
  '7700': { label:'EMERGENCY', sev:'CRITICAL', col:'#ff2200', badge:'\uD83D\uDD34', desc:'General emergency — fuel, mechanical, medical' },
  '7777': { label:'MIL INTERCEPT', sev:'HIGH', col:'#ff5500', badge:'\uD83D\uDFE0', desc:'Military interception operations active' },
  '7400': { label:'UAV LOST LINK', sev:'HIGH', col:'#ff9900', badge:'\uD83D\uDFE0', desc:'Unmanned Aerial System lost command link' },
  '1200': { label:'VFR', sev:'NONE', col:'#2a4060', badge:'', desc:'Visual Flight Rules — standard' },
  '1201': { label:'VFR-TANKER', sev:'LOW', col:'#4488aa', badge:'', desc:'VFR aerial refueling track' },
};
const SQ_CRIT = new Set(['7500','7700']);
const SQ_ALERT = new Set(['7600','7777','7400']);

const MIL_RE = /^(RCH|USAF|REACH|DUKE|TOPCT|NATO|JAKE|VIPER|GHOST|BRONC|LOBO|RALLY|SKILL|VALOR|BLADE|EVAC|CHAOS|HAVOC|RAVEN|KNIFE|STING|BISON|COBRA|EAGLE|FURY|HUSTLE|IRON|LANCE|NOBLE|ORCA|REAPER|SHARK|SWORD|TORCH|WOLF|NAVY|BATT|CYLON|DEMON|DOOM|FORCE|GIANT|HAWK|JOKER|KING|MAGIC|NIGHT|OMEN|PYTHON|RAPTOR|SKULL|TITAN|VENOM|XRAY|ZERO)/i;

const MIL_DB = {
  RCH:    { op:'USAF AMC', role:'Strategic Airlift', acType:'C-17A Globemaster III / C-5M Super Galaxy', nato:'HEAVY' },
  REACH:  { op:'USAF AMC', role:'Strategic Airlift', acType:'C-17A / C-5M', nato:'HEAVY' },
  JAKE:   { op:'USN VP Fleet', role:'Maritime Patrol', acType:'P-8A Poseidon', nato:'MARITIME PATROL' },
  NATO:   { op:'NATO AEW&C', role:'Airborne Early Warning', acType:'E-3A AWACS / E-7 Wedgetail', nato:'AWACS' },
  GHOST:  { op:'USAF ACC', role:'Stealth Strike', acType:'B-2A Spirit / F-22A Raptor', nato:'STEALTH' },
  VIPER:  { op:'USAF ACC', role:'Multirole Fighter', acType:'F-16C/D Fighting Falcon', nato:'FIGHTER' },
  BRONC:  { op:'USAF RC', role:'ISR / SIGINT Collection', acType:'RC-135V/W Rivet Joint', nato:'SIGINT' },
  DUKE:   { op:'USAF STRATCOM', role:'National Command Authority', acType:'E-4B NAOC Nightwatch', nato:'COMMAND' },
  BLADE:  { op:'USN Strike', role:'Carrier Aviation', acType:'F/A-18E/F Super Hornet', nato:'FIGHTER' },
  EVAC:   { op:'USAF AMC', role:'Aeromedical Evacuation', acType:'C-17A / C-130J-30', nato:'MEDEVAC' },
  KNIFE:  { op:'USAF AFSOC', role:'Special Operations CAS', acType:'AC-130J Ghostrider', nato:'GUNSHIP' },
  EAGLE:  { op:'USAF ACC', role:'Air Superiority', acType:'F-15E Strike Eagle', nato:'FIGHTER' },
  COBRA:  { op:'US Army Aviation', role:'Attack Helicopter', acType:'AH-64E Apache Guardian', nato:'ATTACK' },
  REAPER: { op:'USAF RPA', role:'ISR / Precision Strike', acType:'MQ-9A Reaper', nato:'UAS-STRIKE' },
  FURY:   { op:'USN Strike', role:'Air Superiority', acType:'F/A-18E/F Block III', nato:'FIGHTER' },
  IRON:   { op:'USAF AMC', role:'Aerial Refueling', acType:'KC-135R / KC-46A Pegasus', nato:'TANKER' },
  WOLF:   { op:'USAF AFSOC', role:'Special Operations', acType:'CV-22B Osprey', nato:'SOF' },
  HAWK:   { op:'USAF ACC', role:'Training / Aggressor', acType:'F-16C/D / T-38C', nato:'AGGRESSOR' },
  RAPTOR: { op:'USAF ACC', role:'5th Gen Air Dominance', acType:'F-22A Raptor', nato:'STEALTH' },
  TITAN:  { op:'USAF AMC', role:'Heavy Lift', acType:'C-5M Super Galaxy', nato:'HEAVY' },
  MAGIC:  { op:'USAF AETC', role:'Electronic Warfare', acType:'EA-18G Growler', nato:'EW' },
  NAVY:   { op:'USN / USMC', role:'Naval Aviation', acType:'Various naval aircraft', nato:'NAVAL' },
  SKULL:  { op:'USAF ACC', role:'Aggressor Squadron', acType:'F-35A Lightning II', nato:'AGGRESSOR' },
  DEMON:  { op:'RAF', role:'Fast Jet', acType:'Eurofighter Typhoon', nato:'FIGHTER' },
  PYTHON: { op:'IAF', role:'Fighter-Bomber', acType:'F-35I Adir / F-16I Sufa', nato:'FIGHTER' },
};

/* ═══════════════════════════════════════════════════════════════
   THREAT ASSESSMENT ENGINE — Multi-factor geopolitical scoring
═══════════════════════════════════════════════════════════════ */
const THREAT_ZONES = [
  { name:'Ukraine/Russia Front',  lat:48.5, lon:37.0, r:400, base:55, type:'conflict', active:true },
  { name:'Gaza Strip',            lat:31.4, lon:34.5, r:120, base:70, type:'conflict', active:true },
  { name:'Iran Theater',          lat:32.4, lon:53.7, r:500, base:65, type:'flashpoint', active:true },
  { name:'Red Sea — Houthi Zone', lat:14.5, lon:43.5, r:350, base:60, type:'chokepoint', active:true },
  { name:'Strait of Hormuz',      lat:26.5, lon:56.3, r:180, base:50, type:'chokepoint', active:true },
  { name:'Taiwan Strait',         lat:24.5, lon:120.0, r:250, base:55, type:'flashpoint', active:true },
  { name:'South China Sea',       lat:13.5, lon:115.0, r:500, base:45, type:'flashpoint', active:true },
  { name:'Korean Peninsula',      lat:38.0, lon:127.5, r:200, base:50, type:'flashpoint', active:true },
  { name:'Sudan Civil War',       lat:15.5, lon:32.5, r:350, base:50, type:'conflict', active:true },
  { name:'Kashmir LOC',           lat:34.0, lon:74.5, r:200, base:45, type:'flashpoint', active:true },
  { name:'Black Sea NATO Watch',  lat:43.5, lon:34.5, r:400, base:45, type:'flashpoint', active:true },
  { name:'Sahel Insurgency',      lat:14.0, lon:2.0, r:600, base:40, type:'conflict', active:true },
  { name:'Horn of Africa',        lat:4.0, lon:46.0, r:400, base:38, type:'chokepoint', active:true },
  { name:'Baltic NATO Frontier',  lat:57.0, lon:24.0, r:300, base:35, type:'flashpoint', active:true },
  { name:'Arctic GIUK Gap',       lat:63.0, lon:-20.0, r:500, base:30, type:'chokepoint', active:true },
];

const THREAT_LEVELS = [
  { level:'CRITICAL', min:75, col:'#ff0033', glow:'#ff003388', badge:'CRIT', bg:'rgba(255,0,51,0.06)' },
  { level:'HIGH',     min:50, col:'#ff7700', glow:'#ff770066', badge:'HIGH', bg:'rgba(255,119,0,0.04)' },
  { level:'MEDIUM',   min:28, col:'#ffcc00', glow:'#ffcc0044', badge:'MED',  bg:'rgba(255,204,0,0.03)' },
  { level:'LOW',      min:10, col:'#44aaff', glow:'#44aaff33', badge:'LOW',  bg:'rgba(68,170,255,0.02)' },
  { level:'MINIMAL',  min:0,  col:'#2a4060', glow:'#2a406022', badge:'MIN',  bg:'transparent' },
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
    if(SQ_CRIT.has(e.squawk)){s+=82;reasons.push('SQUAWK '+e.squawk+': '+SQUAWK_DB[e.squawk]?.label)}
    else if(SQ_ALERT.has(e.squawk)){s+=55;reasons.push('SQUAWK '+e.squawk+': '+SQUAWK_DB[e.squawk]?.label)}
  }
  if(e.type==='military'||e.type==='milsat'){s+=12;reasons.push('Military asset detected')}
  if(e.type==='darkships'){s+=28;reasons.push('AIS gap — potential dark vessel activity')}
  if(e.type==='seismic'){
    const mag=parseFloat(e.details?.MAGNITUDE||'0')||0;
    if(mag>=7){s+=75;reasons.push('M'+mag.toFixed(1)+' — major earthquake')}
    else if(mag>=5.5){s+=40;reasons.push('M'+mag.toFixed(1)+' — strong earthquake')}
    else if(mag>=4.5){s+=18;reasons.push('M'+mag.toFixed(1)+' — moderate earthquake')}
    else if(mag>=3){s+=8;reasons.push('M'+mag.toFixed(1)+' — light seismic event')}
  }
  if(e.type==='wildfires'){
    const frp=parseFloat(e.details?.FRP||'0')||0;
    if(frp>=500){s+=45;reasons.push('FRP '+frp.toFixed(0)+' MW — major wildfire')}
    else if(frp>=100){s+=25;reasons.push('FRP '+frp.toFixed(0)+' MW — significant fire')}
    else if(frp>=30){s+=12;reasons.push('FRP '+frp.toFixed(0)+' MW — active fire')}
  }
  if(e.type==='conflict'){s+=22;reasons.push('Active conflict intelligence event')}
  if(e.type==='nuclear'){s+=35;reasons.push('Nuclear/WMD-related intelligence')}
  if(e.type==='cyber'){s+=15;reasons.push('Cyber threat intelligence event')}
  if(e.type==='disasters'){
    const alert=e.details?.ALERT||'';
    if(alert.toLowerCase()==='red'){s+=40;reasons.push('RED alert — major disaster')}
    else if(alert.toLowerCase()==='orange'){s+=20;reasons.push('ORANGE alert — moderate disaster')}
    else{s+=8;reasons.push('Active disaster event')}
  }
  if(e.lat!=null&&e.lon!=null){
    for(const z of THREAT_ZONES){
      if(!z.active)continue;
      const d=haversine(e.lat,e.lon,z.lat,z.lon);
      if(d<z.r){
        const proximity=1-d/z.r;
        const bonus=Math.round(z.base*proximity);
        s+=bonus;
        if(bonus>=8)reasons.push('Proximity: '+z.name+' ('+d.toFixed(0)+'km, +'+bonus+')');
        break;
      }
    }
  }
  s=Math.min(100,Math.round(s));
  const lvl=getThreatLevel(s);
  return{score:s,level:lvl.level,col:lvl.col,glow:lvl.glow,bg:lvl.bg,reasons};
}

function buildThreatBoard(entities){
  return entities.map(e=>({entity:e,...scoreThreat(e)}))
    .filter(t=>t.score>=8).sort((a,b)=>b.score-a.score).slice(0,50);
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

function markerSVG(color, sz, isEmg, threatLvl) {
  const r = sz/2, ir = sz*0.2;
  const cls = isEmg ? 'emg' : threatLvl === 'CRITICAL' ? 'crit' : threatLvl === 'HIGH' ? 'high' : '';
  const glow = isEmg || threatLvl === 'CRITICAL' ? `<circle cx="${r}" cy="${r}" r="${r+2}" fill="none" stroke="${color}" stroke-width="0.5" opacity="0.3"/>` : '';
  return `<div class="sm ${cls}" style="width:${sz}px;height:${sz}px">` +
    `<svg width="${sz}" height="${sz}" xmlns="http://www.w3.org/2000/svg">` +
    glow +
    `<circle cx="${r}" cy="${r}" r="${r-1}" fill="${color}" opacity="0.78"/>` +
    `<circle cx="${r}" cy="${r}" r="${ir}" fill="#e0f0ff" opacity="0.88"/>` +
    `</svg></div>`;
}

/* ═══════════════════════════════════════════════════════════════
   PARSERS — Normalize upstream responses to unified entity format
═══════════════════════════════════════════════════════════════ */
function parseOpenSky(data){
  if(!data?.states)return[];
  return data.states.filter(s=>s[6]!=null&&s[5]!=null&&s[8]===false)
    .slice(0,600).map((s,i)=>{
      const cs=(s[1]||'').trim(),isMil=MIL_RE.test(cs);
      const sq=s[14]?String(s[14]).padStart(4,'0'):null;
      const sqInfo=classifySquawk(sq),milInfo=isMil?classMilCS(cs):null;
      const isEmg=sqInfo!=null&&(SQ_CRIT.has(sq)||SQ_ALERT.has(sq));
      const altFt=s[7]!=null?Math.round(s[7]*3.28084):null;
      const spdKts=s[9]!=null?Math.round(s[9]*1.944):null;
      return{id:'ac_'+i,type:isMil?'military':'aircraft',lat:s[6],lon:s[5],name:cs||'ICAO:'+s[0],
        emergency:isEmg,squawk:sq,squawkInfo:sqInfo,
        details:{ICAO24:s[0]||'—',CALLSIGN:cs||'—',ORIGIN:s[2]||'—',
          ALTITUDE:altFt!=null?altFt.toLocaleString()+' ft':'—',
          BARO_ALT:s[13]!=null?Math.round(s[13]*3.28084).toLocaleString()+' ft':'—',
          VELOCITY:spdKts!=null?spdKts+' kts':'—',
          HEADING:s[10]!=null?Math.round(s[10])+'°':'—',
          VERT_RATE:s[11]!=null?Math.round(s[11]*196.85)+' fpm':'—',
          SQUAWK:sq||'—',
          ...(sqInfo?{'⚠ SQUAWK':sqInfo.badge+' '+sqInfo.label+' — '+sqInfo.desc}:{}),
          ...(milInfo?{MIL_OPERATOR:milInfo.op,MIL_ROLE:milInfo.role,AC_TYPE:milInfo.acType,NATO_ROLE:milInfo.nato||'—'}:{}),
          SOURCE:isMil?'OpenSky + MIL-DB (LIVE ✅)':'OpenSky ADS-B (LIVE ✅)'}};
    });
}

function parseUSGS(data){
  if(!data?.features)return[];
  return data.features.slice(0,250).map((f,i)=>{
    const p=f.properties,c=f.geometry.coordinates,mag=p.mag!=null?parseFloat(p.mag.toFixed(1)):0;
    return{id:'eq_'+i,type:'seismic',lat:c[1],lon:c[0],name:'M'+mag+' — '+(p.place||'Unknown').slice(0,60),
      details:{MAGNITUDE:String(mag),DEPTH:(c[2]?.toFixed(1)||'?')+' km',PLACE:p.place||'—',
        TSUNAMI:p.tsunami?'⚠ WARNING':'None',FELT:p.felt?p.felt+' reports':'—',
        SIGNIFICANCE:String(p.sig||'—'),TIME:new Date(p.time).toUTCString(),
        DETAIL_URL:p.url||'—',SOURCE:'USGS (LIVE ✅)'}};
  });
}

function parseISS(d){
  if(!d||d.latitude==null)return[];
  return[{id:'iss_live',type:'iss',lat:d.latitude,lon:d.longitude,name:'ISS (ZARYA) — International Space Station',
    details:{ALTITUDE:(d.altitude?.toFixed(1)||'~408')+' km',SPEED:(d.velocity?.toFixed(2)||'7.66')+' km/s',
      FOOTPRINT:d.footprint?Math.round(d.footprint)+' km':'—',
      VISIBILITY:d.visibility||'—',DAYNUM:d.daynum||'—',
      SOURCE:'wheretheiss.at (LIVE ✅)'}}];
}

function parseFIRMS(csv){
  if(!csv||typeof csv!=='string')return[];
  const lines=csv.trim().split('\n');if(lines.length<2)return[];
  const hdr=lines[0].split(','),li=hdr.indexOf('latitude'),lo=hdr.indexOf('longitude'),
    fr=hdr.indexOf('frp'),cf=hdr.indexOf('confidence'),br=hdr.indexOf('bright_ti4'),dt=hdr.indexOf('acq_date'),tm=hdr.indexOf('acq_time');
  return lines.slice(1,200).map((row,i)=>{
    const c=row.split(','),lat=parseFloat(c[li]),lon=parseFloat(c[lo]);
    if(isNaN(lat)||isNaN(lon))return null;
    return{id:'fire_'+i,type:'wildfires',lat,lon,name:'VIIRS HOTSPOT — '+(c[5]||'Unknown'),
      details:{FRP:(parseFloat(c[fr]||'0')).toFixed(1)+' MW',CONFIDENCE:c[cf]||'?',
        BRIGHTNESS:c[br]?parseFloat(c[br]).toFixed(1)+' K':'—',
        ACQ_DATE:c[dt]||'—',ACQ_TIME:c[tm]||'—',
        SOURCE:'NASA FIRMS (LIVE ✅)'}};
  }).filter(Boolean);
}

function parseOWM(data){
  if(!data?.list)return[];
  return data.list.map((s,i)=>({id:'storm_'+i,type:'weather',lat:s.coord?.lat||0,lon:s.coord?.lon||0,
    name:(s.name||'SYSTEM')+' — '+((s.weather?.[0]?.main||'').toUpperCase()),
    details:{WIND_SPEED:((s.wind?.speed||0)*1.944).toFixed(1)+' kts',WIND_DIR:(s.wind?.deg||'—')+'°',
      PRESSURE:(s.main?.pressure||'?')+' hPa',TEMP:((s.main?.temp||273)-273.15).toFixed(1)+'°C',
      HUMIDITY:(s.main?.humidity||'—')+'%',VISIBILITY:s.visibility?Math.round(s.visibility/1000)+' km':'—',
      SOURCE:'OpenWeatherMap (LIVE ✅)'}}));
}

function parseN2YO(data){
  if(!data?.above)return[];
  return data.above.map((s,i)=>({id:'sat_n2yo_'+i,type:'satellites',lat:s.satlat||0,lon:s.satlng||0,
    name:s.satname?.trim()||'NORAD:'+s.satid,
    details:{NORAD_ID:String(s.satid),ALTITUDE:(s.satalt?.toFixed(0)||'—')+' km',
      INT_DESIGNATOR:s.intDesignator||'—',LAUNCH_DATE:s.launchDate||'—',
      SOURCE:'N2YO (LIVE ✅)'}}));
}

function parseGFW(data,layerType){
  const entries=Array.isArray(data)?data:(data?.entries||[]);if(!entries.length)return[];
  return entries.slice(0,60).map((ev,i)=>{
    const pos=ev.position||{},lat=pos.lat??null,lon=pos.lon??null;if(lat==null||lon==null)return null;
    const vessel=ev.vessel||{},name=vessel.name||'MMSI:'+(vessel.ssvid||i);
    if(layerType==='darkships')return{id:'gap_'+i,type:'darkships',lat,lon,name:'DARK — '+name,
      details:{MMSI:vessel.ssvid||'—',FLAG:vessel.flag||'—',TYPE:ev.type||'—',
        GAP_HOURS:ev.gap_hours?ev.gap_hours.toFixed(1)+' hrs':'—',
        SOURCE:'GFW Gap Events (LIVE ✅)'}};
    return{id:'fish_'+i,type:'fishing',lat,lon,name,
      details:{FLAG:vessel.flag||'—',GEAR_TYPE:vessel.gear_type||'—',
        FISHING_HOURS:ev.fishing_hours?ev.fishing_hours.toFixed(1)+' hrs':'—',
        SOURCE:'GFW (LIVE ✅)'}};
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
    return{id:'avwx_'+i,type:'avwx',lat,lon,name:'SIGMET — '+sigType,
      details:{TYPE:sigType,SEVERITY:s?.severity||'—',MAX_FL:s?.max_fl||'—',
        SOURCE:'AVWX (LIVE ✅)'}};
  }).filter(Boolean);
}

function parseCelesTrak(tleObjects, layerType, limit){
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
      const altKm=geo.height;
      results.push({id:layerType+'_ctk_'+i,type:layerType,lat:parseFloat(la.toFixed(4)),lon:parseFloat(lo.toFixed(4)),
        name:obj.OBJECT_NAME?.trim()||'NORAD:'+obj.NORAD_CAT_ID,
        details:{NORAD_ID:obj.NORAD_CAT_ID||'—',ALTITUDE:(altKm?.toFixed(1)||'—')+' km',
          PERIOD:obj.PERIOD?parseFloat(obj.PERIOD).toFixed(1)+' min':'—',
          INCLINATION:obj.INCLINATION?parseFloat(obj.INCLINATION).toFixed(1)+'°':'—',
          EPOCH:obj.EPOCH||'—',
          SOURCE:'CelesTrak SGP4 (LIVE ✅)'}});
    }catch(e){}
  }
  return results;
}

function parseGDACS(data){
  const features=data?.features||[];
  return features.map((f,i)=>{
    const p=f.properties||{},coords=f.geometry?.coordinates||[],lat=coords[1],lon=coords[0];
    if(!lat||!lon)return null;
    const evType=(p.eventtype||'EVENT').toUpperCase();
    const typeEmoji={'EQ':'🔴','TC':'🌀','FL':'🌊','VO':'🌋','TS':'🌊'}[evType]||'⚠';
    return{id:'gdacs_'+i,type:'disasters',lat,lon,
      name:typeEmoji+' '+evType+' — '+(p.eventname||p.country||'Unknown'),
      details:{ALERT_LEVEL:p.alertlevel||'—',ALERT:p.alertlevel||'—',COUNTRY:p.country||'—',
        SEVERITY:p.severity?p.severity.toFixed(1):'—',POPULATION_AFFECTED:p.pop_affected||'—',
        FROM_DATE:p.fromdate||'—',TO_DATE:p.todate||'—',
        SOURCE:'GDACS (LIVE ✅)'}};
  }).filter(Boolean);
}

function parseGDELTIntel(data, layerType){
  if(!data?.events)return[];
  return data.events.map(ev=>({
    id:ev.id,type:layerType||ev.type||'conflict',lat:ev.lat,lon:ev.lon,
    name:(ev.matchedLocation||'').toUpperCase()+': '+(ev.title||'').slice(0,80),
    details:{HEADLINE:ev.title||'—',SOURCE_DOMAIN:ev.domain||'—',
      COUNTRY:ev.country||'—',LANGUAGE:ev.language||'—',
      REGION:ev.region||'—',MATCHED:ev.matchedLocation||'—',
      TIMESTAMP:ev.timestamp||'—',ARTICLE_URL:ev.url||'—',
      SOURCE:'GDELT Intel (LIVE ✅)'}
  }));
}

function parseReliefWeb(data){
  const C={Afghanistan:{lat:33.9,lon:67.7},Sudan:{lat:12.9,lon:30.2},Ukraine:{lat:48.4,lon:31.2},
    Syria:{lat:34.8,lon:39.0},Yemen:{lat:15.6,lon:48.5},Myanmar:{lat:19.2,lon:96.7},
    Somalia:{lat:6.0,lon:46.2},Haiti:{lat:18.9,lon:-72.3},Philippines:{lat:12.9,lon:121.8},
    Ethiopia:{lat:9.1,lon:40.5},'Democratic Republic of the Congo':{lat:-4.0,lon:21.8},
    Iran:{lat:32.4,lon:53.7},Lebanon:{lat:33.9,lon:35.5},Libya:{lat:26.3,lon:17.2},
    Mozambique:{lat:-18.7,lon:35.5},Pakistan:{lat:30.4,lon:69.3},Iraq:{lat:33.2,lon:44.4},
    Nigeria:{lat:9.1,lon:8.7},Mali:{lat:17.6,lon:-4.0},'Burkina Faso':{lat:12.4,lon:-1.5},
    Chad:{lat:15.5,lon:18.7},Niger:{lat:17.6,lon:8.1},Mexico:{lat:23.6,lon:-102.6}};
  return(data?.data||[]).map((item,i)=>{
    const f=item.fields||{},country=f.country?.[0]?.name||'Unknown',c=C[country];
    if(!c)return null;
    return{id:'rw_'+i,type:'disasters',lat:c.lat+(Math.random()-0.5),lon:c.lon+(Math.random()-0.5),
      name:(f.primary_type?.name||'DISASTER').toUpperCase()+': '+(f.name||country),
      details:{COUNTRY:country,STATUS:f.status?.name||'—',TYPE:f.primary_type?.name||'—',
        GLIDE:f.glide||'—',SOURCE:'ReliefWeb (LIVE ✅)'}};
  }).filter(Boolean);
}

function propagateISSTrack(tl1,tl2,minutes){
  const sat=window.satellite;if(!sat)return[];
  try{
    const satrec=sat.twoline2satrec(tl1.trim(),tl2.trim()),points=[];
    const now=new Date();
    for(let m=0;m<=minutes;m+=1){
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
  { name:'OpenSky Network',    cost:'FREE', key:'NO KEY',    status:'live', domain:'Aviation' },
  { name:'USGS Earthquakes',   cost:'FREE', key:'NO KEY',    status:'live', domain:'Seismic' },
  { name:'wheretheiss.at',     cost:'FREE', key:'NO KEY',    status:'live', domain:'Orbital' },
  { name:'CelesTrak TLE',      cost:'FREE', key:'NO KEY',    status:'live', domain:'Orbital' },
  { name:'ReliefWeb OCHA',     cost:'FREE', key:'❌ LOCKED', status:'missing', domain:'Disaster' },
  { name:'GDELT 2.0 Articles', cost:'FREE', key:'NO KEY',    status:'live', domain:'Conflict' },
  { name:'NASA FIRMS',         cost:'FREE', key:'ENV ✅',    status:'live', domain:'Wildfire' },
  { name:'N2YO Satellites',    cost:'FREE', key:'ENV ✅',    status:'live', domain:'Orbital' },
  { name:'OpenWeatherMap',     cost:'FREE', key:'ENV ✅',    status:'live', domain:'Weather' },
  { name:'AVWX REST API',      cost:'FREE', key:'ENV ✅',    status:'live', domain:'Aviation WX' },
  { name:'GFW Events API',     cost:'FREE', key:'ENV ✅',    status:'live', domain:'Maritime' },
  { name:'ADS-B Exchange',     cost:'PAID', key:'ENV ✅',    status:'live', domain:'Military Air' },
  { name:'GDACS UN OCHA',      cost:'FREE', key:'NO KEY',    status:'live', domain:'Disaster' },
  { name:'MarineTraffic',      cost:'PAID', key:'❌ MISSING', status:'missing', domain:'Maritime AIS' },
  { name:'ACLED Conflict',     cost:'FREE', key:'❌ MISSING', status:'missing', domain:'Conflict' },
  { name:'AISStream.io',       cost:'FREE', key:'❌ MISSING', status:'missing', domain:'Maritime AIS' },
];

const TICKER = [
  '✅ LIVE: OpenSky ADS-B — global aircraft tracking — 30s cycle',
  '✅ LIVE: USGS Earthquake API — seismic events past 24h — M0+ resolution',
  '✅ LIVE: ISS position + SGP4 full orbit propagation — 5s cycle',
  '✅ LIVE: NASA FIRMS VIIRS — global wildfire detections — 15min cadence',
  '✅ LIVE: CelesTrak TLE — debris fields + military satellites + constellations (SGP4)',
  '✅ LIVE: GDELT 2.0 — conflict/military article-based intel — 48h window',
  '✅ LIVE: GDACS + ReliefWeb — UN disaster alert feeds',
  '✅ LIVE: Global Fishing Watch — fishing activity + dark fleet AIS gaps',
  '⚠ INTEL: Iran Theater — elevated activity — multiple strike reports',
  '⚠ INTEL: Ukraine Front — sustained kinetic operations — drone warfare escalation',
  '⚠ INTEL: Red Sea — Houthi maritime interdiction — shipping reroutes active',
  'SENTINEL OS v3.0 — 16+ LIVE OSINT LAYERS — MULTI-DOMAIN FUSION — 450+ CATALOGUED SOURCES',
];

/* ═══════════════════════════════════════════════════════════════
   FUSION STATISTICS ENGINE
═══════════════════════════════════════════════════════════════ */
function computeFusionStats(entities, threatBoard){
  const domains = {};
  entities.forEach(e => {
    const d = LAYERS[e.type]?.domain || 'UNKNOWN';
    if(!domains[d]) domains[d] = { count: 0, live: 0, threats: 0 };
    domains[d].count++;
    domains[d].live++;
  });
  threatBoard.forEach(t => {
    const d = LAYERS[t.entity.type]?.domain || 'UNKNOWN';
    if(domains[d]) domains[d].threats++;
  });
  const zoneActivity = THREAT_ZONES.map(z => {
    const nearby = entities.filter(e => {
      if(e.lat == null) return false;
      return haversine(e.lat, e.lon, z.lat, z.lon) < z.r;
    });
    const threats = threatBoard.filter(t => {
      const e = t.entity;
      if(e.lat == null) return false;
      return haversine(e.lat, e.lon, z.lat, z.lon) < z.r;
    });
    return { zone: z.name, type: z.type, entities: nearby.length, threats: threats.length, maxThreat: threats.length > 0 ? threats[0].score : 0 };
  }).filter(z => z.entities > 0 || z.threats > 0).sort((a,b) => b.maxThreat - a.maxThreat);
  return { domains, zoneActivity };
}

/* ═══════════════════════════════════════════════════════════════
   MAIN APPLICATION CONTROLLER
═══════════════════════════════════════════════════════════════ */
(function(){
  let map, markers = new Map(), layerGroups = {}, entities = [];
  let issTrackLine, issTrackBg, zoneCircles = [], zoneLabels = [], issTLE = null;
  let sceneReady = false, layerState = {}, selected = null;
  let apiStatus = {}, counts = {}, threatBoard = [], fusionStats = null;
  let tickIdx = 0, panel = 'layers', showZones = true;
  let lastFetchTime = null, cycleCount = 0;
  let gdeltConflictEvents = [], gdeltCyberEvents = [], gdeltNuclearEvents = [];

  Object.keys(LAYERS).forEach(k => { layerState[k] = true; apiStatus[k] = 'loading'; });
  // Disable some layers by default
  ['ships','avwx','milsat'].forEach(k => { layerState[k] = false; });

  const mapEl = document.getElementById('map');
  const appEl = document.getElementById('app');

  /* ── INIT MAP ── */
  function initMap(){
    map = L.map(mapEl, {
      center:[25,30], zoom:3, zoomControl:false,
      attributionControl:false, minZoom:2, maxZoom:18,
      worldCopyJump:true, preferCanvas:true
    });

    // Dark satellite basemap with labels overlay
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:18}).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',{subdomains:'abcd',maxZoom:18,opacity:0.7}).addTo(map);

    // Threat zone overlays
    const ztc = {conflict:'#ff2200',chokepoint:'#ff8800',flashpoint:'#ffcc00'};
    THREAT_ZONES.forEach(z => {
      const col = ztc[z.type]||'#ff4400';
      // Outer ring
      const outer = L.circle([z.lat,z.lon],{
        radius:z.r*1000,color:col,weight:0.6,opacity:0.35,
        fillColor:col,fillOpacity:0.02,dashArray:'5 8',interactive:false
      }).addTo(map);
      // Inner ring (50% radius)
      const inner = L.circle([z.lat,z.lon],{
        radius:z.r*500,color:col,weight:0.4,opacity:0.2,
        fill:false,dashArray:'3 6',interactive:false
      }).addTo(map);
      // Label
      const label = L.marker([z.lat,z.lon],{icon:L.divIcon({
        html:`<div style="color:${col};font-size:7px;font-family:'JetBrains Mono',monospace;white-space:nowrap;text-shadow:0 0 8px ${col}88;opacity:0.6;letter-spacing:1.5px;pointer-events:none;text-transform:uppercase">${z.name}</div>`,
        className:'',iconAnchor:[0,0]}),interactive:false,zIndexOffset:-1000}).addTo(map);
      zoneCircles.push(outer,inner);
      zoneLabels.push(label);
    });

    // ISS orbit track
    issTrackBg = L.polyline([],{color:'#ff660011',weight:1.5,dashArray:'3 6',opacity:0.3,interactive:false}).addTo(map);
    issTrackLine = L.polyline([],{color:'#ff6600',weight:1.2,dashArray:'8 4',opacity:0.6,interactive:false}).addTo(map);

    // Layer groups with clustering for dense layers
    const CLUSTERED = new Set(['aircraft','satellites','debris','seismic']);
    Object.keys(LAYERS).forEach(k => {
      if(CLUSTERED.has(k) && L.MarkerClusterGroup){
        const mcg = L.markerClusterGroup({
          maxClusterRadius: k==='seismic'?30:45,
          spiderfyOnMaxZoom:true,showCoverageOnHover:false,
          iconCreateFunction:cluster=>{
            const cnt=cluster.getChildCount(),col=LAYERS[k]?.color||'#fff',sz=cnt>100?34:cnt>30?28:22;
            return L.divIcon({
              html:`<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${col}15;border:1px solid ${col}55;display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;color:${col};font-size:9px;font-weight:600;backdrop-filter:blur(4px)">${cnt}</div>`,
              className:'',iconSize:[sz,sz],iconAnchor:[sz/2,sz/2]
            });
          }
        });
        if(layerState[k]) mcg.addTo(map);
        layerGroups[k] = mcg;
      } else {
        const lg = L.layerGroup();
        if(layerState[k]) lg.addTo(map);
        layerGroups[k] = lg;
      }
    });

    L.control.zoom({position:'bottomright'}).addTo(map);
    L.control.scale({position:'bottomright',imperial:false,maxWidth:120}).addTo(map);

    sceneReady = true;
  }

  /* ── MARKER MANAGEMENT ── */
  function upsertMarker(e){
    if(!sceneReady)return;
    const grp=layerGroups[e.type];if(!grp)return;
    const threat=e._threat||scoreThreat(e);e._threat=threat;
    const isEmg=e.emergency===true,col=LAYERS[e.type]?.color||'#ffffff';
    const sz=e.type==='iss'?24:['military','milsat'].includes(e.type)?14:['satellites','debris'].includes(e.type)?11:
      e.type==='nuclear'?16:e.type==='conflict'?13:isEmg?18:e.type==='cyber'?12:10;
    const html=markerSVG(isEmg?'#ff0033':e.type==='nuclear'?'#ff00ff':col,sz,isEmg,threat.level);
    const icon=L.divIcon({html,className:'',iconSize:[sz,sz],iconAnchor:[sz/2,sz/2]});
    if(markers.has(e.id)){
      const mk=markers.get(e.id);mk.setLatLng([e.lat,e.lon]);mk.setIcon(icon);
    } else {
      const mk=L.marker([e.lat,e.lon],{icon,zIndexOffset:isEmg?2000:e.type==='nuclear'?1500:0}).on('click',()=>{selected=e;renderUI()});
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
    fusionStats=computeFusionStats(entities,threatBoard);
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
      apiStatus.aircraft='live';apiStatus.military='live'}catch(e){apiStatus.aircraft='error'}
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
      const ents=(d?.ac||[]).slice(0,100).filter(a=>a.lat&&a.lon).map((a,i)=>{
        const cs=a.flight?.trim()||a.r||'MIL:'+a.hex,milInfo=classMilCS(cs);
        return{id:'mil_adsb_'+i,type:'military',lat:a.lat,lon:a.lon,name:cs,
          details:{ICAO_HEX:a.hex||'—',ALTITUDE:a.alt_baro?a.alt_baro+' ft':'—',
            SPEED:a.gs?Math.round(a.gs)+' kts':'—',HEADING:a.track?Math.round(a.track)+'°':'—',
            SQUAWK:a.squawk||'—',TYPE:a.t||'—',REGISTRATION:a.r||'—',
            ...(milInfo?{MIL_OPERATOR:milInfo.op,MIL_ROLE:milInfo.role,AC_TYPE:milInfo.acType,NATO_ROLE:milInfo.nato||'—'}:{}),
            SOURCE:'ADS-B Exchange (LIVE ✅)'}};
      });
      if(ents.length){replaceLive('mil_adsb','military',ents);apiStatus.military='live'}
      else apiStatus.military='error'}catch(e){apiStatus.military='error'}
  }

  async function fetchGDELTIntel(){
    try{
      const [cR, mR, nR, cyR] = await Promise.allSettled([
        intelFetch('conflict'), intelFetch('maritime'), intelFetch('nuclear'), intelFetch('cyber')
      ]);
      const conflictEnts=[];
      if(cR.status==='fulfilled'&&cR.value?.events){
        gdeltConflictEvents=cR.value.events;
        parseGDELTIntel(cR.value,'conflict').forEach(e=>conflictEnts.push(e));
      }
      if(mR.status==='fulfilled'&&mR.value?.events){
        parseGDELTIntel(mR.value,'conflict').forEach(e=>conflictEnts.push({...e,id:'m_'+e.id}));
      }
      if(conflictEnts.length){replaceLive('gdelt_','conflict',conflictEnts);apiStatus.conflict='live'}
      else apiStatus.conflict='error';

      if(nR.status==='fulfilled'&&nR.value?.events){
        gdeltNuclearEvents=nR.value.events;
        const nEnts=parseGDELTIntel(nR.value,'nuclear');
        if(nEnts.length){replaceLive('gdelt_nuclear','nuclear',nEnts);apiStatus.nuclear='live'}
        else apiStatus.nuclear='error';
      }
      if(cyR.status==='fulfilled'&&cyR.value?.events){
        gdeltCyberEvents=cyR.value.events;
        const cEnts=parseGDELTIntel(cyR.value,'cyber');
        if(cEnts.length){replaceLive('gdelt_cyber','cyber',cEnts);apiStatus.cyber='live'}
        else apiStatus.cyber='error';
      }
    }catch(e){apiStatus.conflict='error'}
  }

  async function fetchGDACS(){
    try{
      const gR = await proxy('gdacs');
      if(!isErr(gR)){
        const ents=parseGDACS(gR);
        if(ents.length){replaceLive('gdacs_','disasters',ents);apiStatus.disasters='live'}
        else apiStatus.disasters='error';
      } else {apiStatus.disasters='error'}
    }catch(e){apiStatus.disasters='error'}
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
    const fetches = [
      fetch(D.CTRAK_FENGYUN).then(r=>r.json()).catch(()=>[]),
      fetch(D.CTRAK_COSMOS).then(r=>r.json()).catch(()=>[]),
      fetch(D.CTRAK_IRIDIUM).then(r=>r.json()).catch(()=>[]),
      fetch(D.CTRAK_STATIONS).then(r=>r.json()).catch(()=>[]),
      fetch(D.CTRAK_STARLINK).then(r=>r.json()).catch(()=>[]),
      fetch(D.CTRAK_GPS).then(r=>r.json()).catch(()=>[]),
      fetch(D.CTRAK_GLONASS).then(r=>r.json()).catch(()=>[]),
      fetch(D.CTRAK_MILITARY).then(r=>r.json()).catch(()=>[]),
    ];
    const [fy,cos,ir,sta,sl,gps,glo,mil] = await Promise.allSettled(fetches);

    const de=[];
    if(fy.status==='fulfilled'&&Array.isArray(fy.value))parseCelesTrak(fy.value,'debris',30).forEach(e=>de.push(e));
    if(cos.status==='fulfilled'&&Array.isArray(cos.value))parseCelesTrak(cos.value,'debris',20).forEach(e=>de.push({...e,id:e.id+'_c'}));
    if(ir.status==='fulfilled'&&Array.isArray(ir.value))parseCelesTrak(ir.value,'debris',20).forEach(e=>de.push({...e,id:e.id+'_i'}));
    if(de.length){replaceLive('debris_ctk','debris',de);apiStatus.debris='live'}

    const sats=[];
    if(sta.status==='fulfilled'&&Array.isArray(sta.value))parseCelesTrak(sta.value,'satellites',20).forEach(e=>sats.push({...e,id:'sta_'+e.id}));
    if(sl.status==='fulfilled'&&Array.isArray(sl.value))parseCelesTrak(sl.value,'satellites',60).forEach(e=>sats.push({...e,id:'sl_'+e.id}));
    if(gps.status==='fulfilled'&&Array.isArray(gps.value))parseCelesTrak(gps.value,'satellites',32).forEach(e=>sats.push({...e,id:'gps_'+e.id}));
    if(glo.status==='fulfilled'&&Array.isArray(glo.value))parseCelesTrak(glo.value,'satellites',24).forEach(e=>sats.push({...e,id:'glo_'+e.id}));
    if(sats.length){replaceLive('sta_','satellites',sats.filter(e=>e.id.startsWith('sta_')));replaceLive('sl_','satellites',sats.filter(e=>e.id.startsWith('sl_')));replaceLive('gps_','satellites',sats.filter(e=>e.id.startsWith('gps_')));replaceLive('glo_','satellites',sats.filter(e=>e.id.startsWith('glo_')))}
    apiStatus.satellites='live';

    // Military satellites
    if(mil.status==='fulfilled'&&Array.isArray(mil.value)){
      const ms=parseCelesTrak(mil.value,'milsat',40);
      if(ms.length){replaceLive('milsat_','milsat',ms);apiStatus.milsat='live'}
    }
  }

  async function fetchAll(){
    cycleCount++;
    lastFetchTime=new Date();
    await Promise.allSettled([fetchOpenSky(),fetchUSGS(),fetchISS(),fetchFIRMS(),fetchOWM(),fetchN2YO(),fetchGFW(),fetchAVWX(),fetchMilitary(),fetchGDELTIntel(),fetchGDACS()]);
    refreshCounts();refreshThreat();renderUI();
  }

  /* ── LAYER/ZONE VISIBILITY ── */
  function toggleLayer(k){
    layerState[k]=!layerState[k];
    const grp=layerGroups[k];if(!grp||!map)return;
    if(layerState[k]){if(!map.hasLayer(grp))grp.addTo(map)}else{if(map.hasLayer(grp))grp.remove()}
    renderUI();
  }
  function toggleZones(){
    showZones=!showZones;
    [...zoneCircles,...zoneLabels].forEach(c=>{if(showZones){if(!map.hasLayer(c))c.addTo(map)}else{if(map.hasLayer(c))c.remove()}});
    renderUI();
  }
  function flyTo(e){selected=e;renderUI();if(map&&e.lat!=null)map.flyTo([e.lat,e.lon],Math.max(map.getZoom(),6),{duration:1})}

  /* ═══════════════════════════════════════════════════════════════
     UI RENDERER — Palantir/Beholder-class dark ops interface
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

    let h = '';

    // ── HEADER ──
    h += '<div class="hdr">';
    h += '<div style="display:flex;align-items:center;gap:10px;min-width:0">';
    h += '<div style="width:8px;height:8px;border-radius:50%;background:#00ff88;box-shadow:0 0 14px #00ff88;animation:pulse 2s infinite;flex-shrink:0"></div>';
    h += '<span class="orb" style="color:#00ff88;font-size:14px;letter-spacing:6px;font-weight:700;flex-shrink:0">SENTINEL</span>';
    h += '<span style="color:#0d2535;font-size:10px;margin:0 1px">|</span>';
    h += '<span style="color:#1a3a50;font-size:7px;letter-spacing:2.5px" class="hdr-stats">GLOBAL SITUATIONAL AWARENESS</span>';

    // Zone toggle
    h += `<span onclick="window._toggleZones()" style="color:${showZones?'#ffcc00':'#1a3040'};font-size:7px;cursor:pointer;letter-spacing:1px;background:${showZones?'rgba(255,204,0,0.06)':'transparent'};border:1px solid ${showZones?'#ffcc0033':'#0a2040'};padding:2px 7px;border-radius:2px;user-select:none;flex-shrink:0" class="hdr-stats">◉ ZONES</span>`;

    // Emergency badge
    if(emergencies.length>0){
      h+=`<div onclick="window._setPanel('threat')" style="display:flex;align-items:center;gap:5px;background:rgba(255,0,51,0.1);border:1px solid #ff003355;border-radius:3px;padding:2px 8px;cursor:pointer;flex-shrink:0;animation:pulse-fast 0.8s infinite">`;
      h+=`<div style="width:6px;height:6px;border-radius:50%;background:#ff0033"></div>`;
      h+=`<span style="color:#ff3355;font-size:8px;letter-spacing:2px;font-weight:700">⚠ ${emergencies.length} ALERT</span></div>`;
    }
    h += '</div>';

    // Status dots
    h += '<div style="display:flex;gap:10px;align-items:center" class="hdr-stats">';
    ['aircraft','seismic','iss','wildfires','debris','conflict','disasters','nuclear','cyber'].forEach(k=>{
      h+=`<div style="display:flex;align-items:center;gap:3px"><div style="width:5px;height:5px;border-radius:50%;background:${dotCol(k)};box-shadow:0 0 4px ${dotCol(k)}"></div><span style="color:#0d2030;font-size:6.5px;letter-spacing:0.8px">${k.slice(0,4).toUpperCase()}</span></div>`;
    });
    h += `<span style="color:#1a3040;font-size:7.5px;letter-spacing:1px;border-left:1px solid #0a2040;padding-left:10px;font-family:'JetBrains Mono',monospace">${clock}</span>`;
    h += '</div>';

    h += `<div style="display:flex;gap:5px;align-items:center;flex-shrink:0"><span style="color:#0d2030;font-size:7px" class="hdr-stats">TRACKING</span><span class="orb" style="color:#00ff88;font-size:15px;font-weight:700">${total.toLocaleString()}</span></div>`;
    h += '</div>';

    // ── CLASSIFICATION BANNER ──
    h += '<div class="classif-banner">UNCLASSIFIED // OPEN SOURCE INTELLIGENCE // FOR OFFICIAL USE ONLY</div>';

    // ── LEFT PANEL ──
    h += '<div class="lp">';
    // Tabs
    h += '<div style="display:flex;border-bottom:1px solid var(--border-dim);flex-shrink:0">';
    [['layers','LAYERS'],['threat','☢ '+critCount],['fusion','FUSION'],['apis','APIS']].forEach(([id,label])=>{
      h+=`<div class="tab${panel===id?' active':''}" onclick="window._setPanel('${id}')">${label}</div>`;
    });
    h += '</div>';

    if(panel==='layers'){
      h += '<div style="overflow-y:auto;flex:1">';
      h += '<div style="padding:6px 14px 4px;color:var(--text-dim);font-size:6px;letter-spacing:2px">INTELLIGENCE DOMAINS · CLICK TO TOGGLE</div>';
      let currentDomain = '';
      Object.entries(LAYERS).forEach(([k,cfg])=>{
        if(cfg.domain !== currentDomain){
          currentDomain = cfg.domain;
          h += `<div style="padding:5px 14px 2px;color:var(--accent-cyan);font-size:6px;letter-spacing:2.5px;opacity:0.4;border-top:1px solid var(--border-dim);margin-top:2px">${currentDomain}</div>`;
        }
        const st=apiStatus[k],isLive=st==='live',isE=st==='error',on=layerState[k];
        h+=`<div class="lr" onclick="window._toggleLayer('${k}')" style="display:flex;align-items:center;gap:8px;padding:5px 14px;cursor:pointer;opacity:${on?1:0.22};border-bottom:1px solid #030b14;border-left:2px solid transparent">`;
        h+=`<div style="width:8px;height:8px;border-radius:50%;flex-shrink:0;background:${on?cfg.color:'#0a1520'};box-shadow:${on?'0 0 6px '+cfg.color+'66':'none'}"></div>`;
        h+='<div style="flex:1;min-width:0">';
        h+='<div style="display:flex;justify-content:space-between;align-items:center">';
        h+=`<span style="color:var(--text-primary);font-size:8px;font-weight:500">${cfg.icon} ${cfg.label}</span>`;
        h+=`<div style="display:flex;align-items:center;gap:4px"><div style="width:4px;height:4px;border-radius:50%;background:${dotCol(k)}"></div><span style="color:${on?cfg.color:'#0d2030'};font-size:9px;font-weight:600">${counts[k]||0}</span></div></div>`;
        h+='<div style="display:flex;gap:4px;margin-top:2px">';
        if(isLive)h+='<span class="status-pill status-live">LIVE</span>';
        if(isE)h+='<span class="status-pill status-err">ERR</span>';
        if(!isLive&&!isE)h+='<span class="status-pill status-loading">WAIT</span>';
        h+=`<span style="color:var(--text-dim);font-size:5.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${cfg.src}</span>`;
        h+='</div></div></div>';
      });
      h += '</div>';
    }

    if(panel==='threat'){
      h += '<div style="overflow-y:auto;flex:1">';
      h += '<div style="padding:8px 14px 6px;border-bottom:1px solid var(--border-dim)">';
      h += '<div style="color:var(--text-tertiary);font-size:6.5px;letter-spacing:2px;margin-bottom:8px">GLOBAL THREAT ASSESSMENT</div>';
      // Threat summary cards
      h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px">';
      [['CRIT',critCount,'#ff0033'],['HIGH',highCount,'#ff7700'],['MED',medCount,'#ffcc00']].forEach(([l,c,col])=>{
        h+=`<div style="background:${col}08;border:1px solid ${col}22;border-radius:3px;padding:6px 4px;text-align:center">`;
        h+=`<div style="color:${col};font-size:12px;font-weight:700;font-family:var(--font-display)">${c}</div>`;
        h+=`<div style="color:${col}88;font-size:5.5px;letter-spacing:1.5px;margin-top:2px">${l}</div></div>`;
      });
      h += '</div>';

      // Global threat meter
      const globalThreat = Math.min(100, Math.round((critCount*12 + highCount*5 + medCount*2)));
      const globalLvl = getThreatLevel(globalThreat);
      h += `<div style="margin-top:8px"><div style="display:flex;justify-content:space-between;margin-bottom:3px"><span style="color:var(--text-tertiary);font-size:6px;letter-spacing:1px">GLOBAL THREAT INDEX</span><span style="color:${globalLvl.col};font-size:8px;font-weight:600">${globalThreat}/100</span></div>`;
      h += `<div class="threat-meter"><div class="threat-meter-fill" style="width:${globalThreat}%;background:${globalLvl.col}"></div></div></div>`;
      h += '</div>';

      // Threat list
      threatBoard.forEach((t,idx)=>{
        const isCrit=t.level==='CRITICAL';
        h+=`<div class="al${isCrit?' threat-crit':t.level==='HIGH'?' threat-high':t.level==='MEDIUM'?' threat-med':''}" onclick="window._flyTo(${idx})" style="padding:5px 14px;border-bottom:1px solid #030b14;cursor:pointer">`;
        h+='<div style="display:flex;justify-content:space-between;align-items:center;gap:6px">';
        h+=`<div style="display:flex;align-items:center;gap:5px;min-width:0;flex:1"><div style="width:6px;height:6px;border-radius:50%;flex-shrink:0;background:${t.col}"></div>`;
        h+=`<span style="color:${isCrit?'#ff5566':'#5a8aaa'};font-size:7px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.entity.name}</span></div>`;
        h+=`<div style="display:flex;align-items:center;gap:4px;flex-shrink:0"><span style="color:${t.col}88;font-size:5.5px;letter-spacing:1px">${t.level}</span><span style="color:${t.col};font-size:9px;font-weight:700">${t.score}</span></div></div>`;
        if(t.reasons[0])h+=`<div style="color:var(--text-dim);font-size:5.5px;margin-top:2px;padding-left:11px">· ${t.reasons[0]}</div>`;
        h+='</div>';
      });
      h += '</div>';
    }

    if(panel==='fusion'){
      h += '<div style="overflow-y:auto;flex:1">';
      h += '<div style="padding:8px 14px 6px;border-bottom:1px solid var(--border-dim)">';
      h += '<div style="color:var(--text-tertiary);font-size:6.5px;letter-spacing:2px;margin-bottom:6px">MULTI-DOMAIN FUSION ENGINE</div>';
      h += `<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px"><span style="color:var(--accent-green);font-size:7px">● ACTIVE</span><span style="color:var(--text-dim);font-size:6px">CYCLE ${cycleCount} · ${lastFetchTime?pad(lastFetchTime.getUTCHours())+':'+pad(lastFetchTime.getUTCMinutes())+':'+pad(lastFetchTime.getUTCSeconds())+' UTC':'—'}</span></div>`;
      h += '</div>';

      // Domain breakdown
      if(fusionStats){
        h += '<div style="padding:6px 14px 2px;color:var(--text-dim);font-size:6px;letter-spacing:2px">DOMAIN BREAKDOWN</div>';
        Object.entries(fusionStats.domains).sort((a,b)=>b[1].count-a[1].count).forEach(([domain,stats])=>{
          h+=`<div style="padding:4px 14px;border-bottom:1px solid #030b14;display:flex;justify-content:space-between;align-items:center">`;
          h+=`<span style="color:var(--text-secondary);font-size:7.5px">${domain}</span>`;
          h+=`<div style="display:flex;gap:8px"><span style="color:var(--accent-cyan);font-size:8px;font-weight:600">${stats.count}</span>`;
          if(stats.threats>0)h+=`<span style="color:var(--accent-red);font-size:7px">⚠${stats.threats}</span>`;
          h+=`</div></div>`;
        });

        // Zone activity
        h += '<div style="padding:8px 14px 2px;color:var(--text-dim);font-size:6px;letter-spacing:2px;border-top:1px solid var(--border-dim);margin-top:4px">ZONE ACTIVITY MONITOR</div>';
        fusionStats.zoneActivity.forEach(z=>{
          const threatCol = z.maxThreat>=75?'#ff0033':z.maxThreat>=50?'#ff7700':z.maxThreat>=28?'#ffcc00':'#44aaff';
          h+=`<div style="padding:4px 14px;border-bottom:1px solid #030b14;display:flex;justify-content:space-between;align-items:center">`;
          h+=`<div style="min-width:0;flex:1"><span style="color:var(--text-secondary);font-size:7px">${z.zone}</span>`;
          h+=`<span style="color:var(--text-dim);font-size:5.5px;margin-left:6px">${z.type.toUpperCase()}</span></div>`;
          h+=`<div style="display:flex;gap:6px;align-items:center"><span style="color:var(--accent-cyan);font-size:7px">${z.entities}</span>`;
          if(z.threats>0)h+=`<span style="color:${threatCol};font-size:8px;font-weight:700">${z.maxThreat}</span>`;
          h+=`</div></div>`;
        });
      }
      h += '</div>';
    }

    if(panel==='apis'){
      h += '<div style="overflow-y:auto;flex:1">';
      h += '<div style="padding:6px 14px 4px;color:var(--text-dim);font-size:6px;letter-spacing:2px">DATA SOURCES — '+API_REF.length+' FEEDS</div>';
      API_REF.forEach(a=>{
        const sc=a.status==='live'?'#00ff88':a.status==='missing'?'#ff4455':'#4488aa';
        h+=`<div style="padding:5px 14px;border-bottom:1px solid #030b14">`;
        h+='<div style="display:flex;justify-content:space-between;align-items:center">';
        h+=`<div style="min-width:0"><span style="color:var(--text-secondary);font-size:7.5px">${a.name}</span>`;
        h+=`<span style="color:var(--text-dim);font-size:5.5px;margin-left:6px">${a.domain}</span></div>`;
        h+=`<div style="display:flex;gap:6px;align-items:center"><span style="color:${a.cost==='FREE'?'#00aa55':'#ff8844'};font-size:6px;letter-spacing:0.5px">${a.cost}</span>`;
        h+=`<span style="color:${sc};font-size:6.5px">${a.key}</span></div></div></div>`;
      });
      h += '</div>';
    }
    h += '</div>'; // end left panel

    // ── RIGHT PANEL (Entity Inspector) ──
    if(selected){
      const threat=selected._threat||scoreThreat(selected);
      const layerCfg=LAYERS[selected.type]||{};
      h += '<div class="rp">';
      // Inspector header
      h += '<div style="padding:14px 16px 10px;border-bottom:1px solid var(--border-dim)">';
      h += '<div style="display:flex;justify-content:space-between;align-items:center">';
      h += `<div style="display:flex;align-items:center;gap:8px"><div style="width:10px;height:10px;border-radius:50%;background:${layerCfg.color||'#fff'};box-shadow:0 0 6px ${layerCfg.color||'#fff'}44"></div>`;
      h += `<span style="color:${layerCfg.color||'#fff'};font-size:8px;letter-spacing:2px;font-weight:600">${layerCfg.label||selected.type}</span>`;
      h += '<span class="status-pill status-live">LIVE</span></div>';
      h += `<span class="cb" onclick="window._closeInspector()" style="color:var(--text-tertiary);font-size:14px;cursor:pointer;padding:2px 4px">✕</span></div>`;

      // Threat assessment
      if(threat.score>=8){
        h+=`<div style="margin-top:10px;padding:8px 12px;background:${threat.bg};border:1px solid ${threat.col}33;border-radius:3px">`;
        h+=`<div style="display:flex;justify-content:space-between;align-items:center"><span style="color:${threat.col};font-size:8px;font-weight:700;letter-spacing:1px">THREAT: ${threat.level}</span><span style="color:${threat.col};font-size:11px;font-weight:700;font-family:var(--font-display)">${threat.score}/100</span></div>`;
        h+=`<div class="threat-meter" style="margin-top:5px"><div class="threat-meter-fill" style="width:${threat.score}%;background:${threat.col}"></div></div>`;
        threat.reasons.slice(0,4).forEach(r=>{h+=`<div style="color:${threat.col}99;font-size:6px;margin-top:3px">· ${r}</div>`});
        h+='</div>';
      }

      // Emergency squawk
      if(selected.emergency&&selected.squawkInfo){
        h+=`<div style="margin-top:8px;padding:7px 10px;background:rgba(255,0,51,0.1);border:1px solid #ff003355;border-radius:3px;animation:borderGlow 2s infinite">`;
        h+=`<div style="color:#ff3355;font-size:9px;font-weight:700">⚠ SQUAWK ${selected.squawk} — ${selected.squawkInfo.label}</div>`;
        h+=`<div style="color:#cc2244;font-size:6.5px;margin-top:3px">${selected.squawkInfo.desc}</div></div>`;
      }

      // Entity name and coordinates
      h+=`<div style="color:var(--text-primary);font-size:12px;margin-top:10px;word-break:break-word;font-weight:500">${selected.name}</div>`;
      h+=`<div style="color:var(--text-tertiary);font-size:7px;margin-top:6px;font-family:var(--font-mono)">${selected.lat?.toFixed(5)}° ${selected.lat>=0?'N':'S'} · ${Math.abs(selected.lon)?.toFixed(5)}° ${selected.lon>=0?'E':'W'}</div>`;
      h+='</div>';

      // Detail fields
      h+='<div style="padding:6px 16px 14px">';
      Object.entries(selected.details||{}).forEach(([k,v])=>{
        const isURL = typeof v === 'string' && (v.startsWith('http://') || v.startsWith('https://'));
        h+='<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #030b14;gap:8px">';
        h+=`<span style="color:var(--text-dim);font-size:6.5px;flex-shrink:0;letter-spacing:0.5px">${k}</span>`;
        if(isURL){
          h+=`<a href="${v}" target="_blank" style="color:var(--accent-cyan);font-size:7px;text-align:right;text-decoration:none;opacity:0.7">↗ Open</a>`;
        } else {
          h+=`<span style="color:${k==='SOURCE'?'var(--text-dim)':'var(--text-secondary)'};font-size:7px;text-align:right;word-break:break-all">${v}</span>`;
        }
        h+='</div>';
      });
      h+='</div></div>';
    }

    // ── BOTTOM TICKER (desktop) ──
    h += '<div class="btk btk-desktop">';
    h += '<div style="flex-shrink:0;padding:0 14px;border-right:1px solid var(--border-dim);display:flex;align-items:center;gap:7px">';
    h += '<div style="width:5px;height:5px;border-radius:50%;background:#ff3355;box-shadow:0 0 8px #ff3355;animation:pulse 1s infinite"></div>';
    h += '<span style="color:#ff3355;font-size:7px;letter-spacing:3px;font-weight:600">INTEL</span></div>';
    h += `<div style="padding:0 18px;color:var(--text-tertiary);font-size:7.5px;animation:ticker 5s ease forwards;white-space:nowrap;flex:1">${TICKER[tickIdx]}</div>`;
    h += '<div style="padding:0 14px;display:flex;gap:14px;flex-shrink:0;border-left:1px solid var(--border-dim)">';
    ['SCROLL:ZOOM','DRAG:PAN','CLICK:INSPECT'].forEach(t=>{h+=`<span style="color:var(--text-dim);font-size:6.5px;letter-spacing:0.5px">${t}</span>`});
    h += `<span style="color:var(--text-dim);font-size:6.5px;border-left:1px solid var(--border-dim);padding-left:10px">v3.0</span>`;
    h += '</div></div>';

    // ── MOBILE BOTTOM BAR ──
    h += '<div class="mob-bar" style="display:none;position:absolute;bottom:0;left:0;right:0;height:48px;background:rgba(4,14,24,0.98);border-top:1px solid var(--border-dim);align-items:center;justify-content:space-around;z-index:500">';
    [['layers','🗺','MAP','var(--accent-cyan)'],['threat','☢','THREAT',critCount?'#ff3355':'var(--text-tertiary)'],['fusion','⚡','FUSION','var(--text-tertiary)'],['apis','📡','APIS','var(--text-tertiary)']].forEach(([id,icon,label,col])=>{
      h+=`<div onclick="window._setPanel('${id}')" style="display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;padding:4px 10px">`;
      h+=`<span style="font-size:16px">${icon}</span><span style="color:${col};font-size:5.5px;letter-spacing:1px">${label}</span></div>`;
    });
    h += '</div>';

    appEl.innerHTML = h;
  }

  /* ── GLOBAL EVENT HANDLERS ── */
  window._toggleLayer = toggleLayer;
  window._toggleZones = toggleZones;
  window._setPanel = p => { panel=p; renderUI(); };
  window._flyTo = idx => { if(threatBoard[idx]) flyTo(threatBoard[idx].entity); };
  window._closeInspector = () => { selected=null; renderUI(); };

  /* ── BOOT SEQUENCE ── */
  function boot(){
    console.log('%c SENTINEL OS v3.0 ', 'background:#00ff88;color:#020a12;font-weight:bold;font-size:14px;padding:4px 8px;border-radius:3px');
    console.log('%c Global Situational Awareness Platform ', 'color:#00d4ff;font-size:10px');
    console.log('%c 16+ Live OSINT Layers · Multi-Domain Fusion · Edge Runtime ', 'color:#1a3a50;font-size:9px');

    initMap();
    renderUI();

    // Staggered data loading to avoid rate limits
    fetchAll();
    setTimeout(() => fetchCelesTrak(), 2000);
    setTimeout(() => fetchISSTrack(), 4000);

    // Polling intervals
    setInterval(fetchAll, 30000);         // All feeds: 30s
    setInterval(fetchISS, 5000);          // ISS position: 5s
    setInterval(fetchCelesTrak, 180000);  // TLE propagation: 3min
    setInterval(fetchISSTrack, 3600000);  // ISS TLE refresh: 1hr
    setInterval(updateISSTrack, 60000);   // ISS track update: 1min
    setInterval(() => { tickIdx = (tickIdx+1) % TICKER.length; renderUI(); }, 5000);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
