import React, { useState, useEffect } from 'react';
import { Printer, Check, Activity, TrendingUp, Search, Download, CheckCircle, BarChart3, Users, Zap, PieChart, Building2, ChevronDown, ChevronUp, MapPin, Star, TrendingDown, FileText, ExternalLink, DollarSign, ArrowLeft, Upload, X, Plus, Minus, Trash2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import facilityDataJson from './facility_data.json';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const ADMIN_PASSWORD      = 'WalkTalkWin';
const MASTER_DOR_PASSWORD = 'StrongSteps';
const RESOURCES_PIN       = '147320';
const LEADERSHIP_EMAILS   = ['asha@spyglasshc.com', 'doug@spyglasshc.com'];
const WEEKLY_REPORT_LINK  = 'https://forms.office.com/Pages/ResponsePage.aspx?id=GnwJbN56CESxFanmFuyVBuSsEiTDUNlHs0MWhL_En4tURFpRU0xLOTNUVllEQUZBQVJUUkVMMEVYTC4u';

// Building-specific goal overrides for outlier buildings
const BUILDING_GOALS = {
  'Cedarwood PA':   { productivity: 80, cpm: 1.55, mode: 2, medB: 30 },
  'Bridgewood PA':  { productivity: 80, cpm: 1.55, mode: 2, medB: 30 },
  'Morgan Hill HC': { productivity: 80, cpm: 1.55, mode: 2, medB: 30 },
  'Manresa HC':     { productivity: 80, cpm: 1.55, mode: 2, medB: 30 },
};
const getGoals = (facility) => BUILDING_GOALS[facility] || { productivity: 84, cpm: 1.45, mode: 4, medB: 50 };


const DOR_PASSWORDS = {
  'The Win Post Acute':      'WinningSteps',
  'Mountain View HC':        'MountainStride',
  'Morgan Hill HC':          'HillClimber',
  'Los Altos Post Acute':    'AltosRise',
  'Gilroy HC':               'GilroyGrowth',
  'Manresa HC':              'ManresaMoves',
  'PAC Hills Post Acute':    'HillsideHeal',
  'Pac Coast PA':            'CoastalCare',
  'Camino Ridge Post Acute': 'RidgeWalk',
  'Eden HC':                 'EdenElevate',
  'West Shore PA':           'ShoreStrong',
  'Golden Harbor HC':        'HarborHealth',
  'Belmont HC':              'BelmontBoost',
  'Palo Alto Post Acute':    'AltoPace',
  'Bridgewood PA':           'BridgeSteps',
  'Cedarwood PA':            'CedarStride',
  'Capital PA':              'CapitalCare',
  'Blue Oak Post Acute':     'BlueOakSteps',
};

// DOR email addresses — fill in each DOR's email
const DOR_EMAILS = {
  'The Win Post Acute':      'vrutkevich@thewinpa.com',
  'Mountain View HC':        'epinkerton@mvhealthcare.com',
  'Morgan Hill HC':          'hgallardo@morganhillhc.com',
  'Los Altos Post Acute':    'mperalta@losaltospa.com',
  'Gilroy HC':               'ngoraksh@gilroyhealthcare.com',
  'Manresa HC':              'oaranzaso@manresahc.com',
  'PAC Hills Post Acute':    'kgagni@pachillspa.com',
  'Pac Coast PA':            'ksarceno@paccoastmanor.com',
  'Camino Ridge Post Acute': 'agayoso@caminoridgepa.com',
  'Eden HC':                 'jjacob@edenhc.com',
  'West Shore PA':           'msidelnikov@westshorepa.com',
  'Golden Harbor HC':        'aajgaonkar@goldenharborhealthcare.com',
  'Belmont HC':              'rdelfino@belmonthcc.com',
  'Palo Alto Post Acute':    'lton@papostacute.com',
  'Bridgewood PA':           'vamen@cedarwoodpostacute.com',
  'Cedarwood PA':            'vamen@cedarwoodpostacute.com',
  'Capital PA':              'dperkins@capitalpostacute.com',
  'Blue Oak Post Acute':     'asha@spyglasshc.com',
};

// ─── PURE HELPERS (no hooks) ──────────────────────────────────────────────────
// Always show MTD value, fall back to week value
const mtd = (rec, mtdKey, wkKey) => parseFloat(rec?.[mtdKey] || rec?.[wkKey] || 0);

// Score a record 0-4 across all 4 goals
const scoreRec = (rec, facility=null) => {
  if (!rec) return 0;
  const g = facility ? getGoals(facility) : { productivity:84, cpm:1.45, mode:4, medB:50 };
  let s = 0;
  if (mtd(rec, 'productivityMTD',    'productivity')    >= g.productivity)  s++;
  if (mtd(rec, 'cpmMTD',             'cpm')             <= g.cpm)           s++;
  const elig = rec.medBEligible || 0, cas = rec.medBCaseload || 0;
  if (elig > 0 && cas / elig >= g.medB/100) s++;
  if (parseFloat(mtd(rec, 'modeOfTreatmentMTD', 'modeOfTreatment').toFixed(1)) >= g.mode) s++;
  return s;
};

const prodColor  = (v, goal=84)   => v >= goal   ? 'text-emerald-300' : 'text-rose-300';
const cpmColor   = (v, goal=1.45) => Math.trunc(v*100)/100 <= goal ? 'text-emerald-300' : 'text-rose-300';
const modeColor  = (v, goal=4)    => v >= goal    ? 'text-emerald-300' : 'text-amber-300';
const prodBg     = (v, goal=84) => v >= goal ? 'bg-emerald-500/20 border-emerald-400/50' : 'bg-rose-500/20 border-rose-400/50';
const cpmBg      = (v, goal=1.45) => Math.trunc(v*100)/100 <= goal ? 'bg-emerald-500/20 border-emerald-400/50' : 'bg-rose-500/20 border-rose-400/50';
const shortName  = n => n.replace(' Post Acute','').replace(' Healthcare Center','');
const scoreBadge = s => s >= 3 ? 'bg-emerald-500/20 text-emerald-300' : s === 2 ? 'bg-yellow-500/20 text-yellow-300' : 'bg-rose-500/20 text-rose-300';

// ─── HEP GENERATOR HELPERS ─────────────────────────────────────────────────
const T = "#0D9488";   // teal - figure color
const O = "#E07B3C";   // orange - arrow color
const SW = 2.8;        // strokeWidth

// ── Arrow helper ──────────────────────────────────────────────────────────────
const Arrow = ({ x1,y1,x2,y2,color=O }) => {
  const dx=x2-x1, dy=y2-y1, len=Math.sqrt(dx*dx+dy*dy);
  const ux=dx/len, uy=dy/len;
  const hx=x2-ux*7, hy=y2-uy*7;
  const lx=-uy*3.5, ly=ux*3.5;
  return (
    <g stroke={color} fill={color} strokeWidth={1.5} strokeLinecap="round">
      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={2}/>
      <polygon points={`${x2},${y2} ${hx+lx},${hy+ly} ${hx-lx},${hy-ly}`}/>
    </g>
  );
};

// ── Stick figures ──────────────────────────────────────────────────────────────
const SupineFig = ({arrows=[]}) => (
  <svg viewBox="0 0 130 90" className="w-full h-full">
    {/* lying body */}
    <circle cx="20" cy="45" r="9" stroke={T} fill="none" strokeWidth={SW}/>
    <line x1="29" y1="45" x2="80" y2="45" stroke={T} strokeWidth={SW} strokeLinecap="round"/>
    {/* arms */}
    <line x1="50" y1="45" x2="50" y2="28" stroke={T} strokeWidth={SW} strokeLinecap="round"/>
    <line x1="60" y1="45" x2="62" y2="28" stroke={T} strokeWidth={SW} strokeLinecap="round"/>
    {/* legs */}
    <line x1="80" y1="45" x2="110" y2="38" stroke={T} strokeWidth={SW} strokeLinecap="round"/>
    <line x1="80" y1="45" x2="110" y2="52" stroke={T} strokeWidth={SW} strokeLinecap="round"/>
    {arrows.map((a,i)=><Arrow key={i} {...a}/>)}
  </svg>
);

const StandFig = ({arrows=[],legL=null,legR=null,armL=null,armR=null}) => (
  <svg viewBox="0 0 130 130" className="w-full h-full">
    <circle cx="65" cy="14" r="9" stroke={T} fill="none" strokeWidth={SW}/>
    <line x1="65" y1="23" x2="65" y2="65" stroke={T} strokeWidth={SW} strokeLinecap="round"/>
    <line x1="42" y1="38" x2={armL?armL.x:28} y2={armL?armL.y:58} stroke={T} strokeWidth={SW} strokeLinecap="round"/>
    <line x1="88" y1="38" x2={armR?armR.x:102} y2={armR?armR.y:58} stroke={T} strokeWidth={SW} strokeLinecap="round"/>
    <line x1="65" y1="65" x2={legL?legL.x:50} y2={legL?legL.y:105} stroke={T} strokeWidth={SW} strokeLinecap="round"/>
    <line x1="65" y1="65" x2={legR?legR.x:80} y2={legR?legR.y:105} stroke={T} strokeWidth={SW} strokeLinecap="round"/>
    {/* feet */}
    <line x1={legL?legL.x:50} y1={legL?legL.y:105} x2={legL?(legL.x-5):(44)} y2={legL?legL.y:108} stroke={T} strokeWidth={SW} strokeLinecap="round"/>
    <line x1={legR?legR.x:80} y1={legR?legR.y:105} x2={legR?(legR.x+5):87} y2={legR?legR.y:108} stroke={T} strokeWidth={SW} strokeLinecap="round"/>
    {arrows.map((a,i)=><Arrow key={i} {...a}/>)}
  </svg>
);

const SeatedFig = ({arrows=[],legAngle=0}) => (
  <svg viewBox="0 0 130 130" className="w-full h-full">
    {/* chair */}
    <line x1="30" y1="70" x2="100" y2="70" stroke="#475569" strokeWidth={2} strokeLinecap="round"/>
    <line x1="30" y1="70" x2="30" y2="110" stroke="#475569" strokeWidth={2} strokeLinecap="round"/>
    <line x1="100" y1="70" x2="100" y2="110" stroke="#475569" strokeWidth={2} strokeLinecap="round"/>
    <line x1="25" y1="45" x2="25" y2="75" stroke="#475569" strokeWidth={2} strokeLinecap="round"/>
    {/* person */}
    <circle cx="65" cy="20" r="9" stroke={T} fill="none" strokeWidth={SW}/>
    <line x1="65" y1="29" x2="65" y2="70" stroke={T} strokeWidth={SW} strokeLinecap="round"/>
    <line x1="42" y1="44" x2="28" y2="60" stroke={T} strokeWidth={SW} strokeLinecap="round"/>
    <line x1="88" y1="44" x2="102" y2="60" stroke={T} strokeWidth={SW} strokeLinecap="round"/>
    {/* thigh */}
    <line x1="50" y1="70" x2="32" y2="70" stroke={T} strokeWidth={SW} strokeLinecap="round"/>
    <line x1="80" y1="70" x2="98" y2="70" stroke={T} strokeWidth={SW} strokeLinecap="round"/>
    {/* lower legs */}
    <line x1="32" y1="70" x2={legAngle?32+Math.sin(legAngle)*35:32} y2={legAngle?70+Math.cos(legAngle)*35:105} stroke={T} strokeWidth={SW} strokeLinecap="round"/>
    <line x1="98" y1="70" x2={98} y2={105} stroke={T} strokeWidth={SW} strokeLinecap="round"/>
    {arrows.map((a,i)=><Arrow key={i} {...a}/>)}
  </svg>
);

const HandFig = ({arrows=[]}) => (
  <svg viewBox="0 0 130 110" className="w-full h-full">
    <line x1="65" y1="95" x2="65" y2="60" stroke={T} strokeWidth={4} strokeLinecap="round"/>
    <line x1="65" y1="60" x2="48" y2="25" stroke={T} strokeWidth={3} strokeLinecap="round"/>
    <line x1="65" y1="62" x2="55" y2="22" stroke={T} strokeWidth={3} strokeLinecap="round"/>
    <line x1="65" y1="62" x2="65" y2="20" stroke={T} strokeWidth={3} strokeLinecap="round"/>
    <line x1="65" y1="62" x2="75" y2="22" stroke={T} strokeWidth={3} strokeLinecap="round"/>
    <line x1="65" y1="63" x2="80" y2="30" stroke={T} strokeWidth={3} strokeLinecap="round"/>
    <line x1="65" y1="70" x2="45" y2="55" stroke={T} strokeWidth={3} strokeLinecap="round"/>
    {arrows.map((a,i)=><Arrow key={i} {...a}/>)}
  </svg>
);

const HeadFig = ({arrows=[]}) => (
  <svg viewBox="0 0 130 130" className="w-full h-full">
    <circle cx="65" cy="40" r="28" stroke={T} fill="none" strokeWidth={SW}/>
    <line x1="55" y1="50" x2="75" y2="50" stroke={T} strokeWidth={2} strokeLinecap="round"/>
    <line x1="57" y1="42" x2="57" y2="48" stroke={T} strokeWidth={2} strokeLinecap="round"/>
    <line x1="73" y1="42" x2="73" y2="48" stroke={T} strokeWidth={2} strokeLinecap="round"/>
    <line x1="65" y1="68" x2="65" y2="90" stroke={T} strokeWidth={SW} strokeLinecap="round"/>
    <line x1="65" y1="78" x2="45" y2="90" stroke={T} strokeWidth={SW} strokeLinecap="round"/>
    <line x1="65" y1="78" x2="85" y2="90" stroke={T} strokeWidth={SW} strokeLinecap="round"/>
    {arrows.map((a,i)=><Arrow key={i} {...a}/>)}
  </svg>
);

const MouthFig = ({arrows=[], open=false}) => (
  <svg viewBox="0 0 130 100" className="w-full h-full">
    <circle cx="65" cy="50" r="32" stroke={T} fill="none" strokeWidth={SW}/>
    <circle cx="53" cy="42" r="4" stroke={T} fill="none" strokeWidth={2}/>
    <circle cx="77" cy="42" r="4" stroke={T} fill="none" strokeWidth={2}/>
    {open
      ? <path d="M45 60 Q65 80 85 60" stroke={T} fill="none" strokeWidth={SW} strokeLinecap="round"/>
      : <line x1="48" y1="65" x2="82" y2="65" stroke={T} strokeWidth={SW} strokeLinecap="round"/>
    }
    {arrows.map((a,i)=><Arrow key={i} {...a}/>)}
  </svg>
);

// ── Exercise library ──────────────────────────────────────────────────────────
const EXERCISES = [
  // ── PT ─────────────────────────────────────────────────────────────────────
  {
    id:'pt1',svgMarkup:'<svg viewBox="0 0 130 90" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="45" r="9" stroke="#0D9488" fill="none" stroke-width="2.8"/><line x1="29" y1="45" x2="80" y2="45" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="80" y1="45" x2="110" y2="38" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="80" y1="45" x2="110" y2="52" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="112" y1="50" x2="112" y2="32" stroke="#E07B3C" stroke-width="2"/><polygon points="112,30 109,36 115,36" fill="#E07B3C"/><line x1="112" y1="50" x2="112" y2="68" stroke="#E07B3C" stroke-width="2"/><polygon points="112,70 109,64 115,64" fill="#E07B3C"/></svg>',disc:'PT',cat:'Lower Body',name:'Ankle Pumps',
    desc:'Pump your foot up and down at the ankle. Keep your knee straight.',
    svg:<SupineFig arrows={[{x1:112,y1:50,x2:112,y2:30},{x1:112,y1:50,x2:112,y2:70}]}/>,
    sets:3,reps:10,freq:'3x daily'
  },{
    id:'pt2',svgMarkup:'<svg viewBox="0 0 130 90" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="45" r="9" stroke="#0D9488" fill="none" stroke-width="2.8"/><line x1="29" y1="45" x2="80" y2="45" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="80" y1="45" x2="110" y2="38" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="80" y1="45" x2="110" y2="52" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="108" y1="38" x2="86" y2="30" stroke="#E07B3C" stroke-width="2"/><polygon points="85,28 81,36 89,34" fill="#E07B3C"/></svg>',disc:'PT',cat:'Lower Body',name:'Heel Slides',
    desc:'Slide your heel toward your buttocks, bending your knee. Slowly straighten.',
    svg:<SupineFig arrows={[{x1:108,y1:38,x2:85,y2:30}]}/>,
    sets:3,reps:10,freq:'2x daily'
  },{
    id:'pt3',svgMarkup:'<svg viewBox="0 0 130 90" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="45" r="9" stroke="#0D9488" fill="none" stroke-width="2.8"/><line x1="29" y1="45" x2="80" y2="45" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="80" y1="45" x2="110" y2="38" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="80" y1="45" x2="110" y2="52" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="90" y1="35" x2="90" y2="50" stroke="#E07B3C" stroke-width="2"/><polygon points="90,52 86,44 94,44" fill="#E07B3C"/></svg>',disc:'PT',cat:'Lower Body',name:'Quad Sets',
    desc:'Tighten your thigh muscle by pressing the back of your knee down into the bed.',
    svg:<SupineFig arrows={[{x1:90,y1:35,x2:90,y2:52}]}/>,
    sets:3,reps:10,freq:'3x daily'
  },{
    id:'pt4',svgMarkup:'<svg viewBox="0 0 130 90" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="45" r="9" stroke="#0D9488" fill="none" stroke-width="2.8"/><line x1="29" y1="45" x2="80" y2="45" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="80" y1="45" x2="110" y2="38" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="80" y1="45" x2="110" y2="52" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="110" y1="50" x2="106" y2="30" stroke="#E07B3C" stroke-width="2"/><polygon points="105,28 101,35 109,34" fill="#E07B3C"/></svg>',disc:'PT',cat:'Lower Body',name:'Straight Leg Raise',
    desc:'Tighten your quad, then raise your leg 12 inches off the surface. Hold 3 seconds.',
    svg:<SupineFig arrows={[{x1:110,y1:50,x2:105,y2:28}]}/>,
    sets:3,reps:10,freq:'2x daily'
  },{
    id:'pt5',svgMarkup:'<svg viewBox="0 0 130 90" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="45" r="9" stroke="#0D9488" fill="none" stroke-width="2.8"/><line x1="29" y1="45" x2="80" y2="45" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="80" y1="45" x2="110" y2="38" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="80" y1="45" x2="110" y2="52" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="110" y1="38" x2="122" y2="30" stroke="#E07B3C" stroke-width="2"/><polygon points="124,28 118,30 120,36" fill="#E07B3C"/></svg>',disc:'PT',cat:'Lower Body',name:'Hip Abduction (Supine)',
    desc:'Slide your leg out to the side, keeping your toes pointed up. Return to center.',
    svg:<SupineFig arrows={[{x1:110,y1:38,x2:124,y2:28}]}/>,
    sets:3,reps:10,freq:'2x daily'
  },{
    id:'pt6',svgMarkup:'<svg viewBox="0 0 130 130" xmlns="http://www.w3.org/2000/svg"><rect x="15" y="60" width="95" height="4" rx="2" fill="#475569"/><rect x="15" y="64" width="4" height="40" fill="#475569"/><rect x="106" y="64" width="4" height="40" fill="#475569"/><circle cx="65" cy="20" r="9" stroke="#0D9488" fill="none" stroke-width="2.8"/><line x1="65" y1="29" x2="65" y2="60" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="42" y1="44" x2="28" y2="60" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="88" y1="44" x2="102" y2="60" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="35" y1="60" x2="20" y2="60" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="95" y1="60" x2="110" y2="60" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="20" y1="60" x2="20" y2="90" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="110" y1="60" x2="110" y2="90" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="20" y1="88" x2="20" y2="62" stroke="#E07B3C" stroke-width="2"/><polygon points="20,60 16,68 24,67" fill="#E07B3C"/></svg>',disc:'PT',cat:'Lower Body',name:'Seated Knee Extension',
    desc:'While seated, slowly straighten your knee until your leg is as straight as possible.',
    svg:<SeatedFig arrows={[{x1:32,y1:88,x2:32,y2:60}]} legAngle={-0.5}/>,
    sets:3,reps:10,freq:'2x daily'
  },{
    id:'pt7',svgMarkup:'<svg viewBox="0 0 130 130" xmlns="http://www.w3.org/2000/svg"><circle cx="95" cy="14" r="9" stroke="#0D9488" fill="none" stroke-width="2.8"/><line x1="95" y1="23" x2="95" y2="65" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="72" y1="38" x2="58" y2="58" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="118" y1="38" x2="112" y2="58" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="95" y1="65" x2="80" y2="105" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="95" y1="65" x2="110" y2="105" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><circle cx="30" cy="28" r="7" stroke="#0D9488" fill="none" stroke-width="2" opacity="0.4"/><line x1="30" y1="35" x2="30" y2="60" stroke="#0D9488" stroke-width="2" opacity="0.4" stroke-linecap="round"/><line x1="30" y1="60" x2="18" y2="80" stroke="#0D9488" stroke-width="2" opacity="0.4" stroke-linecap="round"/><line x1="30" y1="60" x2="44" y2="80" stroke="#0D9488" stroke-width="2" opacity="0.4" stroke-linecap="round"/><line x1="10" y1="60" x2="55" y2="60" stroke="#475569" stroke-width="2"/><line x1="60" y1="50" x2="74" y2="30" stroke="#E07B3C" stroke-width="2"/><polygon points="75,28 70,35 78,34" fill="#E07B3C"/></svg>',disc:'PT',cat:'Lower Body',name:'Sit to Stand',
    desc:'Scoot to the edge of the chair. Lean forward, push through your hands, and stand.',
    svg:<svg viewBox="0 0 130 130" className="w-full h-full">
      {/* seated ghost */}
      <circle cx="30" cy="25" r="7" stroke={T} fill="none" strokeWidth={2} opacity={0.3}/>
      <line x1="30" y1="32" x2="30" y2="60" stroke={T} strokeWidth={2} opacity={0.3}/>
      <line x1="18" y1="46" x2="10" y2="58" stroke={T} strokeWidth={2} opacity={0.3}/>
      <line x1="42" y1="46" x2="50" y2="58" stroke={T} strokeWidth={2} opacity={0.3}/>
      <line x1="22" y1="60" x2="15" y2="80" stroke={T} strokeWidth={2} opacity={0.3}/>
      <line x1="38" y1="60" x2="44" y2="80" stroke={T} strokeWidth={2} opacity={0.3}/>
      {/* chair */}
      <line x1="10" y1="60" x2="55" y2="60" stroke="#475569" strokeWidth={2}/>
      {/* standing */}
      <circle cx="95" cy="14" r="9" stroke={T} fill="none" strokeWidth={SW}/>
      <line x1="95" y1="23" x2="95" y2="65" stroke={T} strokeWidth={SW} strokeLinecap="round"/>
      <line x1="72" y1="38" x2="58" y2="58" stroke={T} strokeWidth={SW} strokeLinecap="round"/>
      <line x1="118" y1="38" x2="112" y2="58" stroke={T} strokeWidth={SW} strokeLinecap="round"/>
      <line x1="95" y1="65" x2="80" y2="105" stroke={T} strokeWidth={SW} strokeLinecap="round"/>
      <line x1="95" y1="65" x2="110" y2="105" stroke={T} strokeWidth={SW} strokeLinecap="round"/>
      <Arrow x1={60} y1={50} x2={75} y2={28}/>
    </svg>,
    sets:3,reps:10,freq:'3x daily'
  },{
    id:'pt8',svgMarkup:'<svg viewBox="0 0 130 130" xmlns="http://www.w3.org/2000/svg"><circle cx="65" cy="14" r="9" stroke="#0D9488" fill="none" stroke-width="2.8"/><line x1="65" y1="23" x2="65" y2="65" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="42" y1="38" x2="28" y2="58" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="88" y1="38" x2="102" y2="58" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="65" y1="65" x2="50" y2="105" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="65" y1="65" x2="80" y2="105" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="65" y1="110" x2="65" y2="94" stroke="#E07B3C" stroke-width="2"/><polygon points="65,92 61,100 69,100" fill="#E07B3C"/></svg>',disc:'PT',cat:'Lower Body',name:'Calf Raises',
    desc:'Stand at counter. Rise up on your toes as high as possible. Slowly lower.',
    svg:<StandFig arrows={[{x1:65,y1:110,x2:65,y2:92}]}/>,
    sets:3,reps:10,freq:'2x daily'
  },{
    id:'pt9',svgMarkup:'<svg viewBox="0 0 130 130" xmlns="http://www.w3.org/2000/svg"><circle cx="65" cy="14" r="9" stroke="#0D9488" fill="none" stroke-width="2.8"/><line x1="65" y1="23" x2="65" y2="65" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="42" y1="38" x2="28" y2="58" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="88" y1="38" x2="102" y2="58" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="65" y1="65" x2="50" y2="105" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="65" y1="65" x2="90" y2="90" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="90" y1="90" x2="100" y2="76" stroke="#E07B3C" stroke-width="2"/><polygon points="101,74 94,78 96,86" fill="#E07B3C"/></svg>',disc:'PT',cat:'Lower Body',name:'Standing Hip Extension',
    desc:'Hold counter. Kick one leg back, keeping your knee straight. Hold 2 seconds.',
    svg:<StandFig legL={{x:50,y:105}} legR={{x:90,y:90}} arrows={[{x1:90,y1:90,x2:100,y2:75}]}/>,
    sets:3,reps:10,freq:'2x daily'
  },{
    id:'pt10',svgMarkup:'<svg viewBox="0 0 130 130" xmlns="http://www.w3.org/2000/svg"><circle cx="65" cy="14" r="9" stroke="#0D9488" fill="none" stroke-width="2.8"/><line x1="65" y1="23" x2="65" y2="65" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="42" y1="38" x2="28" y2="58" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="88" y1="38" x2="102" y2="58" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="65" y1="65" x2="80" y2="105" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="65" y1="65" x2="50" y2="80" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="50" y1="80" x2="50" y2="62" stroke="#E07B3C" stroke-width="2"/><polygon points="50,60 46,68 54,68" fill="#E07B3C"/></svg>',disc:'PT',cat:'Lower Body',name:'Marching in Place',
    desc:'Hold counter for balance. Alternate lifting your knees to hip height.',
    svg:<StandFig legL={{x:50,y:80}} legR={{x:80,y:105}} arrows={[{x1:50,y1:80,x2:50,y2:62}]}/>,
    sets:3,reps:10,freq:'2x daily'
  },
  // ── OT ─────────────────────────────────────────────────────────────────────
  {
    id:'ot1',svgMarkup:'<svg viewBox="0 0 130 110" xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="82" x2="130" y2="82" stroke="#475569" stroke-width="2"/><line x1="20" y1="65" x2="75" y2="65" stroke="#0D9488" stroke-width="4" stroke-linecap="round"/><line x1="75" y1="65" x2="110" y2="45" stroke="#0D9488" stroke-width="3" stroke-linecap="round"/><line x1="108" y1="45" x2="108" y2="27" stroke="#E07B3C" stroke-width="2"/><polygon points="108,25 104,33 112,33" fill="#E07B3C"/><line x1="108" y1="45" x2="108" y2="63" stroke="#E07B3C" stroke-width="2"/><polygon points="108,65 104,57 112,57" fill="#E07B3C"/></svg>',disc:'OT',cat:'Hand & Wrist',name:'Wrist Flexion & Extension',
    desc:'Rest your forearm on a table. Bend your wrist up, then down. Move through full range.',
    svg:<svg viewBox="0 0 130 110" className="w-full h-full">
      <line x1="20" y1="65" x2="75" y2="65" stroke={T} strokeWidth={4} strokeLinecap="round"/>
      <line x1="75" y1="65" x2="110" y2="45" stroke={T} strokeWidth={3} strokeLinecap="round"/>
      <Arrow x1={108} y1={45} x2={108} y2={25}/><Arrow x1={108} y1={45} x2={108} y2={72}/>
      <line x1="12" y1="70" x2="12" y2="80" stroke="#475569" strokeWidth={2}/>
      <line x1="0" y1="80" x2="130" y2="80" stroke="#475569" strokeWidth={2}/>
    </svg>,
    sets:3,reps:10,freq:'3x daily'
  },{
    id:'ot2',svgMarkup:'<svg viewBox="0 0 130 110" xmlns="http://www.w3.org/2000/svg"><line x1="20" y1="75" x2="65" y2="75" stroke="#0D9488" stroke-width="4" stroke-linecap="round"/><line x1="65" y1="75" x2="90" y2="55" stroke="#0D9488" stroke-width="3" stroke-linecap="round"/><circle cx="90" cy="55" r="22" stroke="#E07B3C" fill="none" stroke-width="2" stroke-dasharray="5,3"/><polygon points="110,40 103,42 107,48" fill="#E07B3C"/></svg>',disc:'OT',cat:'Hand & Wrist',name:'Wrist Circles',
    desc:'Make slow, large circles with your wrist. Complete in both directions.',
    svg:<svg viewBox="0 0 130 110" className="w-full h-full">
      <line x1="20" y1="75" x2="65" y2="75" stroke={T} strokeWidth={4} strokeLinecap="round"/>
      <circle cx="90" cy="55" r="22" stroke={O} fill="none" strokeWidth={2} strokeDasharray="5,3"/>
      <line x1="65" y1="75" x2="90" y2="55" stroke={T} strokeWidth={3} strokeLinecap="round"/>
      <Arrow x1={90} y1={33} x2={110} y2={40}/>
    </svg>,
    sets:3,reps:10,freq:'3x daily'
  },{
    id:'ot3',svgMarkup:'<svg viewBox="0 0 130 110" xmlns="http://www.w3.org/2000/svg"><line x1="65" y1="95" x2="65" y2="62" stroke="#0D9488" stroke-width="4" stroke-linecap="round"/><line x1="65" y1="62" x2="55" y2="42" stroke="#0D9488" stroke-width="3" stroke-linecap="round"/><line x1="65" y1="64" x2="60" y2="40" stroke="#0D9488" stroke-width="3" stroke-linecap="round"/><line x1="65" y1="64" x2="65" y2="38" stroke="#0D9488" stroke-width="3" stroke-linecap="round"/><line x1="65" y1="64" x2="70" y2="40" stroke="#0D9488" stroke-width="3" stroke-linecap="round"/><line x1="65" y1="65" x2="78" y2="50" stroke="#0D9488" stroke-width="3" stroke-linecap="round"/><line x1="65" y1="65" x2="48" y2="60" stroke="#0D9488" stroke-width="3" stroke-linecap="round"/><polygon points="55,40 52,48 60,47" fill="#E07B3C"/><polygon points="78,48 73,54 79,58" fill="#E07B3C"/></svg>',disc:'OT',cat:'Hand & Wrist',name:'Finger Bends',
    desc:'Slowly curl all your fingers into a fist, then straighten them fully.',
    svg:<svg viewBox="0 0 130 110" className="w-full h-full">
      <line x1="65" y1="95" x2="65" y2="62" stroke={T} strokeWidth={4} strokeLinecap="round"/>
      <line x1="65" y1="62" x2="55" y2="42" stroke={T} strokeWidth={3} strokeLinecap="round"/>
      <line x1="65" y1="64" x2="60" y2="40" stroke={T} strokeWidth={3} strokeLinecap="round"/>
      <line x1="65" y1="64" x2="65" y2="38" stroke={T} strokeWidth={3} strokeLinecap="round"/>
      <line x1="65" y1="64" x2="70" y2="40" stroke={T} strokeWidth={3} strokeLinecap="round"/>
      <line x1="65" y1="65" x2="78" y2="50" stroke={T} strokeWidth={3} strokeLinecap="round"/>
      <line x1="65" y1="65" x2="48" y2="60" stroke={T} strokeWidth={3} strokeLinecap="round"/>
      <Arrow x1={55} y1={38} x2={60} y2={55}/><Arrow x1={78} y1={46} x2={73} y2={58}/>
    </svg>,
    sets:3,reps:10,freq:'3x daily'
  },{
    id:'ot4',svgMarkup:'<svg viewBox="0 0 130 110" xmlns="http://www.w3.org/2000/svg"><line x1="65" y1="95" x2="65" y2="62" stroke="#0D9488" stroke-width="4" stroke-linecap="round"/><line x1="65" y1="62" x2="48" y2="25" stroke="#0D9488" stroke-width="3" stroke-linecap="round"/><line x1="65" y1="62" x2="55" y2="22" stroke="#0D9488" stroke-width="3" stroke-linecap="round"/><line x1="65" y1="62" x2="65" y2="20" stroke="#0D9488" stroke-width="3" stroke-linecap="round"/><line x1="65" y1="62" x2="75" y2="22" stroke="#0D9488" stroke-width="3" stroke-linecap="round"/><line x1="65" y1="62" x2="80" y2="30" stroke="#0D9488" stroke-width="3" stroke-linecap="round"/><line x1="65" y1="70" x2="45" y2="55" stroke="#0D9488" stroke-width="3" stroke-linecap="round"/><line x1="48" y1="25" x2="38" y2="16" stroke="#E07B3C" stroke-width="2"/><polygon points="36,14 40,22 32,22" fill="#E07B3C"/><line x1="80" y1="30" x2="90" y2="20" stroke="#E07B3C" stroke-width="2"/><polygon points="92,18 86,22 88,28" fill="#E07B3C"/></svg>',disc:'OT',cat:'Hand & Wrist',name:'Finger Spreads',
    desc:'Spread your fingers as wide as you can, then bring them back together.',
    svg:<HandFig arrows={[{x1:48,y1:22,x2:38,y2:14},{x1:80,y1:27,x2:90,y2:18}]}/>,
    sets:3,reps:10,freq:'3x daily'
  },{
    id:'ot5',svgMarkup:'<svg viewBox="0 0 130 110" xmlns="http://www.w3.org/2000/svg"><line x1="65" y1="95" x2="65" y2="62" stroke="#0D9488" stroke-width="4" stroke-linecap="round"/><line x1="65" y1="62" x2="55" y2="40" stroke="#0D9488" stroke-width="3" stroke-linecap="round"/><line x1="65" y1="64" x2="62" y2="38" stroke="#0D9488" stroke-width="3" stroke-linecap="round"/><line x1="65" y1="64" x2="68" y2="38" stroke="#0D9488" stroke-width="3" stroke-linecap="round"/><line x1="65" y1="64" x2="76" y2="42" stroke="#0D9488" stroke-width="3" stroke-linecap="round"/><line x1="65" y1="65" x2="48" y2="58" stroke="#0D9488" stroke-width="3" stroke-linecap="round"/><ellipse cx="52" cy="48" rx="7" ry="7" stroke="#E07B3C" fill="none" stroke-width="2"/></svg>',disc:'OT',cat:'Hand & Wrist',name:'Thumb Opposition',
    desc:'Touch your thumb to each fingertip one at a time, making an "O" shape.',
    svg:<svg viewBox="0 0 130 110" className="w-full h-full">
      <line x1="65" y1="95" x2="65" y2="62" stroke={T} strokeWidth={4} strokeLinecap="round"/>
      <line x1="65" y1="62" x2="55" y2="40" stroke={T} strokeWidth={3} strokeLinecap="round"/>
      <line x1="65" y1="64" x2="62" y2="38" stroke={T} strokeWidth={3} strokeLinecap="round"/>
      <line x1="65" y1="64" x2="68" y2="38" stroke={T} strokeWidth={3} strokeLinecap="round"/>
      <line x1="65" y1="64" x2="76" y2="42" stroke={T} strokeWidth={3} strokeLinecap="round"/>
      <line x1="65" y1="65" x2="48" y2="58" stroke={T} strokeWidth={3} strokeLinecap="round"/>
      <ellipse cx="52" cy="48" rx="7" ry="7" stroke={O} fill="none" strokeWidth={2}/>
    </svg>,
    sets:3,reps:10,freq:'3x daily'
  },{
    id:'ot6',svgMarkup:'<svg viewBox="0 0 130 110" xmlns="http://www.w3.org/2000/svg"><line x1="65" y1="95" x2="65" y2="60" stroke="#0D9488" stroke-width="4" stroke-linecap="round"/><line x1="65" y1="60" x2="52" y2="52" stroke="#0D9488" stroke-width="3" stroke-linecap="round"/><line x1="65" y1="60" x2="48" y2="47" stroke="#0D9488" stroke-width="3" stroke-linecap="round"/><line x1="65" y1="60" x2="50" y2="40" stroke="#0D9488" stroke-width="3" stroke-linecap="round"/><line x1="65" y1="60" x2="55" y2="34" stroke="#0D9488" stroke-width="3" stroke-linecap="round"/><circle cx="65" cy="45" r="18" stroke="#E07B3C" fill="none" stroke-width="2" stroke-dasharray="4,3"/><polygon points="48,48 54,56 58,48" fill="#E07B3C"/></svg>',disc:'OT',cat:'Hand & Wrist',name:'Grip Strengthening',
    desc:'Squeeze a soft ball or towel roll as hard as comfortable. Hold 3 seconds, release.',
    svg:<svg viewBox="0 0 130 110" className="w-full h-full">
      <line x1="65" y1="95" x2="65" y2="60" stroke={T} strokeWidth={4} strokeLinecap="round"/>
      <circle cx="65" cy="45" r="18" stroke={O} fill="none" strokeWidth={2} strokeDasharray="4,3"/>
      <line x1="65" y1="60" x2="52" y2="52" stroke={T} strokeWidth={3} strokeLinecap="round"/>
      <line x1="65" y1="60" x2="48" y2="47" stroke={T} strokeWidth={3} strokeLinecap="round"/>
      <line x1="65" y1="60" x2="50" y2="40" stroke={T} strokeWidth={3} strokeLinecap="round"/>
      <line x1="65" y1="60" x2="55" y2="34" stroke={T} strokeWidth={3} strokeLinecap="round"/>
      <Arrow x1={48} y1={47} x2={55} y2={50}/><Arrow x1={50} y1={40} x2={57} y2={45}/>
    </svg>,
    sets:3,reps:10,freq:'3x daily'
  },{
    id:'ot7',svgMarkup:'<svg viewBox="0 0 130 130" xmlns="http://www.w3.org/2000/svg"><circle cx="65" cy="14" r="9" stroke="#0D9488" fill="none" stroke-width="2.8"/><line x1="65" y1="23" x2="65" y2="65" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="65" y1="65" x2="50" y2="105" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="65" y1="65" x2="80" y2="105" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="42" y1="38" x2="22" y2="55" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="88" y1="38" x2="108" y2="38" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="108" y1="38" x2="88" y2="55" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="88" y1="38" x2="88" y2="24" stroke="#E07B3C" stroke-width="2"/><polygon points="88,22 84,30 92,30" fill="#E07B3C"/><line x1="88" y1="55" x2="88" y2="69" stroke="#E07B3C" stroke-width="2"/><polygon points="88,71 84,63 92,63" fill="#E07B3C"/></svg>',disc:'OT',cat:'Arm & Shoulder',name:'Elbow Flexion & Extension',
    desc:'Bend your elbow to bring your hand to your shoulder, then straighten completely.',
    svg:<svg viewBox="0 0 130 130" className="w-full h-full">
      <circle cx="65" cy="14" r="9" stroke={T} fill="none" strokeWidth={SW}/>
      <line x1="65" y1="23" x2="65" y2="65" stroke={T} strokeWidth={SW} strokeLinecap="round"/>
      <line x1="65" y1="65" x2="80" y2="105" stroke={T} strokeWidth={SW} strokeLinecap="round"/>
      <line x1="65" y1="65" x2="50" y2="105" stroke={T} strokeWidth={SW} strokeLinecap="round"/>
      <line x1="42" y1="38" x2="22" y2="55" stroke={T} strokeWidth={SW} strokeLinecap="round"/>
      <line x1="88" y1="38" x2="108" y2="38" stroke={T} strokeWidth={SW} strokeLinecap="round"/>
      <line x1="108" y1="38" x2="88" y2="55" stroke={T} strokeWidth={3} strokeLinecap="round"/>
      <Arrow x1={88} y1={38} x2={88} y2={22}/><Arrow x1={88} y1={55} x2={88} y2={70}/>
    </svg>,
    sets:3,reps:10,freq:'2x daily'
  },{
    id:'ot8',svgMarkup:'<svg viewBox="0 0 130 130" xmlns="http://www.w3.org/2000/svg"><circle cx="65" cy="14" r="9" stroke="#0D9488" fill="none" stroke-width="2.8"/><line x1="65" y1="23" x2="65" y2="65" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="65" y1="65" x2="50" y2="105" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="65" y1="65" x2="80" y2="105" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="42" y1="38" x2="28" y2="58" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="88" y1="38" x2="102" y2="20" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="100" y1="22" x2="90" y2="36" stroke="#E07B3C" stroke-width="2"/><polygon points="88,38 84,30 92,30" fill="#E07B3C"/></svg>',disc:'OT',cat:'Arm & Shoulder',name:'Shoulder Flexion',
    desc:'Raise your arm straight in front of you to shoulder height. Slowly lower.',
    svg:<StandFig armR={{x:102,y:20}} arrows={[{x1:100,y1:22,x2:88,y2:38}]}/>,
    sets:3,reps:10,freq:'2x daily'
  },{
    id:'ot9',svgMarkup:'<svg viewBox="0 0 130 130" xmlns="http://www.w3.org/2000/svg"><circle cx="65" cy="14" r="9" stroke="#0D9488" fill="none" stroke-width="2.8"/><line x1="65" y1="23" x2="65" y2="65" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="65" y1="65" x2="50" y2="105" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="65" y1="65" x2="80" y2="105" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="42" y1="38" x2="28" y2="58" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="88" y1="38" x2="120" y2="40" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="102" y1="42" x2="116" y2="42" stroke="#E07B3C" stroke-width="2"/><polygon points="118,42 110,38 110,46" fill="#E07B3C"/></svg>',disc:'OT',cat:'Arm & Shoulder',name:'Shoulder Abduction',
    desc:'Raise your arm out to the side to shoulder height, keeping your elbow straight.',
    svg:<StandFig armR={{x:120,y:40}} arrows={[{x1:118,y1:42,x2:102,y2:42}]}/>,
    sets:3,reps:10,freq:'2x daily'
  },{
    id:'ot10',svgMarkup:'<svg viewBox="0 0 130 110" xmlns="http://www.w3.org/2000/svg"><line x1="65" y1="20" x2="65" y2="65" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="65" y1="65" x2="40" y2="85" stroke="#0D9488" stroke-width="3" stroke-linecap="round"/><line x1="40" y1="85" x2="28" y2="78" stroke="#0D9488" stroke-width="2.5" stroke-linecap="round"/><line x1="40" y1="85" x2="32" y2="90" stroke="#0D9488" stroke-width="2.5" stroke-linecap="round"/><line x1="40" y1="85" x2="38" y2="93" stroke="#0D9488" stroke-width="2.5" stroke-linecap="round"/><line x1="40" y1="85" x2="44" y2="93" stroke="#0D9488" stroke-width="2.5" stroke-linecap="round"/><line x1="40" y1="85" x2="50" y2="90" stroke="#0D9488" stroke-width="2.5" stroke-linecap="round"/><polygon points="75,65 68,60 70,68" fill="#E07B3C"/><polygon points="88,72 80,66 83,74" fill="#E07B3C"/></svg>',disc:'OT',cat:'Arm & Shoulder',name:'Forearm Rotation',
    desc:'Keep your elbow at your side. Rotate your palm to face up, then down.',
    svg:<svg viewBox="0 0 130 110" className="w-full h-full">
      <line x1="65" y1="20" x2="65" y2="65" stroke={T} strokeWidth={SW} strokeLinecap="round"/>
      <line x1="65" y1="65" x2="40" y2="85" stroke={T} strokeWidth={3} strokeLinecap="round"/>
      <line x1="40" y1="85" x2="28" y2="78" stroke={T} strokeWidth={2.5} strokeLinecap="round"/>
      <line x1="40" y1="85" x2="32" y2="90" stroke={T} strokeWidth={2.5} strokeLinecap="round"/>
      <line x1="40" y1="85" x2="38" y2="93" stroke={T} strokeWidth={2.5} strokeLinecap="round"/>
      <line x1="40" y1="85" x2="44" y2="93" stroke={T} strokeWidth={2.5} strokeLinecap="round"/>
      <line x1="40" y1="85" x2="50" y2="90" stroke={T} strokeWidth={2.5} strokeLinecap="round"/>
      <Arrow x1={75} y1={65} x2={88} y2={72}/><Arrow x1={88} y1={72} x2={78} y2={82}/>
    </svg>,
    sets:3,reps:10,freq:'3x daily'
  },
  // ── ST ─────────────────────────────────────────────────────────────────────
  {
    id:'st1',svgMarkup:'<svg viewBox="0 0 130 130" xmlns="http://www.w3.org/2000/svg"><circle cx="65" cy="40" r="28" stroke="#0D9488" fill="none" stroke-width="2.8"/><line x1="57" y1="42" x2="57" y2="48" stroke="#0D9488" stroke-width="2" stroke-linecap="round"/><line x1="73" y1="42" x2="73" y2="48" stroke="#0D9488" stroke-width="2" stroke-linecap="round"/><line x1="55" y1="50" x2="75" y2="50" stroke="#0D9488" stroke-width="2" stroke-linecap="round"/><line x1="65" y1="68" x2="65" y2="90" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="65" y1="78" x2="45" y2="90" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="65" y1="78" x2="85" y2="90" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="65" y1="30" x2="65" y2="48" stroke="#E07B3C" stroke-width="2"/><polygon points="65,50 61,42 69,42" fill="#E07B3C"/></svg>',disc:'ST',cat:'Swallowing',name:'Chin Tuck Swallow',
    desc:'Tuck your chin to your chest before and during each swallow. This protects the airway.',
    svg:<HeadFig arrows={[{x1:65,y1:30,x2:65,y2:52}]}/>,
    sets:1,reps:10,freq:'With every meal'
  },{
    id:'st2',svgMarkup:'<svg viewBox="0 0 130 130" xmlns="http://www.w3.org/2000/svg"><circle cx="65" cy="40" r="28" stroke="#0D9488" fill="none" stroke-width="2.8"/><line x1="57" y1="42" x2="57" y2="48" stroke="#0D9488" stroke-width="2" stroke-linecap="round"/><line x1="73" y1="42" x2="73" y2="48" stroke="#0D9488" stroke-width="2" stroke-linecap="round"/><line x1="55" y1="50" x2="75" y2="50" stroke="#0D9488" stroke-width="2" stroke-linecap="round"/><line x1="65" y1="68" x2="65" y2="90" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="65" y1="78" x2="45" y2="90" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="65" y1="78" x2="85" y2="90" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><polygon points="50,48 46,40 54,40" fill="#E07B3C"/><polygon points="80,48 76,40 84,40" fill="#E07B3C"/><line x1="45" y1="58" x2="49" y2="42" stroke="#E07B3C" stroke-width="2"/><line x1="85" y1="58" x2="81" y2="42" stroke="#E07B3C" stroke-width="2"/></svg>',disc:'ST',cat:'Swallowing',name:'Effortful Swallow',
    desc:'Squeeze all your throat muscles as hard as possible while swallowing.',
    svg:<HeadFig arrows={[{x1:45,y1:60,x2:55,y2:52},{x1:85,y1:60,x2:75,y2:52}]}/>,
    sets:3,reps:5,freq:'3x daily'
  },{
    id:'st3',svgMarkup:'<svg viewBox="0 0 130 100" xmlns="http://www.w3.org/2000/svg"><circle cx="65" cy="40" r="32" stroke="#0D9488" fill="none" stroke-width="2.8"/><circle cx="53" cy="32" r="4" stroke="#0D9488" fill="none" stroke-width="2"/><circle cx="77" cy="32" r="4" stroke="#0D9488" fill="none" stroke-width="2"/><path d="M45 55 Q65 72 85 55" stroke="#0D9488" fill="none" stroke-width="2.8" stroke-linecap="round"/><line x1="65" y1="78" x2="65" y2="93" stroke="#E07B3C" stroke-width="2"/><polygon points="65,95 61,87 69,87" fill="#E07B3C"/></svg>',disc:'ST',cat:'Oral Motor',name:'Tongue Protrusion & Retraction',
    desc:'Stick your tongue out as far as possible. Hold 2 seconds. Pull it back. Repeat.',
    svg:<MouthFig open arrows={[{x1:65,y1:78,x2:65,y2:95},{x1:65,y1:85,x2:65,y2:65}]}/>,
    sets:3,reps:10,freq:'3x daily'
  },{
    id:'st4',svgMarkup:'<svg viewBox="0 0 130 100" xmlns="http://www.w3.org/2000/svg"><circle cx="65" cy="40" r="32" stroke="#0D9488" fill="none" stroke-width="2.8"/><circle cx="53" cy="32" r="4" stroke="#0D9488" fill="none" stroke-width="2"/><circle cx="77" cy="32" r="4" stroke="#0D9488" fill="none" stroke-width="2"/><path d="M45 55 Q65 72 85 55" stroke="#0D9488" fill="none" stroke-width="2.8" stroke-linecap="round"/><line x1="40" y1="62" x2="63" y2="62" stroke="#E07B3C" stroke-width="2"/><line x1="67" y1="62" x2="82" y2="62" stroke="#E07B3C" stroke-width="2"/><polygon points="84,62 76,58 76,66" fill="#E07B3C"/></svg>',disc:'ST',cat:'Oral Motor',name:'Tongue Lateralization',
    desc:'Move your tongue from the right corner of your mouth to the left corner. Repeat.',
    svg:<MouthFig open arrows={[{x1:45,y1:70,x2:85,y2:70}]}/>,
    sets:3,reps:10,freq:'3x daily'
  },{
    id:'st5',svgMarkup:'<svg viewBox="0 0 130 100" xmlns="http://www.w3.org/2000/svg"><circle cx="65" cy="40" r="32" stroke="#0D9488" fill="none" stroke-width="2.8"/><circle cx="53" cy="32" r="4" stroke="#0D9488" fill="none" stroke-width="2"/><circle cx="77" cy="32" r="4" stroke="#0D9488" fill="none" stroke-width="2"/><line x1="48" y1="58" x2="82" y2="58" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><polygon points="57,58 52,52 52,64" fill="#E07B3C"/><polygon points="73,58 78,52 78,64" fill="#E07B3C"/></svg>',disc:'ST',cat:'Oral Motor',name:'Lip Strengthening',
    desc:'Press your lips together firmly. Hold 5 seconds. Relax. Repeat.',
    svg:<MouthFig arrows={[{x1:55,y1:62,x2:65,y2:64},{x1:75,y1:62,x2:65,y2:64}]}/>,
    sets:3,reps:10,freq:'3x daily'
  },{
    id:'st6',svgMarkup:'<svg viewBox="0 0 130 110" xmlns="http://www.w3.org/2000/svg"><circle cx="52" cy="40" r="28" stroke="#0D9488" fill="none" stroke-width="2.8"/><circle cx="43" cy="33" r="3.5" stroke="#0D9488" fill="none" stroke-width="2"/><circle cx="61" cy="33" r="3.5" stroke="#0D9488" fill="none" stroke-width="2"/><path d="M36 52 Q52 66 68 52" stroke="#0D9488" fill="none" stroke-width="2.8" stroke-linecap="round"/><line x1="52" y1="68" x2="52" y2="85" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/><line x1="80" y1="36" x2="108" y2="30" stroke="#E07B3C" stroke-width="2"/><polygon points="110,29 103,27 104,33" fill="#E07B3C"/><line x1="80" y1="44" x2="108" y2="44" stroke="#E07B3C" stroke-width="2"/><polygon points="110,44 103,40 103,48" fill="#E07B3C"/></svg>',disc:'ST',cat:'Voice',name:'Sustained Phonation',
    desc:'Take a deep breath and say "ahhhh" as long and steadily as possible.',
    svg:<svg viewBox="0 0 130 110" className="w-full h-full">
      <circle cx="65" cy="40" r="28" stroke={T} fill="none" strokeWidth={SW}/>
      <circle cx="55" cy="34" r="4" stroke={T} fill="none" strokeWidth={2}/>
      <circle cx="75" cy="34" r="4" stroke={T} fill="none" strokeWidth={2}/>
      <path d="M45 55 Q65 70 85 55" stroke={T} fill="none" strokeWidth={SW} strokeLinecap="round"/>
      <Arrow x1={92} y1={38} x2={108} y2={30}/><Arrow x1={92} y1={44} x2={110} y2={44}/>
      <text x="108" y="28" fontSize="8" fill={O} fontFamily="sans-serif">ahhh</text>
    </svg>,
    sets:3,reps:5,freq:'3x daily'
  },
];

// ── Main Component ─────────────────────────────────────────────────────────────
function HEPGenerator({ onClose }) {
  const [disc, setDisc] = useState('All');
  const [cat,  setCat]  = useState('All');
  const [selected, setSelected] = useState([]);
  const [printing, setPrinting] = useState(false);

  const discs = ['All','PT','OT','ST'];
  const cats  = ['All',...[...new Set(EXERCISES.map(e=>e.cat))]];
  const filtered = EXERCISES.filter(e=>(disc==='All'||e.disc===disc)&&(cat==='All'||e.cat===cat));

  const toggle = (ex) => {
    setSelected(prev => prev.find(s=>s.id===ex.id)
      ? prev.filter(s=>s.id!==ex.id)
      : [...prev,{...ex,sets:ex.sets,reps:ex.reps,freq:ex.freq,notes:''}]
    );
  };

  const update = (id,field,val) => setSelected(prev=>prev.map(s=>s.id===id?{...s,[field]:val}:s));
  const isSelected = (id) => !!selected.find(s=>s.id===id);

  const doPrint = () => {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;

    // Serialize SVGs from selected exercises
    const exerciseRows = selected.map(ex => {
      // Get SVG markup from the ex.svgMarkup string
      const svgStr = ex.svgMarkup || '';
      return `
        <div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px;break-inside:avoid;margin-bottom:12px;">
          <div style="display:flex;gap:10px;align-items:flex-start;">
            <div style="width:80px;height:80px;flex-shrink:0;">${svgStr}</div>
            <div style="flex:1;">
              <div style="font-weight:bold;font-size:13px;color:#0D9488;margin-bottom:4px;">${ex.name}</div>
              <div style="font-size:11px;color:#475569;margin-bottom:6px;line-height:1.4;">${ex.desc}</div>
              <div style="font-size:11px;font-weight:bold;color:#1e293b;">${ex.sets} sets × ${ex.reps} reps | ${ex.freq}</div>
              ${ex.notes ? `<div style="font-size:10px;color:#64748b;margin-top:3px;font-style:italic;">${ex.notes}</div>` : ''}
            </div>
          </div>
        </div>`;
    }).join('');

    win.document.write(`<!DOCTYPE html><html><head>
      <title>Home Exercise Program</title>
      <style>
        body { font-family: Arial, sans-serif; color: #1e293b; padding: 24px; margin: 0; }
        @media print { @page { margin: 1cm; } }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .header { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #0D9488; padding-bottom: 12px; margin-bottom: 20px; }
        .footer { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 10px; color: #94a3b8; text-align: center; }
      </style>
    </head><body>
      <div class="header">
        <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#0D9488" stroke-width="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        <div>
          
          <div style="font-size:11px;color:#64748b;">Home Exercise Program</div>
        </div>
        <div style="margin-left:auto;font-size:11px;color:#64748b;">Date: _______________</div>
      </div>
      <div class="grid">${exerciseRows}</div>
      <div class="footer">Perform exercises as instructed by your therapist. Stop if you experience pain. Contact your therapy team with questions.</div>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  };

  return (
    <>
      <style>{`
        @media print {
          body > * { display: none !important; }
          #hep-print { display: block !important; }
        }
        #hep-print { display: none; }
      `}</style>

      {/* Print output */}
      <div id="hep-print">
        <div style={{fontFamily:'Arial,sans-serif',padding:'24px',color:'#1e293b'}}>
          <div style={{display:'flex',alignItems:'center',gap:'12px',borderBottom:'2px solid #0D9488',paddingBottom:'12px',marginBottom:'20px'}}>
            <div style={{background:'linear-gradient(135deg,#0D9488,#06B6D4)',width:'40px',height:'40px',borderRadius:'10px',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="white" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            </div>
            <div>
              
              <div style={{fontSize:'11px',color:'#64748b'}}>Home Exercise Program</div>
            </div>
            <div style={{marginLeft:'auto',fontSize:'11px',color:'#64748b'}}>Date: _______________</div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>
            {selected.map(ex=>(
              <div key={ex.id} style={{border:'1px solid #e2e8f0',borderRadius:'10px',padding:'12px',breakInside:'avoid'}}>
                <div style={{display:'flex',gap:'10px',alignItems:'flex-start'}}>
                  <div style={{width:'80px',height:'80px',flexShrink:0}}>{ex.svg}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:'bold',fontSize:'13px',color:'#0D9488',marginBottom:'4px'}}>{ex.name}</div>
                    <div style={{fontSize:'11px',color:'#475569',marginBottom:'6px',lineHeight:'1.4'}}>{ex.desc}</div>
                    <div style={{fontSize:'11px',fontWeight:'bold',color:'#1e293b'}}>
                      {ex.sets} sets × {ex.reps} reps &nbsp;|&nbsp; {ex.freq}
                    </div>
                    {ex.notes && <div style={{fontSize:'10px',color:'#64748b',marginTop:'3px',fontStyle:'italic'}}>{ex.notes}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {selected.length===0 && <p style={{color:'#94a3b8',textAlign:'center',marginTop:'40px'}}>No exercises selected.</p>}
          <div style={{marginTop:'24px',borderTop:'1px solid #e2e8f0',paddingTop:'12px',fontSize:'10px',color:'#94a3b8',textAlign:'center'}}>
            Perform exercises as instructed by your therapist. Stop if you experience pain. Contact your therapy team with questions.
          </div>
        </div>
      </div>

      {/* Screen UI */}
      <div className="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
          <div>
            <h2 className="text-xl font-black text-white">HEP Generator</h2>
            <p className="text-slate-400 text-sm">Select exercises → customize → print</p>
          </div>
          <div className="flex items-center gap-3">
            {selected.length>0 && (
              <button onClick={doPrint}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-bold rounded-xl shadow-lg hover:from-teal-600 hover:to-cyan-600 transition-all text-sm">
                <Printer className="w-4 h-4"/> Print HEP ({selected.length})
              </button>
            )}
            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-xl transition-all">
              <X className="w-5 h-5 text-white"/>
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Exercise Library */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Filters */}
            <div className="px-6 py-3 border-b border-white/10 flex items-center gap-4 flex-wrap flex-shrink-0">
              <div className="flex gap-2">
                {discs.map(d=>(
                  <button key={d} onClick={()=>{setDisc(d);setCat('All');}}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${disc===d?'bg-teal-500 text-white':'bg-white/10 text-slate-400 hover:bg-white/20'}`}>{d}</button>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap">
                {cats.filter(c=>c==='All'||EXERCISES.some(e=>e.cat===c&&(disc==='All'||e.disc===disc))).map(c=>(
                  <button key={c} onClick={()=>setCat(c)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${cat===c?'bg-cyan-600 text-white':'bg-white/5 text-slate-500 hover:bg-white/10'}`}>{c}</button>
                ))}
              </div>
            </div>

            {/* Exercise grid */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 content-start">
              {filtered.map(ex=>{
                const sel=isSelected(ex.id);
                return (
                  <div key={ex.id} onClick={()=>toggle(ex)}
                    className={`relative cursor-pointer rounded-2xl border p-4 transition-all hover:scale-[1.02] ${sel?'border-teal-400 bg-teal-500/10':'border-white/10 bg-white/5 hover:border-white/20'}`}>
                    {sel && <div className="absolute top-2 right-2 w-5 h-5 bg-teal-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-black">✓</span>
                    </div>}
                    <div className="w-full h-24 mb-3">{ex.svg}</div>
                    <div className={`text-sm font-bold mb-1 ${sel?'text-teal-300':'text-white'}`}>{ex.name}</div>
                    <div className="text-xs text-slate-500">{ex.disc} · {ex.cat}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected panel */}
          {selected.length>0 && (
            <div className="w-80 border-l border-white/10 flex flex-col flex-shrink-0">
              <div className="px-4 py-3 border-b border-white/10 flex-shrink-0">
                <h3 className="text-white font-black text-sm">Selected Exercises ({selected.length})</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {selected.map((ex,i)=>(
                  <div key={ex.id} className="bg-white/5 rounded-xl p-3 border border-white/10">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="text-white text-xs font-bold leading-tight">{i+1}. {ex.name}</div>
                      <button onClick={()=>toggle(ex)} className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0">
                        <Trash2 className="w-3.5 h-3.5"/>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <div className="text-slate-500 text-xs mb-1">Sets</div>
                        <div className="flex items-center gap-1">
                          <button onClick={()=>update(ex.id,'sets',Math.max(1,ex.sets-1))} className="w-5 h-5 bg-white/10 rounded text-white text-xs flex items-center justify-center hover:bg-white/20"><Minus className="w-3 h-3"/></button>
                          <span className="text-white text-sm font-bold w-4 text-center">{ex.sets}</span>
                          <button onClick={()=>update(ex.id,'sets',ex.sets+1)} className="w-5 h-5 bg-white/10 rounded text-white text-xs flex items-center justify-center hover:bg-white/20"><Plus className="w-3 h-3"/></button>
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-xs mb-1">Reps</div>
                        <div className="flex items-center gap-1">
                          <button onClick={()=>update(ex.id,'reps',Math.max(1,ex.reps-1))} className="w-5 h-5 bg-white/10 rounded text-white text-xs flex items-center justify-center hover:bg-white/20"><Minus className="w-3 h-3"/></button>
                          <span className="text-white text-sm font-bold w-4 text-center">{ex.reps}</span>
                          <button onClick={()=>update(ex.id,'reps',ex.reps+1)} className="w-5 h-5 bg-white/10 rounded text-white text-xs flex items-center justify-center hover:bg-white/20"><Plus className="w-3 h-3"/></button>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-xs mb-1">Frequency</div>
                      <input value={ex.freq} onChange={e=>update(ex.id,'freq',e.target.value)}
                        className="w-full bg-white/10 rounded-lg px-2 py-1 text-white text-xs border border-white/10 focus:outline-none focus:border-teal-400/50"/>
                    </div>
                    <div className="mt-2">
                      <div className="text-slate-500 text-xs mb-1">Notes</div>
                      <input value={ex.notes} onChange={e=>update(ex.id,'notes',e.target.value)}
                        placeholder="Optional note..."
                        className="w-full bg-white/10 rounded-lg px-2 py-1 text-white text-xs border border-white/10 focus:outline-none focus:border-teal-400/50 placeholder-slate-600"/>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-white/10 flex-shrink-0">
                <button onClick={doPrint}
                  className="w-full py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:from-teal-600 hover:to-cyan-600 transition-all text-sm">
                  <Printer className="w-4 h-4"/> Print HEP
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}


export default function App() {
  const allWeeklyData = facilityDataJson;

  // Dynamically compute last 3 months from actual data
  const EXEC_MONTHS = [
    { label: 'Jan', start: '2026-01-01', end: '2026-01-31' },
    { label: 'Feb', start: '2026-02-01', end: '2026-02-28' },
    { label: 'Mar', start: '2026-03-01', end: '2026-03-31' },
    { label: 'Apr', start: '2026-04-01', end: '2026-04-30' },
    { label: 'May', start: '2026-05-01', end: '2026-05-31' },
    { label: 'Jun', start: '2026-06-01', end: '2026-06-30' },
  ];

  // Auth state
  const [isAuthenticated,          setIsAuthenticated]          = useState(false);
  const [loginType,                setLoginType]                = useState(null);
  const [selectedFacilityForLogin, setSelectedFacilityForLogin] = useState('');
  const [passwordAttempt,          setPasswordAttempt]          = useState('');

  // UI state
  const [activeView,         setActiveView]         = useState('overview');
  const [selectedWeek,       setSelectedWeek]       = useState('latest');
  const [selectedRegion,     setSelectedRegion]     = useState('all');
  const [expandedFacility,   setExpandedFacility]   = useState(null);
  const [filterProductivity, setFilterProductivity] = useState('all');
  const [filterCPM,          setFilterCPM]          = useState('all');
  const [searchTerm,         setSearchTerm]         = useState('');
  const [historicalView,     setHistoricalView]     = useState('weekly');
  const [dorLeaderboardSort, setDorLeaderboardSort] = useState('productivity');
  const [dorLeaderboardDir,  setDorLeaderboardDir]  = useState('desc');

  // Resources state
  const [githubResources,  setGithubResources]  = useState([]);
  const [resourcesLoading, setResourcesLoading] = useState(true);
  const [resourcesError,   setResourcesError]   = useState(null);

  // AI Briefing state
  const [briefingText,    setBriefingText]    = useState('');
  const [briefingLoading, setBriefingLoading] = useState(false);

  // Region Report state
  const [complianceData, setComplianceData] = useState({
    'Overland': [
      { building: 'Belmont HC',          status: 'Green',  actionItem: 'Work on DC orders and resolving careplans.' },
      { building: 'Capital PA',          status: 'Green',  actionItem: 'Continue working on quality of documentation with levels.' },
      { building: 'Bridgewood PA',       status: 'Green',  actionItem: 'JMA caught up. PT standardized tests missing.' },
      { building: 'Cedarwood PA',        status: 'Green',  actionItem: 'JMA caught up. Some standardized tests missing across disciplines.' },
      { building: 'Palo Alto Post Acute',status: 'Yellow', actionItem: 'Catch up on rehab post-fall screens. Eval orders not being discontinued consistently.' },
      { building: 'Eden HC',             status: 'Yellow', actionItem: 'JMA ongoing. Standardized tests missing on evals for OT/ST.' },
      { building: 'Golden Harbor HC',    status: 'Yellow', actionItem: 'Standardized tests for OT. DC eval orders. Clean up reclarification and PT/OT clarification orders.' },
      { building: 'West Shore PA',       status: 'Red',    actionItem: 'Bring JMA to 60% complete. Continue resolving orders and careplans.' },
      { building: 'Blue Oak Post Acute', status: 'Red',    actionItem: 'With new DOR, all processes need to be put in place.' },
    ],
    'Golden Coast': [
      { building: 'The Win Post Acute',      status: 'Green',  actionItem: 'Focus on levels in daily notes.' },
      { building: 'PAC Hills Post Acute',    status: 'Green',  actionItem: 'Inservice therapists on mandatory levels for PT/OT.' },
      { building: 'Pac Coast PA',            status: 'Green',  actionItem: 'Continue to work on DC eval orders.' },
      { building: 'Gilroy HC',               status: 'Green',  actionItem: 'Resolving careplans upon payor change to LTC.' },
      { building: 'Camino Ridge Post Acute', status: 'Yellow', actionItem: 'Standardized tests missing for PT/OT. Continue DC orders and resolving care plans.' },
      { building: 'Los Altos Post Acute',    status: 'Yellow', actionItem: 'RNA program needs orders. Standardized tests missing in evals for PT.' },
      { building: 'Mountain View HC',        status: 'Red',    actionItem: 'Frequencies need to match what is being provided. Standardized tests need to be put in.' },
      { building: 'Morgan Hill HC',          status: 'Red',    actionItem: 'Frequencies need to match what is being provided. Orders/careplans not being followed due to staffing challenges.' },
      { building: 'Manresa HC',              status: 'Red',    actionItem: 'With new DOR, all processes need to be put in place — beginning to catch up on JMA in May.' },
    ],
  });
  const [alosData, setAlosData] = useState({
    // Golden Coast — names match data.json exactly
    'Camino Ridge Post Acute': { jan: '41.6', feb: '39.3', mar: '34.1', apr: '37.3', may: '35.2', jun: '25.6' },
    'Gilroy HC':               { jan: '53.8', feb: '46.0', mar: '32.2', apr: '41.0', may: '52.6', jun: '45.6' },
    'Los Altos Post Acute':    { jan: '33.9', feb: '34.4', mar: '28.0', apr: '35.8', may: '60.9', jun: '32.2' },
    'Manresa HC':              { jan: '48.5', feb: '46.8', mar: '49.4', apr: '36.3', may: '43.2', jun: '41.0' },
    'Morgan Hill HC':          { jan: '33.2', feb: '36.0', mar: '52.2', apr: '35.5', may: '29.0', jun: '49.5' },
    'Mountain View HC':        { jan: '35.6', feb: '27.4', mar: '33.9', apr: '35.4', may: '31.5', jun: '38.7' },
    'Pac Coast PA':            { jan: '32.4', feb: '35.3', mar: '34.9', apr: '30.2', may: '34.2', jun: '27.4' },
    'PAC Hills Post Acute':    { jan: '34.6', feb: '31.6', mar: '45.9', apr: '46.3', may: '53.6', jun: '30.1' },
    'The Win Post Acute':      { jan: '37.2', feb: '40.7', mar: '37.0', apr: '49.9', may: '58.0', jun: '50.5' },
    'Palo Alto Post Acute':    { jan: '24.1', feb: '20.4', mar: '25.6', apr: '31.0', may: '44.1', jun: '29.4' },
    // Overland — names match data.json exactly
    'Belmont HC':              { jan: '33.4', feb: '39.2', mar: '39.8', apr: '44.50', may: '31.28', jun: '51.09' },
    'Blue Oak Post Acute':     { jan: '20.0', feb: '18.2', mar: '24.2', apr: '22.42', may: '29.86', jun: '42.92' },
    'Bridgewood PA':           { jan: '20.7', feb: '51.4', mar: '64.3', apr: '63.78', may: '53.62', jun: '38.89' },
    'Capital PA':              { jan: '8.6',  feb: '31.7', mar: '34.8', apr: '55.27', may: '41.83', jun: '44.36' },
    'Cedarwood PA':            { jan: '30.5', feb: '36.6', mar: '33.5', apr: '24',    may: '38.88', jun: '36.48' },
    'Eden HC':                 { jan: '33.8', feb: '41.3', mar: '38.2', apr: '30.64', may: '39.22', jun: '61.64' },
    'Golden Harbor HC':        { jan: '26.8', feb: '45.6', mar: '45.4', apr: '48.22', may: '56.39', jun: '41.11' },
    'West Shore PA':           { jan: '47.6', feb: '21.8', mar: '38.6', apr: '52.23', may: '45.19', jun: '37.83' },
  });
  const [showReportModal,   setShowReportModal]   = useState(false);
  const [reportRegion,      setReportRegion]      = useState(null);
  const [reportGenerating,  setReportGenerating]  = useState(false);
  const [savedNarratives,   setSavedNarratives]   = useState({});
  const [narrativeLoading,  setNarrativeLoading]  = useState(false);
  const [resourcesAccess,    setResourcesAccess]    = useState(false);
  const [showHEP,           setShowHEP]           = useState(false);
  const [resourcesPin,       setResourcesPin]       = useState('');
  const [scorecardOpen,     setScorecardOpen]     = useState(true);
  const [complianceOpen,    setComplianceOpen]    = useState(true);
  const [checkInData,       setCheckInData]       = useState([]);
  const [checkInWeek,       setCheckInWeek]       = useState(null);
  const [checkInSummaries,  setCheckInSummaries]  = useState({});
  const [summaryLoading,    setSummaryLoading]    = useState(false);
  const [digestResult,      setDigestResult]      = useState(null);
  const [digestSending,     setDigestSending]     = useState(false);
  const [testEmail,         setTestEmail]         = useState('');
  const [showDigestModal,   setShowDigestModal]   = useState(false);

  // Derived auth
  const isRestrictedView   = loginType === 'dor';
  const restrictedFacility = isRestrictedView ? selectedFacilityForLogin : null;

  // Derived data
  const allFacilities   = [...new Set(allWeeklyData.map(d => d.facility))].sort();
  const availableWeeks  = ['latest', ...Array.from(new Set(allWeeklyData.map(d => d.week))).sort((a,b) => parseInt(b)-parseInt(a))];

  const getCurrentWeekData = () => {
    const latest = Math.max(...allWeeklyData.map(d => parseInt(d.week)));
    const week   = selectedWeek === 'latest' ? String(latest) : selectedWeek;
    return allWeeklyData.filter(d => d.week === week);
  };

  const currentWeekData = getCurrentWeekData();
  const viewableData    = isRestrictedView ? currentWeekData.filter(f => f.facility === restrictedFacility) : currentWeekData;
  const myFacilityData  = isRestrictedView ? (currentWeekData.find(f => f.facility === restrictedFacility) || null) : null;
  const myRegion        = myFacilityData?.region || null;

  const goldenCoastData = currentWeekData.filter(d => d.region === 'Golden Coast');
  const overlandData    = currentWeekData.filter(d => d.region === 'Overland');

  const myPrevWeekData = (() => {
    if (!myFacilityData) return null;
    const weeks  = [...new Set(allWeeklyData.map(d => d.week))].sort((a,b) => parseInt(a)-parseInt(b));
    const curIdx = weeks.indexOf(myFacilityData.week);
    if (curIdx <= 0) return null;
    return allWeeklyData.find(d => d.facility === restrictedFacility && d.week === weeks[curIdx-1]) || null;
  })();

  const myFebFinal = (() => {
    if (!restrictedFacility) return null;
    const recs = allWeeklyData.filter(d => d.facility === restrictedFacility && d.date>=EXEC_MONTHS[EXEC_MONTHS.length-2].start && d.date<=EXEC_MONTHS[EXEC_MONTHS.length-2].end);
    return recs.length ? recs.sort((a,b) => parseInt(b.week)-parseInt(a.week))[0] : null;
  })();

  const myRegionData = (() => {
    if (!myRegion) return [];
    const latest = Math.max(...allWeeklyData.map(d => parseInt(d.week)));
    return allWeeklyData.filter(d => d.region === myRegion && parseInt(d.week) === latest);
  })();

  // Facility helpers
  const getFacilityHistory = name =>
    allWeeklyData.filter(d => d.facility === name).sort((a,b) => parseInt(a.week)-parseInt(b.week));

  const getMonthlyData = name => {
    const records = allWeeklyData.filter(d => d.facility === name);
    const groups  = {};
    records.forEach(r => {
      const m = r.date.substring(0, 7); // e.g. '2026-01' — avoids timezone misparse
      if (!groups[m]) groups[m] = [];
      groups[m].push(r);
    });
    return Object.keys(groups).sort().map(month => {
      const recs = groups[month].sort((a,b) => parseInt(a.week)-parseInt(b.week));
      const last = recs[recs.length-1];
      return {
        month,
        productivity:    mtd(last, 'productivityMTD',    'productivity'),
        cpm:             mtd(last, 'cpmMTD',             'cpm'),
        modeOfTreatment: mtd(last, 'modeOfTreatmentMTD', 'modeOfTreatment'),
        unitsPerVisit:   mtd(last, 'unitsPerVisitMTD',   'unitsPerVisit'),
        medBEligible:    last.medBEligible   || 0,
        medBCaseload:    last.medBCaseload   || 0,
        medBUnitsThisWeek: mtd(last, 'medBUnitsMTD',           'medBUnitsThisWeek'),
        medicareMPPRRevenue: mtd(last, 'medicareMPPRRevenueMTD', 'medicareMPPRRevenue'),
        weekCount: recs.length,
      };
    });
  };

  // Exec helpers
  const getMonthFinal = (facility, start, end) => {
    const recs = allWeeklyData.filter(d => d.facility === facility && d.date >= start && d.date <= end);
    return recs.length ? recs.sort((a,b) => parseInt(b.week)-parseInt(a.week))[0] : null;
  };

  const getMonthTotals = (start, end) => {
    const recs = allFacilities.map(f => getMonthFinal(f, start, end)).filter(Boolean);
    if (!recs.length) return null;
    return {
      avgProd:    (recs.reduce((s,r) => s + mtd(r,'productivityMTD','productivity'), 0) / recs.length).toFixed(1),
      avgCPM:     (recs.reduce((s,r) => s + mtd(r,'cpmMTD','cpm'),                  0) / recs.length).toFixed(2),
      totalUnits: recs.reduce((s,r) => s + (r.medBUnitsMTD || r.medBUnitsThisWeek || 0), 0),
      totalRev:   recs.reduce((s,r) => s + (r.medicareMPPRRevenueMTD || r.medicareMPPRRevenue || 0), 0),
      totalRespRev: recs.reduce((s,r) => s + (r.respMedBRevenueMTD || 0), 0),
      atGoalProd: recs.filter(r => mtd(r,'productivityMTD','productivity') >= getGoals(r.facility).productivity).length,
      atGoalCPM:  recs.filter(r => mtd(r,'cpmMTD','cpm') <= getGoals(r.facility).cpm && mtd(r,'cpmMTD','cpm') > 0).length,
      atGoalMode: recs.filter(r => mtd(r,'modeOfTreatmentMTD','modeOfTreatment') >= getGoals(r.facility).mode).length,
      atGoalMedB: recs.filter(r => { const el=r.medBEligible||0; const cl=r.medBCaseload||0; return el>0 && (cl/el*100)>=getGoals(r.facility).medB; }).length,
      atGoalAll:  recs.filter(r => {
        const g=getGoals(r.facility);
        const el=r.medBEligible||0; const cl=r.medBCaseload||0;
        return mtd(r,'productivityMTD','productivity')>=g.productivity &&
               mtd(r,'cpmMTD','cpm')<=g.cpm && mtd(r,'cpmMTD','cpm')>0 &&
               mtd(r,'modeOfTreatmentMTD','modeOfTreatment')>=g.mode &&
               el>0 && (cl/el*100)>=g.medB;
      }).length,
      n: recs.length,
    };
  };

  // Filtered facilities for admin view
  const filteredFacilities = viewableData.filter(f => {
    const matchSearch = !searchTerm || f.facility.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRegion = selectedRegion === 'all' || f.region === selectedRegion;
    const p = mtd(f,'productivityMTD','productivity');
    const c = mtd(f,'cpmMTD','cpm');
    const matchProd = filterProductivity === 'all' || (filterProductivity === 'meeting' ? p >= getGoals(f.facility).productivity : p < getGoals(f.facility).productivity);
    const matchCPM  = filterCPM === 'all'          || (filterCPM === 'meeting'          ? c <= getGoals(f.facility).cpm : c > getGoals(f.facility).cpm);
    return matchSearch && matchRegion && matchProd && matchCPM;
  });

  // Computed display values
  const latestDateStr = allWeeklyData.reduce((max,d) => d.date > max ? d.date : max, '');
  const throughDate = (() => {
    const d = new Date(latestDateStr);
    // Use last day of the month (MTD report)
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return lastDay.toISOString().split('T')[0];
  })();
  const currentMonthName = (() => {
    const d = new Date(latestDateStr);
    return d.toLocaleString('default', { month: 'long' });
  })();

  // ── Sparkline helper (returns SVG path from array of values)
  const sparkPath = (vals) => {
    if (!vals || vals.length < 2) return '';
    const min = Math.min(...vals), max = Math.max(...vals);
    const range = max - min || 1;
    const w = 80, h = 28;
    const pts = vals.map((v, i) => {
      const x = (i / (vals.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    });
    return `M${pts.join('L')}`;
  };

  // ── Month-end projection
  const monthEndProjection = (() => {
    if (!myFacilityData) return null;
    const d = new Date(latestDateStr);
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const dayOfMonth  = d.getDate();
    const pct = dayOfMonth / daysInMonth;
    if (pct <= 0) return null;
    const p   = mtd(myFacilityData,'productivityMTD','productivity');
    const c   = mtd(myFacilityData,'cpmMTD','cpm');
    const mo  = mtd(myFacilityData,'modeOfTreatmentMTD','modeOfTreatment');
    const upv = mtd(myFacilityData,'unitsPerVisitMTD','unitsPerVisit');
    const rev = mtd(myFacilityData,'medicareMPPRRevenueMTD','medicareMPPRRevenue');
    return {
      productivity:    +(p).toFixed(1),
      cpm:             +(c).toFixed(2),
      modeOfTreatment: +(mo).toFixed(1),
      unitsPerVisit:   +(upv).toFixed(2),
      revenue:         +(rev / pct).toFixed(0),
      daysIn: dayOfMonth,
      daysTotal: daysInMonth,
    };
  })();

  // ── 4-week sparkline data for DOR building
  const dorSparkData = (() => {
    if (!restrictedFacility) return null;
    const recs = allWeeklyData
      .filter(d => d.facility === restrictedFacility)
      .sort((a,b) => parseInt(a.week)-parseInt(b.week))
      .slice(-4);
    return {
      productivity:    recs.map(r => mtd(r,'productivityMTD','productivity')),
      cpm:             recs.map(r => mtd(r,'cpmMTD','cpm')),
      modeOfTreatment: recs.map(r => mtd(r,'modeOfTreatmentMTD','modeOfTreatment')),
      unitsPerVisit:   recs.map(r => mtd(r,'unitsPerVisitMTD','unitsPerVisit')),
    };
  })();

  // ── Sparkline trend color (up=green, down=red, flat=gray)
  const sparkColor = (vals, higherIsBetter = true) => {
    if (!vals || vals.length < 2) return '#94a3b8';
    const first = vals[0], last = vals[vals.length - 1];
    const delta = last - first;
    if (Math.abs(delta) < 0.01) return '#94a3b8';
    const improving = higherIsBetter ? delta > 0 : delta < 0;
    return improving ? '#34d399' : '#f87171';
  };

  // ── Resources loader
  useEffect(() => {
    if (!isAuthenticated || !isRestrictedView) return;
    const load = async () => {
      try {
        setResourcesLoading(true);
        const res = await fetch('/resources/resources-config.json');
        if (!res.ok) throw new Error('Failed to load');
        const config = await res.json();
        setGithubResources(config.categories || []);
      } catch {
        setResourcesError('Unable to load resources. Please contact your administrator.');
      } finally {
        setResourcesLoading(false);
      }
    };
    load();
  }, [isAuthenticated, isRestrictedView]);

  // Load resources for standalone resources-only access
  useEffect(() => {
    if (!resourcesAccess) return;
    const load = async () => {
      try {
        const res = await fetch('/resources/resources-config.json');
        if (!res.ok) throw new Error('Failed to load');
        const config = await res.json();
        setGithubResources(config.categories || []);
      } catch { /* silent */ }
    };
    load();
  }, [resourcesAccess]);

  // ── Auth handlers
  const handlePasswordSubmit = e => {
    e.preventDefault();
    if (loginType === 'admin' && passwordAttempt === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setPasswordAttempt('');
      setActiveView('overview');
    } else if (loginType === 'dor' && selectedFacilityForLogin) {
      const correct = DOR_PASSWORDS[selectedFacilityForLogin];
      if (passwordAttempt === MASTER_DOR_PASSWORD || passwordAttempt === correct) {
        setIsAuthenticated(true);
        setPasswordAttempt('');
        setActiveView('facilities');
      } else {
        alert('Incorrect password. Please try again.');
        setPasswordAttempt('');
      }
    } else {
      alert('Please select access type and enter your password.');
      setPasswordAttempt('');
    }
  };

  // ── AI Briefing
  const generateBriefing = async () => {
    if (!myFacilityData) return;
    setBriefingLoading(true);
    setBriefingText('');
    const p    = mtd(myFacilityData,'productivityMTD','productivity');
    const c    = mtd(myFacilityData,'cpmMTD','cpm');
    const mo   = mtd(myFacilityData,'modeOfTreatmentMTD','modeOfTreatment');
    const upv  = mtd(myFacilityData,'unitsPerVisitMTD','unitsPerVisit');
    const rev  = mtd(myFacilityData,'medicareMPPRRevenueMTD','medicareMPPRRevenue');
    const cas  = myFacilityData.medBCaseload || 0;
    const elig = myFacilityData.medBEligible || 0;
    const buildingData = {
      building: myFacilityData.facility,
      region: myFacilityData.region,
      productivity: { current: p.toFixed(1), target: 84, trend: myPrevWeekData ? (p - mtd(myPrevWeekData,'productivityMTD','productivity')).toFixed(1)+'pp vs last week' : 'n/a' },
      cpm: { current: Math.trunc(c*100)/100, target: 1.45, trend: myPrevWeekData ? (c - mtd(myPrevWeekData,'cpmMTD','cpm')).toFixed(2)+' vs last week' : 'n/a' },
      modeOfTreatment: { cgPct: mo.toFixed(1), trend: myPrevWeekData ? (mo - mtd(myPrevWeekData,'modeOfTreatmentMTD','modeOfTreatment')).toFixed(1)+'pp vs last week' : 'n/a' },
      unitsPerVisit: upv.toFixed(2),
      medB: { caseload: cas, eligible: elig, pct: elig > 0 ? Math.round((cas/elig)*100) : 0, revenueMTD: '$'+rev.toFixed(0) },
    };
    const prompt = `You are an AI assistant embedded in Therascope, a therapy operations dashboard for skilled nursing facilities. A Director of Rehabilitation (DOR) has just logged in to review their weekly data. Based on their building's current week data, write a concise practical weekly briefing — 3 short paragraphs. Be direct and specific, using actual numbers. Prioritize the most urgent items first. Write as a knowledgeable colleague giving a quick verbal handoff at the start of the week. No markdown, no bullet points, no headers. Under 180 words.\n\nGoals and thresholds:\n- Productivity: goal is 84% or above\n- CPM: goal is $1.45 or below (lower is better)\n- Mode of treatment (C/G %): goal is 4% or above (higher is better — more group/concurrent treatment is desirable)\n- Units per visit (UPV): goal is 3.0 or above (higher is better)\n- Med B caseload: goal is 50% or more of eligible patients on caseload\n\nBuilding data (week ending ${throughDate}):\n${JSON.stringify(buildingData, null, 2)}`;
    try {
      const res = await fetch('/api/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] })
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === 'text')?.text || 'Unable to generate briefing.';
      setBriefingText(text);
    } catch { setBriefingText('Unable to generate briefing. Please try again.'); }
    setBriefingLoading(false);
  };

  // ── DOR PDF Report
  const generateMyReport = async () => {
    if (!window.confirm(`Generate your report for ${restrictedFacility}?`)) return;
    try {
      const latest  = Math.max(...allWeeklyData.map(d => parseInt(d.week)));
      const myData  = allWeeklyData.find(d => d.facility === restrictedFacility && parseInt(d.week) === latest);
      if (!myData) { alert('No data found for your facility this week.'); return; }
      const history = allWeeklyData.filter(d => d.facility === restrictedFacility)
        .sort((a,b) => parseInt(a.week)-parseInt(b.week)).slice(-4);

      const doc  = new jsPDF();
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFillColor(15,23,42); doc.rect(0,0,pageW,pageH,'F');
      doc.setTextColor(255,255,255); doc.setFontSize(20); doc.setFont('helvetica','bold');
      doc.text(myData.facility, pageW/2, 30, { align: 'center' });
      doc.setFontSize(11); doc.setFont('helvetica','normal'); doc.setTextColor(148,163,184);
      doc.text(`Week ${myData.week} · ${myData.date} · ${myData.region}`, pageW/2, 40, { align: 'center' });

      const p   = mtd(myData,'productivityMTD','productivity');
      const c   = mtd(myData,'cpmMTD','cpm');
      const mo  = mtd(myData,'modeOfTreatmentMTD','modeOfTreatment');
      const upv = mtd(myData,'unitsPerVisitMTD','unitsPerVisit');
      const rev = mtd(myData,'medicareMPPRRevenueMTD','medicareMPPRRevenue');
      const elig = myData.medBEligible || 0, cas = myData.medBCaseload || 0;

      doc.autoTable({
        startY: 50,
        head: [['Metric','MTD Value','Goal','Status']],
        body: [
          ['Productivity',   p.toFixed(1)+'%',  '>= 84%',       p >= 84 ? '✓' : '✗'],
          ['CPM',           '$'+Math.trunc(c*100)/100,   '< $1.45',      c <= 1.45 ? '✓' : '✗'],
          ['Mode of Tx',    mo.toFixed(1)+'%',  '>= 4%',        parseFloat(mo.toFixed(1)) >= 4 ? '✓' : '✗'],
          ['Units/Visit',   upv.toFixed(2),     '—',            '—'],
          ['Med B Rev MTD', '$'+(rev/1000).toFixed(1)+'k', '—', '—'],
          ['Med B Eligible', String(elig),       '—',            '—'],
          ['On Caseload',   String(cas),         '>= 50% of elig', elig > 0 && cas/elig >= 0.5 ? '✓' : '✗'],
        ],
        theme: 'grid',
        headStyles: { fillColor:[6,182,212], textColor:[255,255,255], fontStyle:'bold' },
        bodyStyles: { fillColor:[30,41,59], textColor:[255,255,255] },
        alternateRowStyles: { fillColor:[51,65,85] },
      });

      if (history.length > 1) {
        doc.addPage();
        doc.setFillColor(15,23,42); doc.rect(0,0,pageW,pageH,'F');
        doc.setTextColor(255,255,255); doc.setFontSize(14); doc.setFont('helvetica','bold');
        doc.text('Recent Weekly Trend', 14, 20);
        doc.autoTable({
          startY: 28,
          head: [['Week','Date','Prod%','CPM','Mode%','UPV']],
          body: history.map(r => [r.week, r.date, (r.productivity||0)+'%', '$'+(r.cpm||0), (r.modeOfTreatment||0)+'%', (r.unitsPerVisit||0).toFixed(2)]),
          theme: 'grid',
          headStyles: { fillColor:[6,182,212], textColor:[255,255,255], fontStyle:'bold' },
          bodyStyles: { fillColor:[30,41,59], textColor:[255,255,255] },
          alternateRowStyles: { fillColor:[51,65,85] },
        });
      }
      doc.save(`DOR_${restrictedFacility.replace(/ /g,'_')}_Week_${latest}.pdf`);
    } catch(e) { console.error(e); alert('PDF generation failed.'); }
  };

  // ── Compliance File Upload
  const handleComplianceUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs');
    const buf  = await file.arrayBuffer();
    const wb   = XLSX.read(buf);
    const result = {};
    ['Overland', 'Golden Coast'].forEach(sheet => {
      if (!wb.SheetNames.includes(sheet)) return;
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet]);
      result[sheet] = rows.map(r => ({
        building:   r['Building']         || '',
        status:     (r['Status']          || '').trim(),
        actionItem: r['Notes / Action Items'] || r['Action Items'] || '',
      })).filter(r => r.building);
    });
    setComplianceData(result);
  };

  // ── Generate Narratives (separate pre-step)
  const generateNarratives = async (region) => {
    setNarrativeLoading(true);
    const regionFacilities = allFacilities.filter(f => allWeeklyData.find(d=>d.facility===f)?.region===region);
    const facilityData = regionFacilities.map(fac => ({
      facility: fac,
      jan: getMonthFinal(fac, EXEC_MONTHS[0].start, EXEC_MONTHS[0].end),
      feb: getMonthFinal(fac, EXEC_MONTHS[1].start, EXEC_MONTHS[1].end),
      mar: getMonthFinal(fac, EXEC_MONTHS[2].start, EXEC_MONTHS[2].end),
      apr: getMonthFinal(fac, EXEC_MONTHS[3].start, EXEC_MONTHS[3].end),
      may: getMonthFinal(fac, EXEC_MONTHS[4].start, EXEC_MONTHS[4].end),
      jun: getMonthFinal(fac, EXEC_MONTHS[5].start, EXEC_MONTHS[5].end),
    })).filter(r => r.jan || r.feb || r.mar || r.apr || r.may || r.jun);

    const fmt = (rec, facName) => rec ? { prod: mtd(rec,'productivityMTD','productivity').toFixed(1)+'%', cpm: '$'+Math.trunc(mtd(rec,'cpmMTD','cpm')*100)/100, mode: mtd(rec,'modeOfTreatmentMTD','modeOfTreatment').toFixed(1)+'%', medB: rec.medBEligible>0?Math.round((rec.medBCaseload/rec.medBEligible)*100)+'%':'N/A', score: scoreRec(rec, facName)+'/4' } : null;
    const dataSummary = facilityData.map(r => ({ facility: r.facility, jan: fmt(r.jan, r.facility), feb: fmt(r.feb, r.facility), mar: fmt(r.mar, r.facility), apr: fmt(r.apr, r.facility), may: fmt(r.may, r.facility) }));

    let result = { spotlight: { topPerformers: [], needsAttention: [] }, deepDives: {} };
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 55000);
      const res = await fetch('/api/briefing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: `You are writing a therapy performance review for a Chief Therapy Officer. Write narratives for the ${region} region.

Goals: Productivity >= 84%, CPM < $1.45, Med B >= 50% on caseload, Mode of Treatment >= 4%.

Data for each building (3 months):
${JSON.stringify(dataSummary, null, 2)}

Return ONLY valid JSON, no markdown or extra text:
{
  "spotlight": {
    "topPerformers": [{"facility":"...","callout":"1-2 sentence summary of what makes them a top performer","scores":["Jan: X/4","Feb: X/4","Mar: X/4"]}],
    "needsAttention": [{"facility":"...","callout":"1-2 sentence summary of key issues","scores":["Jan: X/4","Feb: X/4","Mar: X/4"]}]
  },
  "deepDives": {
    "Facility Name": "2-3 sentence narrative using specific numbers. Identify the story arc across 3 months. Mention what is working and what needs attention."
  }
}

Include 2-3 buildings in topPerformers and 2-3 in needsAttention. Write a deepDive for every facility.` }] }),
        signal: controller.signal,
      });
      clearTimeout(tid);
      const data = await res.json();
      const text = data.content?.find(b=>b.type==='text')?.text||'{}';
      result = JSON.parse(text.replace(/```json|```/g,'').trim());
    } catch(e) { console.error('Narrative error:', e); }

    setSavedNarratives(prev => ({ ...prev, [region]: result }));
    setNarrativeLoading(false);
  };

  // ── Region Report Generator
  const generateRegionReport = async () => {
    if (!reportRegion) return;
    setReportGenerating(true);

    const regionFacilities = allFacilities.filter(f => allWeeklyData.find(d=>d.facility===f)?.region===reportRegion);
    const facilityData = regionFacilities.map(fac => ({
      facility: fac,
      jan:  getMonthFinal(fac, EXEC_MONTHS[0].start, EXEC_MONTHS[0].end),
      feb:  getMonthFinal(fac, EXEC_MONTHS[1].start, EXEC_MONTHS[1].end),
      mar:  getMonthFinal(fac, EXEC_MONTHS[2].start, EXEC_MONTHS[2].end),
      apr:  getMonthFinal(fac, EXEC_MONTHS[3].start, EXEC_MONTHS[3].end),
      may:  getMonthFinal(fac, EXEC_MONTHS[4].start, EXEC_MONTHS[4].end),
    })).filter(r => r.jan || r.feb || r.mar || r.apr || r.may);

    const narratives = savedNarratives[reportRegion] || { spotlight: { topPerformers: [], needsAttention: [] }, deepDives: {} };

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pW = doc.internal.pageSize.getWidth();
    const pH = doc.internal.pageSize.getHeight();
    const margin = 14;
    const col = {
      gold:  [212,175,55], teal:  [13,148,136], dark:  [15,23,42],
      slate: [100,116,139], white: [255,255,255], green: [52,211,153],
      red:   [248,113,113], yellow:[251,191,36],  navy:  [22,33,55], darknavy:[18,28,48],
    };

    const setFill  = (c) => doc.setFillColor(c[0],c[1],c[2]);
    const setStroke= (c) => doc.setDrawColor(c[0],c[1],c[2]);
    const setTxt   = (c) => doc.setTextColor(c[0],c[1],c[2]);

    const addPage = () => { doc.addPage(); setFill(col.dark); doc.rect(0,0,pW,pH,'F'); };

    const sectionDot = (y, text) => {
      setFill(col.teal); doc.circle(margin, y+2, 2, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(13); setTxt(col.white);
      doc.text(text, margin+5, y+3);
      return y + 11;
    };

    const goalColor = (key, val) => {
      const v = parseFloat(val);
      if (key==='prod') return v>=84 ? col.green : col.red;
      if (key==='cpm')  return v<=1.45 ? col.green : col.red;
      if (key==='mode') return v>=4 ? col.green : col.red;
      if (key==='medb') return v>=50 ? col.green : col.red;
      return col.white;
    };

    // ── PAGE 1: Cover
    setFill(col.dark); doc.rect(0,0,pW,pH,'F');
    setStroke(col.teal); doc.setLineWidth(0.5); doc.line(margin,38,pW-margin,38);
    doc.setFont('helvetica','normal'); doc.setFontSize(9); setTxt(col.gold);
    doc.text('THERAPY PERFORMANCE REVIEW', margin, 28);
    doc.setFont('helvetica','bold'); doc.setFontSize(34); setTxt(col.white);
    doc.text(reportRegion, margin, 52);
    doc.setFont('helvetica','italic'); doc.setFontSize(18); setTxt(col.teal);
    doc.text('Region', margin + doc.getTextWidth(reportRegion)+2, 52);
    doc.setFont('helvetica','normal'); doc.setFontSize(11); setTxt(col.slate);
    const m0 = EXEC_MONTHS[0].label.replace(' MTD',''), m2 = EXEC_MONTHS[2].label.replace(' MTD','');
    doc.text(`${m0} through ${m2} 2026`, margin, 62);
    doc.setFont('helvetica','normal'); doc.setFontSize(9); setTxt(col.slate);
    doc.text('PREPARED', pW-margin-28, 28);
    doc.setFont('helvetica','bold'); doc.setFontSize(13); setTxt(col.white);
    doc.text('April 2026', pW-margin-28, 36);

    // Goals bar
    setFill(col.navy); doc.roundedRect(margin,76,pW-margin*2,36,3,3,'F');
    const goals = [['PRODUCTIVITY','>=84%','All staff incl. DOR'],['COST PER MINUTE','<$1.45','Including DOR time'],['MED B ON CASELOAD','>=50%','Of eligible patients'],['MODE OF TREATMENT','>=4%','Group / concurrent']];
    goals.forEach((g,i) => {
      const x = margin+4 + i*((pW-margin*2-8)/4);
      doc.setFont('helvetica','normal'); doc.setFontSize(7); setTxt(col.slate); doc.text(g[0],x,86);
      doc.setFont('helvetica','bold'); doc.setFontSize(12); setTxt(col.gold); doc.text(g[1],x,95);
      doc.setFont('helvetica','normal'); doc.setFontSize(7); setTxt(col.slate); doc.text(g[2],x,101);
    });

    // ── PAGE 2: 3-Month Region Summary
    addPage(); let y = 18;
    y = sectionDot(y, EXEC_MONTHS[0].label.replace(' MTD','')+' – '+EXEC_MONTHS[EXEC_MONTHS.length-1].label.replace(' MTD','')+' Region Summary'); y += 4;

    const months = EXEC_MONTHS.map(m => {
      const finals = regionFacilities.map(f=>getMonthFinal(f,m.start,m.end)).filter(Boolean);
      if (!finals.length) return null;
      const n = finals.length;
      const avgProd = (finals.reduce((s,r)=>s+mtd(r,'productivityMTD','productivity'),0)/n);
      const avgCPM  = (finals.reduce((s,r)=>s+mtd(r,'cpmMTD','cpm'),0)/n);
      return {
        label: m.label, isLatest: m===EXEC_MONTHS[EXEC_MONTHS.length-1],
        avgProd: avgProd.toFixed(1)+'%', avgCPM: '$'+Math.trunc(avgCPM*100)/100,
        units: finals.reduce((s,r)=>s+(r.medBUnitsMTD||r.medBUnitsThisWeek||0),0).toLocaleString(),
        rev:   '$'+(finals.reduce((s,r)=>s+mtd(r,'medicareMPPRRevenueMTD','medicareMPPRRevenue'),0)).toLocaleString(undefined,{maximumFractionDigits:0}),
        atProd: finals.filter(r=>mtd(r,'productivityMTD','productivity')>=84).length+' / '+n,
        atCPM:  finals.filter(r=>mtd(r,'cpmMTD','cpm')<=1.45).length+' / '+n,
        prodGood: avgProd>=84, cpmGood: avgCPM<=1.45,
      };
    }).filter(Boolean);

    const bW = (pW-margin*2-8)/3;
    months.forEach((m,i) => {
      const x = margin + i*(bW+4);
      setFill(col.navy); doc.roundedRect(x,y,bW,76,3,3,'F');
      if (m.isLatest) { setStroke(col.teal); doc.setLineWidth(0.4); doc.roundedRect(x,y,bW,76,3,3,'S'); }
      doc.setFont('helvetica','bold'); doc.setFontSize(14);
      setTxt(m.isLatest?col.teal:col.white); doc.text(m.label,x+4,y+11);
      if (m.isLatest) {
        setFill(col.teal); doc.roundedRect(x+bW-20,y+4,17,6,1,1,'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(6); setTxt(col.white); doc.text('Latest',x+bW-18,y+8.5);
      }
      const rows = [['Avg Productivity',m.avgProd,m.prodGood],['Avg CPM',m.avgCPM,m.cpmGood],['Med B Units',m.units,null],['Med B Revenue',m.rev,null],['At Prod Goal',m.atProd,null],['At CPM Goal',m.atCPM,null]];
      rows.forEach((r,ri) => {
        const ry = y+20+ri*8.5;
        doc.setFont('helvetica','normal'); doc.setFontSize(7.5); setTxt(col.slate); doc.text(r[0],x+4,ry);
        doc.setFont('helvetica','bold'); doc.setFontSize(8.5);
        setTxt(r[2]===true?col.green:r[2]===false?col.red:col.white);
        doc.text(r[1], x+bW-4-doc.getTextWidth(r[1]), ry);
        if (ri<5) { doc.setDrawColor(30,50,70); doc.setLineWidth(0.15); doc.line(x+4,ry+1.5,x+bW-4,ry+1.5); }
      });
    });
    y += 82;

    // ── PAGE 3: Building Scorecard (landscape)
    doc.addPage('letter', 'landscape');
    const pWL = doc.internal.pageSize.getWidth();
    const pHL = doc.internal.pageSize.getHeight();
    setFill(col.dark); doc.rect(0,0,pWL,pHL,'F');
    y = 18;
    y = sectionDot(y, 'Building Scorecard'); y += 3;
    doc.setFont('helvetica','normal'); doc.setFontSize(8); setTxt(col.slate);
    doc.text('Green = at goal  |  Red = below goal', margin, y); y += 5;

    const scHead = [
      ['', ...EXEC_MONTHS.flatMap(m=>[{ content: m.label.replace(' MTD',''), colSpan:5, styles:{halign:'center', fontStyle:'bold', textColor:col.white, fillColor:[30,41,59]} }])],
      ['FACILITY', ...EXEC_MONTHS.flatMap(()=>['PROD','CPM','MODE%','MEDB%','SCORE'])],
    ];
    const scBody = facilityData.map(r => [
      r.facility,
      ...[r.jan,r.feb,r.mar].flatMap(rec => rec ? [
        mtd(rec,'productivityMTD','productivity').toFixed(1)+'%',
        '$'+Math.trunc(mtd(rec,'cpmMTD','cpm')*100)/100,
        mtd(rec,'modeOfTreatmentMTD','modeOfTreatment').toFixed(1)+'%',
        rec.medBEligible>0?Math.round((rec.medBCaseload/rec.medBEligible)*100)+'%':'--',
        scoreRec(rec, r.facility)+'/4',
      ] : ['--','--','--','--','--']),
    ]);

    doc.autoTable({
      head: scHead, body: scBody, startY: y,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2.5, textColor: col.white, fillColor: col.navy, font: 'helvetica', overflow: 'linebreak' },
      headStyles: { fillColor: [30,41,59], textColor: col.slate, fontStyle: 'bold', fontSize: 7, halign: 'center' },
      columnStyles: { 0: { cellWidth: 32, halign: 'left' } },
      alternateRowStyles: { fillColor: col.darknavy },
      margin: { left: margin, right: margin },
      tableWidth: pWL - margin * 2,
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        const ci = data.column.index;
        if (ci === 0) return;
        const offset = (ci - 1) % 5;
        const v = parseFloat(data.cell.raw);
        if (isNaN(v)) return;
        if (offset===0) { data.cell.styles.textColor = v>=84?col.green:col.red; data.cell.styles.fontStyle='bold'; }
        else if (offset===1) { data.cell.styles.textColor = v<=1.45?col.green:col.red; data.cell.styles.fontStyle='bold'; }
        else if (offset===2) { data.cell.styles.textColor = v>=4?col.green:col.red; data.cell.styles.fontStyle='bold'; }
        else if (offset===3) { data.cell.styles.textColor = v>=50?col.green:col.red; data.cell.styles.fontStyle='bold'; }
      }
    });

    // ── PAGE 4: Spotlight (back to portrait)
    doc.addPage('letter', 'portrait');
    setFill(col.dark); doc.rect(0,0,pW,pH,'F');
    y = 18;
    y = sectionDot(y, 'Spotlight'); y += 4;

    const drawSection = (title, items, headerBg, dotC, yStart) => {
      let cy = yStart;
      setFill(headerBg); doc.roundedRect(margin,cy,pW-margin*2,9,2,2,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(9.5); setTxt(col.white);
      doc.text(title, margin+4, cy+6.5);
      cy += 13;
      (items||[]).slice(0,3).forEach(item => {
        setFill(col.navy); doc.roundedRect(margin,cy,pW-margin*2,20,2,2,'F');
        setFill(dotC); doc.circle(margin+5,cy+10,2.5,'F');
        doc.setFont('helvetica','bold'); doc.setFontSize(9); setTxt(col.white);
        doc.text(item.facility||'', margin+11, cy+8);
        doc.setFont('helvetica','normal'); doc.setFontSize(7.5); setTxt(col.slate);
        const callout = item.callout||'';
        doc.text(callout, margin+11, cy+15, { maxWidth: pW-margin*2-50 });
        const scoreStr = (item.scores||[]).join('  /  ');
        doc.setFont('helvetica','bold'); doc.setFontSize(7); setTxt(dotC);
        doc.text(scoreStr, pW-margin-doc.getTextWidth(scoreStr)-2, cy+8);
        cy += 24;
      });
      return cy;
    };

    y = drawSection('Top Performers ('+m0+' to '+m2+')', narratives.spotlight?.topPerformers, [20,83,45], col.green, y);
    y += 6;
    y = drawSection('Needs Attention', narratives.spotlight?.needsAttention, [100,20,20], col.red, y);

    // ── PAGE 5+: Deep Dives
    addPage(); y = 18;
    y = sectionDot(y, 'Building Deep Dives -- All '+facilityData.length+' Facilities'); y += 4;

    for (let fi=0; fi<facilityData.length; fi++) {
      const r = facilityData[fi];
      if (y + 58 > pH-12) { addPage(); y = 18; }

      const lastRec = r.mar||r.feb||r.jan;
      const score = lastRec ? scoreRec(lastRec, r.facility) : 0;
      const badge = score>=3?'TOP PERFORMER':score<=1?'NEEDS ATTENTION':'DEVELOPING';
      const badgeC = badge==='TOP PERFORMER'?col.green:badge==='NEEDS ATTENTION'?col.red:col.yellow;

      setFill(col.navy); doc.roundedRect(margin,y,pW-margin*2,56,3,3,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(11); setTxt(col.white);
      doc.text(r.facility, margin+4, y+9);
      const bw2 = doc.getTextWidth(badge)+6;
      setFill(badgeC); doc.roundedRect(pW-margin-bw2-1,y+3,bw2+1,7,1,1,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(6); setTxt(col.dark);
      doc.text(badge, pW-margin-bw2+1.5, y+8);

      // 3 sparklines side by side
      const metrics = [
        { label:'PRODUCTIVITY', vals:[r.jan,r.feb,r.mar].filter(Boolean).map(rec=>mtd(rec,'productivityMTD','productivity')), goal:84, higher:true },
        { label:'CPM', vals:[r.jan,r.feb,r.mar].filter(Boolean).map(rec=>mtd(rec,'cpmMTD','cpm')), goal:1.45, higher:false },
        { label:'MODE OF TX', vals:[r.jan,r.feb,r.mar].filter(Boolean).map(rec=>mtd(rec,'modeOfTreatmentMTD','modeOfTreatment')), goal:4, higher:true },
      ];
      const sparkW = (pW-margin*2-12)/3;
      metrics.forEach((met,mi) => {
        const sx = margin+4 + mi*(sparkW+2);
        const sy = y+14;
        const sh = 18;
        doc.setFont('helvetica','bold'); doc.setFontSize(6); setTxt(col.slate);
        doc.text(met.label, sx, sy-1);
        const lastV = met.vals[met.vals.length-1];
        const isGood = met.higher ? lastV>=met.goal : lastV<=met.goal;
        const lineC = isGood?col.green:col.red;
        if (met.vals.length>=2) {
          const mn = Math.min(...met.vals), mx = Math.max(...met.vals), rng = mx-mn||0.5;
          const pts = met.vals.map((v,i)=>({ x: sx+(i/(met.vals.length-1))*(sparkW-8), y: sy+sh-((v-mn)/rng)*sh }));
          setStroke(lineC); doc.setLineWidth(0.6);
          for (let i=0;i<pts.length-1;i++) doc.line(pts[i].x,pts[i].y,pts[i+1].x,pts[i+1].y);
          setFill(lineC); doc.circle(pts[pts.length-1].x,pts[pts.length-1].y,1.2,'F');
        }
        const monthLabels = EXEC_MONTHS.filter((_,i)=>[r.jan,r.feb,r.mar][i]).map(m=>m.label.replace(' MTD','').slice(0,3));
        met.vals.forEach((v,i) => {
          const px = sx+(i/(met.vals.length-1))*(sparkW-8);
          doc.setFont('helvetica','normal'); doc.setFontSize(5); setTxt(col.slate);
          doc.text(monthLabels[i]||'', px-3, sy+sh+4);
          doc.setFont('helvetica','bold'); doc.setFontSize(6); setTxt(col.white);
          const vStr = mi===1?v.toFixed(2):v.toFixed(1);
          doc.text(vStr, px-doc.getTextWidth(vStr)/2, sy+sh+9);
        });
      });

      // Narrative
      const narrative = narratives.deepDives?.[r.facility] || '';
      if (narrative) {
        doc.setFont('helvetica','normal'); doc.setFontSize(7.5); setTxt(col.slate);
        doc.text(narrative, margin+4, y+44, { maxWidth: pW-margin*2-8 });
      }
      y += 60;
    }

    // ── April MTD Preview
    addPage(); y = 18;
    const aprLabel = 'Apr 1-'+throughDate.slice(8);
    y = sectionDot(y, 'April MTD Preview ('+aprLabel+')'); y += 4;

    const aprilRecs = regionFacilities.map(f => {
      const latest = allWeeklyData.filter(d=>d.facility===f).sort((a,b)=>parseInt(b.week)-parseInt(a.week))[0];
      if (!latest) return null;
      return { facility:f, prod:mtd(latest,'productivityMTD','productivity'), cpm:mtd(latest,'cpmMTD','cpm'), mode:mtd(latest,'modeOfTreatmentMTD','modeOfTreatment'), medB:latest.medBEligible>0?Math.round((latest.medBCaseload/latest.medBEligible)*100):null };
    }).filter(Boolean);

    const cols3 = 2, cW = (pW-margin*2-4)/cols3;
    aprilRecs.forEach((rec,i) => {
      const cx = margin+(i%cols3)*(cW+4);
      const cy2 = y+Math.floor(i/cols3)*30;
      if (cy2+30>pH-12) { addPage(); y=18; }
      setFill(col.navy); doc.roundedRect(cx,cy2,cW,26,2,2,'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(8); setTxt(col.white);
      doc.text(rec.facility, cx+3, cy2+7);
      const fields = [['PROD',rec.prod.toFixed(1)+'%',rec.prod>=84],['CPM','$'+Math.trunc(rec.cpm*100)/100,rec.cpm<=1.45],['MODE',rec.mode.toFixed(1)+'%',rec.mode>=4],['MED B%',rec.medB!=null?rec.medB+'%':'--',rec.medB>=50]];
      fields.forEach((f2,fi) => {
        const fx = cx+3+fi*(cW-6)/4;
        doc.setFont('helvetica','normal'); doc.setFontSize(6); setTxt(col.slate); doc.text(f2[0],fx,cy2+14);
        doc.setFont('helvetica','bold'); doc.setFontSize(8); setTxt(f2[2]?col.green:col.red); doc.text(f2[1],fx,cy2+21);
      });
    });
    y += Math.ceil(aprilRecs.length/cols3)*32;

    // ── ALOS
    const alosRows = regionFacilities.map(f => {
      const a = alosData[f]||{};
      if (f === 'Palo Alto Post Acute') {
        return reportRegion === 'Golden Coast'
          ? [f,'--','--','--',a.apr||'--',a.may||'--',a.jun||'--']
          : [f,a.jan||'--',a.feb||'--',a.mar||'--','--','--','--'];
      }
      return [f,a.jan||'--',a.feb||'--',a.mar||'--',a.apr||'--',a.may||'--'];
    });
    if (alosRows.some(r=>r.slice(1).some(v=>v!=='--'))) {
      if (y+50>pH-12) { addPage(); y=18; }
      y = sectionDot(y, 'Average Length of Stay (days)'); y+=2;
      doc.setFont('helvetica','normal'); doc.setFontSize(7); setTxt(col.slate);
      doc.text('Red = below 30 days', margin, y); y+=4;
      doc.autoTable({ head:[['Building','Jan 2026','Feb 2026','Mar 2026','Apr','May','Jun']], body:alosRows, startY:y, theme:'grid', styles:{fontSize:8,cellPadding:2.5,textColor:col.white,fillColor:col.navy}, headStyles:{fillColor:[30,41,59],textColor:col.slate,fontStyle:'bold'}, alternateRowStyles:{fillColor:col.darknavy}, margin:{left:margin,right:margin}, didParseCell:(data)=>{ if(data.section==='body'&&data.column.index>0){const v=parseFloat(data.cell.raw);if(!isNaN(v)&&v<30){data.cell.styles.textColor=col.red;data.cell.styles.fontStyle='bold';}}} });
      y = doc.lastAutoTable.finalY+8;
    }

    // ── Compliance
    const comp = complianceData[reportRegion]||[];
    if (comp.length) {
      if (y+50>pH-12) { addPage(); y=18; }
      y = sectionDot(y,'Compliance Overview'); y+=3;
      const compBody = comp.map(r=>{ const s=(r.status||'').toLowerCase().replace(/\s/g,''); return [r.building, s.includes('green')?'Green':s.includes('red')?'Red':'Yellow', r.actionItem]; });
      doc.autoTable({ head:[['Building','Status','Action Item']], body:compBody, startY:y, theme:'grid', styles:{fontSize:7.5,cellPadding:2.5,textColor:col.white,fillColor:col.navy}, headStyles:{fillColor:[30,41,59],textColor:col.slate,fontStyle:'bold'}, alternateRowStyles:{fillColor:col.darknavy}, margin:{left:margin,right:margin}, didParseCell:(data)=>{ if(data.section==='body'&&data.column.index===1){const v=data.cell.raw;data.cell.styles.textColor=v==='Green'?col.green:v==='Red'?col.red:col.yellow;data.cell.styles.fontStyle='bold';} } });
    }

    // Footer
    const tp = doc.internal.getNumberOfPages();
    for (let p=1;p<=tp;p++) {
      doc.setPage(p);
      doc.setFont('helvetica','normal'); doc.setFontSize(7); setTxt(col.slate);
      doc.text(reportRegion+' Region  |  Therapy Performance Review  |  '+m0+'-'+m2+' 2026', margin, pH-7);
      doc.text('Therascope  |  Confidential', pW-margin-doc.getTextWidth('Therascope  |  Confidential'), pH-7);
    }

    doc.save(reportRegion.replace(/ /g,'_')+'_Therapy_Performance_'+throughDate+'.pdf');
    setReportGenerating(false);
    setShowReportModal(false);
  };

    // ── Weekly Digest Emailer
  const sendWeeklyDigest = async (testOverrideEmail = null) => {
    setDigestSending(true);
    setDigestResult(null);

    const latest = Math.max(...allWeeklyData.map(d => parseInt(d.week)));
    const currentWeek = allWeeklyData.filter(d => parseInt(d.week) === latest);
    const prevWeek    = allWeeklyData.filter(d => parseInt(d.week) === latest - 1);

    const results = { sent: [], skipped: [], failed: [] };

    for (const facility of allFacilities) {
      const email = testOverrideEmail || DOR_EMAILS[facility];
      if (!email) { results.skipped.push(facility); continue; }
      if (testOverrideEmail && results.sent.length > 0) { results.skipped.push(facility); continue; }

      const curr = currentWeek.find(d => d.facility === facility);
      if (!curr) { results.skipped.push(facility); continue; }

      const prev = prevWeek.find(d => d.facility === facility);
      const p    = mtd(curr,'productivityMTD','productivity');
      const c    = mtd(curr,'cpmMTD','cpm');
      const mo   = mtd(curr,'modeOfTreatmentMTD','modeOfTreatment');
      const upv  = mtd(curr,'unitsPerVisitMTD','unitsPerVisit');
      const cas  = curr.medBEligible > 0 ? Math.round((curr.medBCaseload/curr.medBEligible)*100) : 0;

      const pPrev  = prev ? mtd(prev,'productivityMTD','productivity') : p;
      const cPrev  = prev ? mtd(prev,'cpmMTD','cpm') : c;
      const moPrev = prev ? mtd(prev,'modeOfTreatmentMTD','modeOfTreatment') : mo;
      const upvPrev= prev ? mtd(prev,'unitsPerVisitMTD','unitsPerVisit') : upv;

      const alerts = [], wins = [];
      const bGoals = getGoals(facility);
    if (p < bGoals.productivity) alerts.push({ msg: `Productivity ${p.toFixed(1)}% — below ${bGoals.productivity}% goal`, severe: true });
      else if (p - pPrev <= -2) alerts.push({ msg: `Productivity dropped ${Math.abs(p-pPrev).toFixed(1)}pp this week`, severe: false });
      else if (p - pPrev >= 2)  wins.push(`Productivity up ${(p-pPrev).toFixed(1)}pp`);

      if (c > 1.45)            alerts.push({ msg: `CPM $${Math.trunc(c*100)/100} — above $1.45 target`, severe: c > 1.55 });
      else if (c - cPrev >= 0.05) alerts.push({ msg: `CPM rose $${(Math.trunc(Math.abs(c-cPrev)*100)/100)} this week`, severe: false });
      else if (c - cPrev <= -0.05) wins.push(`CPM improved $${Math.abs(Math.trunc(Math.abs(c-cPrev)*100)/100)}`);

      if (parseFloat(mo.toFixed(1)) < bGoals.mode)    alerts.push({ msg: `Mode of treatment ${mo.toFixed(1)}% — below ${bGoals.mode}% goal`, severe: mo === 0 });
      else if (mo - moPrev <= -2) alerts.push({ msg: `Mode dropped ${Math.abs(mo-moPrev).toFixed(1)}pp this week`, severe: false });
      else if (mo - moPrev >= 2)  wins.push(`Mode up ${(mo-moPrev).toFixed(1)}pp`);

      if (upv - upvPrev <= -0.3) alerts.push({ msg: `Units per visit dropped ${Math.abs(upv-upvPrev).toFixed(2)} this week`, severe: false });
      else if (upv - upvPrev >= 0.3) wins.push(`UPV up ${(upv-upvPrev).toFixed(2)}`);

      const metricRow = (label, val, good) => `
        <tr>
          <td style="padding:8px 12px;color:#94a3b8;font-size:13px;">${label}</td>
          <td style="padding:8px 12px;font-weight:700;font-size:14px;color:${good?'#34d399':'#f87171'};">${val}</td>
        </tr>`;

      const alertRow = (a) => `
        <div style="background:${a.severe?'rgba(248,113,113,0.1)':'rgba(251,191,36,0.1)'};border-left:3px solid ${a.severe?'#f87171':'#fbbf24'};padding:8px 12px;margin:6px 0;border-radius:4px;font-size:13px;color:#e2e8f0;">
          ${a.severe ? '🚨' : '⚠️'} ${a.msg}
        </div>`;

      const winRow = (w) => `
        <div style="background:rgba(52,211,153,0.1);border-left:3px solid #34d399;padding:8px 12px;margin:6px 0;border-radius:4px;font-size:13px;color:#e2e8f0;">
          ✅ ${w}
        </div>`;

      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:580px;margin:0 auto;padding:24px 16px;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0e7490,#0f766e);border-radius:16px;padding:24px;margin-bottom:20px;">
      <div style="font-size:11px;font-weight:700;color:#a5f3fc;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;">TheraScope · Weekly Digest</div>
      <div style="font-size:22px;font-weight:900;color:#ffffff;">${facility}</div>
      <div style="font-size:13px;color:#a5f3fc;margin-top:4px;">Week ending ${throughDate}</div>
    </div>

    <!-- Metrics -->
    <div style="background:#1e293b;border-radius:12px;padding:4px;margin-bottom:16px;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:1px solid rgba(255,255,255,0.1);">
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Metric</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">MTD Value</th>
          </tr>
        </thead>
        <tbody>
          ${metricRow('Productivity', p.toFixed(1)+'%', p >= 84)}
          ${metricRow('CPM', '$'+Math.trunc(c*100)/100, c <= 1.45)}
          ${metricRow('Mode of Treatment', mo.toFixed(1)+'%', parseFloat(mo.toFixed(1)) >= 4)}
          ${metricRow('Units Per Visit', upv.toFixed(2), upv >= 3)}
          ${metricRow('Med B on Caseload', cas+'%', cas >= 50)}
        </tbody>
      </table>
    </div>

    <!-- Alerts -->
    ${alerts.length > 0 ? `
    <div style="background:#1e293b;border-radius:12px;padding:16px;margin-bottom:16px;">
      <div style="font-size:12px;font-weight:700;color:#f87171;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;">⚠️ Alerts This Week</div>
      ${alerts.map(alertRow).join('')}
    </div>` : ''}

    <!-- Wins -->
    ${wins.length > 0 ? `
    <div style="background:#1e293b;border-radius:12px;padding:16px;margin-bottom:16px;">
      <div style="font-size:12px;font-weight:700;color:#34d399;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;">🏆 Wins This Week</div>
      ${wins.map(winRow).join('')}
    </div>` : ''}

    ${alerts.length === 0 && wins.length === 0 ? `
    <div style="background:#1e293b;border-radius:12px;padding:16px;margin-bottom:16px;text-align:center;color:#94a3b8;font-size:13px;">
      ✅ No major changes from last week — steady as she goes.
    </div>` : ''}

    <!-- CTA -->
    <div style="text-align:center;margin:20px 0;">
      <a href="https://therascope-insights.vercel.app" style="background:linear-gradient(135deg,#0e7490,#0f766e);color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:700;font-size:14px;display:inline-block;">
        View Your Dashboard →
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align:center;color:#475569;font-size:11px;margin-top:16px;">
      TheraScope · ${facility} · Week ending ${throughDate}<br>
      <span style="color:#334155;">Powered by therascopeai.com</span>
    </div>
  </div>
</body>
</html>`;

      try {
        const res = await fetch('/api/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: email,
            subject: `Therascope Weekly Digest — ${facility} — Week ending ${throughDate}`,
            html,
          }),
        });
        if (res.ok) results.sent.push(facility);
        else results.failed.push(facility);
      } catch { results.failed.push(facility); }
    }

    setDigestResult(results);
    setDigestSending(false);
  };

  // ── DOR Check-In Parser
  const handleCheckInUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs');
    const buf  = await file.arrayBuffer();
    const wb   = XLSX.read(buf);
    const ws   = wb.Sheets['Master'];
    if (!ws) return;
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const headers = rows[0];

    const col  = (name) => headers.findIndex(h => h && h.toString().toLowerCase().includes(name.toLowerCase()));
    const colExact = (name) => headers.findIndex(h => h && h.toString().replace(/\s+/g,' ').trim().toLowerCase() === name.toLowerCase());

    const parseWeekDate = (val) => {
      if (!val) return 'Unknown';
      const n = parseInt(val);
      if (n > 40000) {
        const d = new Date((n - 25569) * 86400 * 1000);
        return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      }
      const s = String(n).padStart(4, '0');
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const m = parseInt(s.slice(0,2));
      const d2 = parseInt(s.slice(2));
      return `${months[m-1]} ${d2}`;
    };

    // Map all section columns
    const iName     = col('your name');
    const iWeek     = col('week of');
    const iFacility = col('name of facility');
    const iSec1     = 8;  // Section 1: Therapy Delivery - Yes/No
    const iSec1No   = 9;  // If no, primary driver
    const iSec2a    = 10; // Section 2: Orders/careplans
    const iSec2b    = 11; // Section 2: Orders/careplans
    const iSec2c    = 12; // Section 2: Orders/careplans
    const iSec2d    = 13; // Section 2: Orders/careplans
    const iMissing  = 14; // Any Missing Labor
    const iSec1b    = 15; // Section 1 part 2
    const iSec3a    = 16; // Section 3: Compliance
    const iSec3b    = 17; // Section 3: Compliance notes
    const iSec3c    = 18; // Section 3: Compliance
    const iSec4     = 19; // Section 4: Staffing
    const iWeekend  = 20; // Weekend staffing
    const iSec5     = 21; // Section 5: Time load
    const iPulse1   = 22; // DOR Pulse Check
    const iPulse2   = 23; // DOR Pulse Check alt
    const iProd     = 26; // Team Productivity
    const iCPM      = 28; // CPM
    const iEligible = 30; // Part B eligible
    const iCaseload = 31; // Part B on caseload
    const iLT       = 32; // LT pickups
    const iMode     = 33; // Mode
    const iTravelers= 34; // Travelers
    const iStaffing = 35; // Open positions

    const isNo = (v) => { if (!v || typeof v !== 'string') return false; const t = v.trim().toLowerCase(); return t === 'no' || t.startsWith('no ') || t.startsWith('no-') || t.startsWith('no,'); };
    const isEmpty = (v) => !v || v.toString().trim() === '' || v.toString().toLowerCase() === 'none' || v.toString().toLowerCase() === 'n/a' || v.toString() === '0';

    const parsed = rows.slice(1).filter(r => r[iFacility]).map(r => ({
      dorName:        (r[iName] || '').trim(),
      week:           r[iWeek] || '',
      weekDisplay:    parseWeekDate(r[iWeek]),
      facility:       (r[iFacility] || '').trim(),
      // Section 1 — Therapy Delivery
      therapyGoalMet: r[iSec1] || '',
      therapyDriver:  r[iSec1No] || '',
      therapyNotes:   r[iSec1b] || '',
      // Section 2 — Orders/Careplans/Documentation
      orders:         [r[iSec2a], r[iSec2b], r[iSec2c], r[iSec2d]].filter(Boolean),
      missingLabor:   r[iMissing] || '',
      // Section 3 — Compliance & Risk
      compliance:     r[iSec3a] || '',
      complianceNotes:r[iSec3b] || '',
      complianceRisk: r[iSec3c] || '',
      // Section 4 — Staffing
      staffingCoverage: r[iSec4] || '',
      weekendCoverage:  r[iWeekend] || '',
      // Section 5 — Time & Operational Load
      timeLoad:       r[iSec5] || '',
      // Pulse Check
      pulse:          r[iPulse1] || r[iPulse2] || '',
      // Quantitative
      teamProd:       r[iProd],
      cpm:            r[iCPM],
      eligible:       r[iEligible],
      caseload:       r[iCaseload],
      ltPickups:      r[iLT],
      mode:           r[iMode],
      travelers:      r[iTravelers] || '',
      staffing:       r[iStaffing] || '',
    }));

    const latestByFacility = {};
    parsed.forEach(r => {
      const w = parseInt(r.week) || 0;
      if (!latestByFacility[r.facility] || w > parseInt(latestByFacility[r.facility].week)) {
        latestByFacility[r.facility] = r;
      }
    });

    const latest = Object.values(latestByFacility);
    setCheckInData(latest);
    setCheckInWeek(latest[0]?.weekDisplay || '');
    setCheckInSummaries({});
  };

  // ── Generate AI Summaries for Check-Ins
  const generateCheckInSummaries = async () => {
    if (!checkInData.length) return;
    setSummaryLoading(true);
    const summaries = {};

    // Process in batches of 6
    const batches = [];
    for (let i = 0; i < checkInData.length; i += 6) batches.push(checkInData.slice(i, i + 6));

    for (const batch of batches) {
      try {
        const prompt = `You are reviewing DOR weekly check-ins. For each building write a 1-2 sentence plain English summary of the most important issue or status. Flag anything needing attention.\n\n${batch.map(r => `${r.facility} (${r.dorName}):\n- Therapy goals met: ${r.therapyGoalMet||'N/A'}${r.therapyDriver?' — '+r.therapyDriver:''}\n- Missing labor: ${r.missingLabor||'None'}\n- Compliance: ${r.compliance||'N/A'} ${r.complianceNotes||''}\n- Staffing: ${r.staffingCoverage||'N/A'} | Weekend: ${r.weekendCoverage||'N/A'}\n- Travelers: ${r.travelers||'None'}\n- Open positions: ${r.staffing||'None'}\n- DOR pulse: ${r.pulse||'None'}`).join('\n\n')}\n\nRespond ONLY valid JSON no markdown: {"Facility Name": "summary"}`;

        const res = await fetch('/api/briefing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
        });
        const data = await res.json();
        const text = data.content?.find(b => b.type === 'text')?.text || '{}';
        const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
        Object.assign(summaries, parsed);
      } catch(e) { console.error('Summary error', e); }
    }

    setCheckInSummaries(summaries);
    setSummaryLoading(false);
  };

  // ── Executive PDF
  const generateExecPDF = () => {
    try {
      const doc   = new jsPDF({ orientation: 'landscape' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      // Title page
      doc.setFillColor(15,23,42); doc.rect(0,0,pageW,pageH,'F');
      doc.setTextColor(255,255,255); doc.setFontSize(28); doc.setFont('helvetica','bold');
      doc.text('Executive Summary', pageW/2, 60, { align:'center' });
      doc.setFontSize(14); doc.setFont('helvetica','normal'); doc.setTextColor(148,163,184);
      doc.text(EXEC_MONTHS[0].label.replace(' MTD','')+' - '+EXEC_MONTHS[EXEC_MONTHS.length-1].label.replace(' MTD','')+' 2026', pageW/2, 75, { align:'center' });
      doc.text(`Data through ${throughDate} - ${allFacilities.length} Facilities - 2 Regions`, pageW/2, 88, { align:'center' });

      // Company summary page
      doc.addPage();
      doc.setFillColor(15,23,42); doc.rect(0,0,pageW,pageH,'F');
      doc.setTextColor(255,255,255); doc.setFontSize(16); doc.setFont('helvetica','bold');
      doc.text('Company Overview - 3 Month Comparison', 14, 20);
      doc.setFontSize(9); doc.setTextColor(148,163,184);
      doc.text('Performance Goals:  Productivity >= 84% (incl. DOR)  |  CPM < $1.45 (incl. DOR)  |  Med B >= 50% on caseload  |  Mode of Treatment >= 4% group/concurrent', 14, 26);
      doc.setTextColor(255,255,255);
      doc.autoTable({
        startY: 33,
        head: [['Month','Avg Productivity','Avg CPM','Med B Revenue','At Prod Goal','At CPM Goal']],
        body: EXEC_MONTHS.map(m => {
          const t = getMonthTotals(m.start, m.end);
          return t ? [m.label, t.avgProd+'%', '$'+t.avgCPM, '$'+(t.totalRev/1000).toFixed(0)+'k', t.atGoalProd+'/'+t.n, t.atGoalCPM+'/'+t.n] : [m.label,'—','—','—','—','—'];
        }),
        theme: 'grid',
        headStyles: { fillColor:[6,182,212], textColor:[255,255,255], fontStyle:'bold' },
        bodyStyles: { fillColor:[30,41,59], textColor:[255,255,255] },
        alternateRowStyles: { fillColor:[51,65,85] },
        styles: { fontSize: 11 },
      });

      // Scorecard page
      doc.addPage();
      doc.setFillColor(15,23,42); doc.rect(0,0,pageW,pageH,'F');
      doc.setTextColor(255,255,255); doc.setFontSize(16); doc.setFont('helvetica','bold');
      doc.text('Building Scorecard - Productivity, CPM, Mode, Med B Revenue', 14, 20);
      doc.autoTable({
        startY: 30,
        head: [['Facility','Rgn',...EXEC_MONTHS.flatMap(m=>[m.label.replace(' MTD','')+' Prod',m.label.replace(' MTD','')+' CPM',m.label.replace(' MTD','')+' Mode',m.label.replace(' MTD','')+' Rev'])]],
        body: allFacilities.map(fac => {
          const region = allWeeklyData.find(d => d.facility === fac)?.region || '';
          const row = [shortName(fac), region === 'Golden Coast' ? 'GC' : 'OL'];
          EXEC_MONTHS.forEach(m => {
            const rec = getMonthFinal(fac, m.start, m.end);
            if (!rec) { row.push('—','—','—','—'); return; }
            row.push(
              mtd(rec,'productivityMTD','productivity').toFixed(1)+'%',
              '$'+Math.trunc(mtd(rec,'cpmMTD','cpm')*100)/100,
              mtd(rec,'modeOfTreatmentMTD','modeOfTreatment').toFixed(1)+'%',
              '$'+(mtd(rec,'medicareMPPRRevenueMTD','medicareMPPRRevenue')/1000).toFixed(1)+'k',
            );
          });
          return row;
        }),
        theme: 'grid',
        headStyles: { fillColor:[6,182,212], textColor:[255,255,255], fontStyle:'bold', fontSize:7 },
        bodyStyles: { fillColor:[30,41,59], textColor:[255,255,255], fontSize:7 },
        alternateRowStyles: { fillColor:[51,65,85] },
        styles: { cellPadding: 2 },
        didParseCell: data => {
          if (data.section !== 'body' || data.column.index < 2) return;
          const val = data.cell.raw;
          if (!val || val === '—') return;
          const col = (data.column.index - 2) % 4;
          const num = parseFloat(val.replace('$',''));
          if (col === 0) data.cell.styles.textColor = num >= 84   ? [110,231,183] : [252,165,165];
          if (col === 1) data.cell.styles.textColor = num <= 1.45 ? [110,231,183] : [252,165,165];
          if (col === 2) data.cell.styles.textColor = num >= 4    ? [110,231,183] : [252,165,165];
        },
      });

      // Spotlight page
      const struggling = allFacilities.filter(fac => {
        if (['Camino Ridge Post Acute','Pac Coast PA','Golden Harbor HC'].includes(fac)) return false;
        const scores = EXEC_MONTHS.map(m => scoreRec(getMonthFinal(fac, m.start, m.end)));
        return scores.filter(s => s <= 1).length >= 2;
      });
      const improvedList = allFacilities.map(fac => {
        const jan = getMonthFinal(fac, EXEC_MONTHS[0].start, EXEC_MONTHS[0].end);
        const mar = getMonthFinal(fac, EXEC_MONTHS[2].start, EXEC_MONTHS[2].end);
        if (!jan || !mar) return null;
        return { fac, scoreDiff: scoreRec(mar)-scoreRec(jan), prodDiff: mtd(mar,'productivityMTD','productivity')-mtd(jan,'productivityMTD','productivity'), js: scoreRec(jan), ms: scoreRec(mar) };
      }).filter(Boolean).sort((a,b) => b.scoreDiff !== a.scoreDiff ? b.scoreDiff-a.scoreDiff : b.prodDiff-a.prodDiff).slice(0,5);

      doc.addPage();
      doc.setFillColor(15,23,42); doc.rect(0,0,pageW,pageH,'F');
      doc.setTextColor(255,255,255); doc.setFontSize(16); doc.setFont('helvetica','bold');
      doc.text('Spotlight', 14, 20);
      doc.setFontSize(12); doc.setTextColor(110,231,183);
      doc.text('Most Improved ('+EXEC_MONTHS[0].label.replace(' MTD','')+' to '+EXEC_MONTHS[EXEC_MONTHS.length-1].label.replace(' MTD','')+', composite goals)', 14, 35);
      doc.autoTable({
        startY: 40,
        head: [['Facility',EXEC_MONTHS[0].label.replace(' MTD','')+' Goals',EXEC_MONTHS[EXEC_MONTHS.length-1].label.replace(' MTD','')+' Goals','Prod Change']],
        body: improvedList.map(r => [shortName(r.fac), r.js+'/4', r.ms+'/4', (r.prodDiff>0?'+':'')+r.prodDiff.toFixed(1)+'pp']),
        theme: 'grid',
        headStyles: { fillColor:[16,185,129], textColor:[255,255,255], fontStyle:'bold' },
        bodyStyles: { fillColor:[30,41,59], textColor:[255,255,255] },
        alternateRowStyles: { fillColor:[51,65,85] },
        styles: { fontSize: 10 },
      });
      const afterImproved = doc.lastAutoTable.finalY + 15;
      doc.setFontSize(12); doc.setTextColor(252,165,165);
      doc.text('Needs Attention (failing 3+ goals, 2+ months)', 14, afterImproved);
      doc.autoTable({
        startY: afterImproved + 5,
        head: [['Facility','Region',...EXEC_MONTHS.map(m=>m.label.replace(' MTD','')+' Score')]],
        body: struggling.map(fac => {
          const region = allWeeklyData.find(d => d.facility === fac)?.region || '';
          const scores = EXEC_MONTHS.map(m => scoreRec(getMonthFinal(fac, m.start, m.end), fac)+'/4');
          return [shortName(fac), region === 'Golden Coast' ? 'GC' : 'OL', ...scores];
        }),
        theme: 'grid',
        headStyles: { fillColor:[220,38,38], textColor:[255,255,255], fontStyle:'bold' },
        bodyStyles: { fillColor:[30,41,59], textColor:[255,255,255] },
        alternateRowStyles: { fillColor:[51,65,85] },
        styles: { fontSize: 10 },
      });
      doc.save('Executive_Summary_'+throughDate+'.pdf');
    } catch(e) { console.error(e); alert('PDF generation failed: '+e.message); }
  };

  // ── Leadership Digest PDF — single page, both regions, 4 goal metrics ────────
  const downloadLeadershipDigest = () => {
    const DIGEST_MONTHS = [
      { label: 'Jan',     start: '2026-01-01', end: '2026-01-31', isMTD: false },
      { label: 'Feb',     start: '2026-02-01', end: '2026-02-28', isMTD: false },
      { label: 'Mar',     start: '2026-03-01', end: '2026-03-31', isMTD: false },
      { label: 'April',   start: '2026-04-01', end: '2026-04-30', isMTD: false },
      { label: 'May',     start: '2026-05-01', end: '2026-05-31', isMTD: false },
      { label: 'Jun MTD', start: '2026-06-01', end: '2026-06-30', isMTD: true  },
    ];
    const getFacData = (fac, dm) => {
      const rec = getMonthFinal(fac, dm.start, dm.end);
      if (!rec) return null;
      const p    = mtd(rec,'productivityMTD','productivity');
      const c    = mtd(rec,'cpmMTD','cpm');
      const mo   = mtd(rec,'modeOfTreatmentMTD','modeOfTreatment');
      const cas  = rec.medBCaseload||0; const elig = rec.medBEligible||0;
      const medB = elig>0 ? Math.round((cas/elig)*100) : 0;
      return { p, c, mo, medB };
    };
    const C = {
      navy:[11,17,32], navyMid:[17,27,50], slate:[28,38,60], slate2:[38,52,78], slate3:[52,68,98],
      cyan:[6,182,212], teal:[13,148,136], white:[255,255,255], offWhite:[220,230,245],
      muted:[110,128,160], green:[52,211,153], red:[248,113,113],
      mb:[[22,32,58],[18,38,55],[22,32,58],[18,38,55],[12,60,80],[10,72,90]],
    };
    try {
      const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'letter' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFillColor(...C.navy); doc.rect(0,0,pageW,pageH,'F');
      doc.setFillColor(...C.teal); doc.rect(0,0,pageW,2,'F');
      doc.setFillColor(...C.navyMid); doc.rect(0,2,pageW,16,'F');
      doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.setTextColor(...C.cyan);
      doc.text('THERASCOPE',10,13);
      doc.setTextColor(...C.offWhite); doc.setFontSize(10);
      doc.text('Leadership Digest  |  All Buildings  |  Q1 · April · May · June MTD 2026',50,13);
      doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(...C.muted);
      doc.text(`Generated ${latestDateStr}`,pageW-10,13,{align:'right'});
      doc.setFillColor(...C.cyan); doc.rect(0,18,pageW,0.4,'F');
      doc.setFontSize(6.5); doc.setTextColor(...C.muted);
      doc.text('Goals:  Productivity >=84%   CPM <=$1.45   G/C Mode >4%   Med B >=50% on caseload     * = modified threshold',10,24);

      const buildTable = (region) => {
        const facList = allFacilities.filter(f=>allWeeklyData.find(d=>d.facility===f)?.region===region).sort();
        const COL_W = 9.5; const FAC_W = 31;
        const head = [
          [
            {content:region,rowSpan:2,styles:{valign:'middle',halign:'left',fillColor:C.slate,textColor:C.cyan,fontStyle:'bold',fontSize:8}},
            ...DIGEST_MONTHS.map((dm,mi)=>({
              content:dm.label,colSpan:4,
              styles:{halign:'center',fontStyle:'bold',fontSize:7.5,fillColor:C.mb[mi],textColor:dm.isMTD?C.cyan:C.offWhite}
            }))
          ],
          [...DIGEST_MONTHS.map((_,mi)=>
            ['PROD','CPM','MODE','MED B'].map(l=>({
              content:l,styles:{halign:'center',fontSize:5.5,fillColor:C.mb[mi].map(v=>Math.min(255,v+10)),textColor:C.muted}
            }))
          ).flat()],
        ];
        const body = facList.map(fac => {
          const isM = !!BUILDING_GOALS[fac];
          const row = [(isM?'* ':'')+fac.replace(' Post Acute','').replace(' Healthcare Center','')];
          DIGEST_MONTHS.forEach(dm => {
            const d = getFacData(fac,dm);
            row.push(d?d.p.toFixed(1):'---');
            row.push(d?(Math.trunc(d.c*100)/100).toFixed(2):'---');
            row.push(d?d.mo.toFixed(1):'---');
            row.push(d?String(d.medB):'---');
          });
          return row;
        });
        return {
          head, body, theme:'plain',
          headStyles:        {fillColor:C.slate,textColor:C.offWhite,fontStyle:'bold',fontSize:6.5,cellPadding:1.5},
          bodyStyles:        {fillColor:C.slate,textColor:C.offWhite,fontSize:6.5,cellPadding:1.5},
          alternateRowStyles:{fillColor:C.slate2},
          columnStyles:{
            0:{cellWidth:FAC_W,fontStyle:'bold',textColor:C.white},
            ...Object.fromEntries(DIGEST_MONTHS.flatMap((_,mi)=>[
              [1+mi*4,{cellWidth:COL_W,halign:'center'}],
              [2+mi*4,{cellWidth:COL_W,halign:'center'}],
              [3+mi*4,{cellWidth:COL_W,halign:'center'}],
              [4+mi*4,{cellWidth:COL_W,halign:'center'}],
            ])),
          },
          didParseCell: data => {
            if (data.column.index>0) {
              const mi=Math.floor((data.column.index-1)/4);
              const adj=data.section==='body'&&data.row.index%2!==0?8:0;
              if (mi>=0&&mi<5) data.cell.styles.fillColor=C.mb[mi].map(v=>Math.min(255,v+adj));
            }
            if (data.section!=='body') return;
            const fac=facList[data.row.index]; if (!fac) return;
            const goals=getGoals(fac);
            const col=data.column.index; if (col===0) return;
            const mi=Math.floor((col-1)/4), type=(col-1)%4;
            const d=getFacData(fac,DIGEST_MONTHS[mi]);
            if (!d||data.cell.raw==='---'){data.cell.styles.textColor=C.muted;return;}
            const pass=[
              d.p>=goals.productivity,
              (Math.trunc(d.c*100)/100)<=goals.cpm,
              parseFloat(d.mo.toFixed(1))>=goals.mode,
              d.medB>=goals.medB
            ][type];
            data.cell.styles.textColor=pass?C.green:C.red;
            data.cell.styles.fontStyle='bold';
          },
          tableLineColor:C.slate3, tableLineWidth:0.15,
          margin:{left:10,right:10},
        };
      };

      doc.autoTable({...buildTable('Golden Coast'),startY:27});
      doc.autoTable({...buildTable('Overland'),startY:doc.lastAutoTable.finalY+5});

      doc.setFillColor(...C.teal); doc.rect(0,pageH-10,pageW,10,'F');
      const mayMet = allFacilities.filter(f=>{
        const rec=getMonthFinal(f,DIGEST_MONTHS[4].start,DIGEST_MONTHS[4].end);
        return rec&&scoreRec(rec,f)===4;
      }).length;
      doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor(...C.navy);
      doc.text(`June MTD: ${mayMet} / ${allFacilities.length} buildings meeting all 4 goals`,10,pageH-3.5);
      doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...C.navyMid);
      doc.text('therascope-insights.vercel.app',pageW-10,pageH-3.5,{align:'right'});
      doc.save(`Therascope_Leadership_Digest_${latestDateStr}.pdf`);
    } catch(e){console.error(e);alert('PDF generation failed: '+e.message);}
  };

  // ─── RESOURCES-ONLY VIEW ─────────────────────────────────────────────────────
  if (resourcesAccess && showHEP) return <HEPGenerator onClose={() => setShowHEP(false)} />;
  if (resourcesAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="fixed inset-0 opacity-20 pointer-events-none">
          <div className="absolute inset-0" style={{ backgroundImage:'radial-gradient(circle at 2px 2px, rgba(100,200,255,0.3) 1px, transparent 0)', backgroundSize:'40px 40px' }}></div>
        </div>
        <header className="relative bg-white/10 backdrop-blur-xl border-b border-white/20 sticky top-0 z-50 shadow-2xl">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-cyan-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg">
                <Zap className="w-5 h-5 text-white" strokeWidth={2.5}/>
              </div>
              <div>
                <span className="text-xl font-black bg-gradient-to-r from-cyan-300 to-teal-300 bg-clip-text text-transparent">TheraScope</span>
                <span className="text-slate-500 text-xs ml-2">DOR Playbook & Resources</span>
              </div>
            </div>
            <button onClick={() => setResourcesAccess(false)}
              className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">
              <ArrowLeft className="w-4 h-4"/> Exit
            </button>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-10">
          <div className="mb-8">
            <h1 className="text-3xl font-black text-white mb-2">DOR Playbook & Tools</h1>
            <p className="text-slate-400">Clinical guides, protocols, orientation materials, reference forms, and therapy tools.</p>
          </div>
          {/* Tools section */}
          <div className="mb-8">
            <h2 className="text-lg font-black text-cyan-300 uppercase tracking-wider mb-4">Tools</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div onClick={() => setShowHEP(true)}
                className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-teal-400/40 transition-all cursor-pointer group">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-teal-500/20 to-cyan-500/20 group-hover:from-teal-500/40 group-hover:to-cyan-500/40 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 transition-all">
                    <span className="text-teal-400 text-lg">🏃</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-bold text-sm group-hover:text-teal-300 transition-colors">HEP Generator</div>
                    <div className="text-slate-500 text-xs mt-1 leading-relaxed">Build and print a custom Home Exercise Program — PT, OT, and ST exercises with illustrations</div>
                    <div className="mt-2 inline-flex items-center gap-1 text-teal-400 text-xs font-bold">Open Generator →</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {githubResources.length > 0 ? githubResources.map(category => (
            <div key={category.id} className="mb-8">
              <h2 className="text-lg font-black text-cyan-300 uppercase tracking-wider mb-4">{category.name}</h2>
              {category.description && <p className="text-slate-500 text-sm mb-4">{category.description}</p>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(category.files||[]).map((file,fi) => {
                  const fileUrl = file.url || `/resources/${category.id}/${file.filename}`;
                  return (
                    <div key={fi} className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-cyan-400/30 transition-all">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-cyan-500/20 to-teal-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                          <FileText className="w-4 h-4 text-cyan-400"/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-bold text-sm">{file.title || file.name}</div>
                          {file.description && <div className="text-slate-500 text-xs mt-1 leading-relaxed">{file.description}</div>}
                          <div className="flex gap-2 mt-3">
                            <a href={fileUrl} target="_blank" rel="noopener noreferrer"
                              className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/30 rounded-lg text-xs font-bold transition-all flex items-center gap-1">
                              <ExternalLink className="w-3 h-3"/> View
                            </a>
                            <a href={fileUrl} download
                              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg text-xs font-bold transition-all flex items-center gap-1">
                              <Download className="w-3 h-3"/> Download
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )) : (
            <div className="text-center text-slate-500 py-20">Resources loading... make sure resources-config.json is deployed.</div>
          )}
        </main>
      </div>
    );
  }

  // ─── LOGIN SCREEN ────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="fixed inset-0 opacity-20 pointer-events-none">
          <div className="absolute inset-0" style={{ backgroundImage:'radial-gradient(circle at 2px 2px, rgba(100,200,255,0.3) 1px, transparent 0)', backgroundSize:'40px 40px' }}></div>
        </div>
        <div className="relative max-w-md w-full">
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl">
            <div className="flex flex-col items-center mb-8">
              <div className="relative mb-4">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-400 to-teal-500 rounded-2xl blur-lg opacity-75 animate-pulse"></div>
                <div className="relative w-16 h-16 bg-gradient-to-br from-cyan-400 via-teal-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-2xl">
                  <Zap className="w-10 h-10 text-white" strokeWidth={2.5} />
                </div>
              </div>
              <h1 className="text-3xl font-black bg-gradient-to-r from-cyan-300 via-teal-300 to-emerald-300 bg-clip-text text-transparent">TheraScope</h1>
              <p className="text-slate-400 text-sm mt-2">Secure Access Portal</p>
            </div>

            {!loginType ? (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-white text-center mb-6">Select Access Type</h2>
                <button onClick={() => setLoginType('admin')} className="w-full p-6 bg-gradient-to-r from-cyan-500/20 to-teal-500/20 hover:from-cyan-500/30 hover:to-teal-500/30 border border-cyan-500/30 hover:border-cyan-500/50 rounded-2xl transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-xl flex items-center justify-center">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left">
                      <div className="text-white font-bold">Admin</div>
                      <div className="text-slate-400 text-sm">Full access to all facilities</div>
                    </div>
                  </div>
                </button>
                <button onClick={() => setLoginType('dor')} className="w-full p-6 bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 border border-purple-500/30 hover:border-purple-500/50 rounded-2xl transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left">
                      <div className="text-white font-bold">Director of Rehab (DOR)</div>
                      <div className="text-slate-400 text-sm">Access your facility data</div>
                    </div>
                  </div>
                </button>
                <button onClick={() => setLoginType('resources')} className="w-full p-6 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border border-emerald-500/30 hover:border-emerald-500/50 rounded-2xl transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left">
                      <div className="text-white font-bold">DOR Playbook & Resources</div>
                      <div className="text-slate-400 text-sm">Clinical guides, protocols, forms</div>
                    </div>
                  </div>
                </button>
              </div>
            ) : loginType === 'resources' ? (
              <div className="space-y-4">
                <button type="button" onClick={() => { setLoginType(null); setResourcesPin(''); }}
                  className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-2">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <h2 className="text-xl font-bold text-white">DOR Playbook & Resources</h2>
                <p className="text-slate-400 text-sm">Enter the access code to continue.</p>
                <input type="password" value={resourcesPin} onChange={e => setResourcesPin(e.target.value)}
                  placeholder="Enter access code" autoComplete="current-password"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400/50" />
                <button onClick={() => {
                  if (resourcesPin === RESOURCES_PIN) { setResourcesAccess(true); setLoginType(null); setResourcesPin(''); }
                  else { alert('Incorrect access code'); setResourcesPin(''); }
                }} className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all shadow-lg">
                  Access Resources
                </button>
              </div>
            ) : (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <button type="button" onClick={() => { setLoginType(null); setPasswordAttempt(''); setSelectedFacilityForLogin(''); }}
                  className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-2">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <h2 className="text-xl font-bold text-white">{loginType === 'admin' ? 'Admin Access' : 'DOR Access'}</h2>
                {loginType === 'dor' && (
                  <select value={selectedFacilityForLogin} onChange={e => setSelectedFacilityForLogin(e.target.value)}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400/50">
                    <option value="" className="bg-slate-800">Select your facility...</option>
                    {allFacilities.map(f => <option key={f} value={f} className="bg-slate-800">{f}</option>)}
                  </select>
                )}
                <input type="password" value={passwordAttempt} onChange={e => setPasswordAttempt(e.target.value)}
                  placeholder="Enter password" autoComplete="current-password"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/50" />
                <button type="submit" className="w-full py-3 bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-bold rounded-xl hover:from-cyan-600 hover:to-teal-600 transition-all shadow-lg">
                  Sign In
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── MAIN SHELL ──────────────────────────────────────────────────────────────
  const NAV_TABS = [
    ...(!isRestrictedView ? [{ id:'overview',   label:'Overview',        icon: Activity  }] : []),
    ...(!isRestrictedView ? [{ id:'exec',        label:'Executive',       icon: Star      }] : []),
    ...(!isRestrictedView ? [{ id:'checkins',    label:'Check-Ins',       icon: CheckCircle}] : []),
    {                        id:'facilities',    label: isRestrictedView ? 'My Facility' : 'All Facilities', icon: Building2 },
    ...(isRestrictedView  ? [{ id:'compliance', label:'Compliance',       icon: CheckCircle }] : []),
    ...(isRestrictedView  ? [{ id:'resources',  label:'Resources',        icon: FileText  }] : []),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="fixed inset-0 opacity-20 pointer-events-none">
        <div className="absolute inset-0" style={{ backgroundImage:'radial-gradient(circle at 2px 2px, rgba(100,200,255,0.3) 1px, transparent 0)', backgroundSize:'40px 40px' }}></div>
      </div>

      {/* HEADER */}
      <header className="relative bg-white/10 backdrop-blur-xl border-b border-white/20 sticky top-0 z-50 shadow-2xl">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-400 to-teal-500 rounded-xl blur opacity-60"></div>
                <div className="relative w-10 h-10 bg-gradient-to-br from-cyan-400 via-teal-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-xl">
                  <Zap className="w-6 h-6 text-white" strokeWidth={2.5} />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-black bg-gradient-to-r from-cyan-300 via-teal-300 to-emerald-300 bg-clip-text text-transparent">TheraScope</h1>
                <p className="text-slate-400 text-xs">Visibility · Control · Intelligence</p>
              </div>
            </div>
            <div className="flex gap-3 items-center">
              {!isRestrictedView && (
                <>
                  {showDigestModal && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                      <div className="bg-slate-900 border border-white/20 rounded-2xl shadow-2xl w-full max-w-sm p-6">
                        <h3 className="text-lg font-black text-white mb-1">Send Weekly Digest</h3>
                        <p className="text-slate-400 text-sm mb-5">Send this week's metrics and alerts to all DORs.</p>
                        <div className="space-y-3">
                          <button onClick={() => { sendWeeklyDigest(); setShowDigestModal(false); }}
                            className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-xl font-semibold text-sm transition-all">
                            Send to All DORs
                          </button>
                          <p className="text-xs text-slate-500 text-center">Only sends to buildings with emails configured</p>
                        </div>
                        <button onClick={() => setShowDigestModal(false)} className="mt-4 w-full text-slate-500 hover:text-white text-sm transition-all">Cancel</button>
                      </div>
                    </div>
                  )}
                  <button onClick={() => setShowDigestModal(true)} disabled={digestSending}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 text-white rounded-xl transition-all shadow-lg font-semibold text-sm flex items-center gap-2">
                    {digestSending
                      ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Sending...</>
                      : <><Zap className="w-3.5 h-3.5"/>Send Weekly Digest</>}
                  </button>
                  {digestResult && (
                    <div className="text-xs text-slate-400">
                      {digestResult.sent.length > 0 && <span className="text-emerald-400 font-bold">{digestResult.sent.length} sent</span>}
                      {digestResult.skipped.length > 0 && <span className="text-slate-500 ml-2">{digestResult.skipped.length} skipped</span>}
                      {digestResult.failed.length > 0 && <span className="text-rose-400 ml-2 font-bold">{digestResult.failed.length} failed</span>}
                    </div>
                  )}
                </>
              )}
              {isRestrictedView && (
                <a href={WEEKLY_REPORT_LINK} target="_blank" rel="noopener noreferrer"
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-xl hover:from-cyan-600 hover:to-teal-600 transition-all shadow-lg font-semibold text-sm flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" /> Submit Weekly Report
                </a>
              )}
              <button onClick={() => { setIsAuthenticated(false); setLoginType(null); setSelectedFacilityForLogin(''); setActiveView('overview'); }}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all text-sm font-medium border border-white/20">
                Sign Out
              </button>
            </div>
          </div>
          {isRestrictedView && myFacilityData && (
            <div className="mt-1 text-sm text-slate-400">
              Logged in as: <span className="text-cyan-300 font-bold">{restrictedFacility}</span>
              <span className="ml-2 text-slate-500">· Data through {throughDate}</span>
            </div>
          )}
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div className="relative max-w-7xl mx-auto px-6 pt-6">

        {/* NAV TABS */}
        <div className="flex gap-2 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-2 mb-6 overflow-x-auto">
          {NAV_TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveView(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${activeView === tab.id ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}>
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* WEEK / REGION SELECTOR — admin overview & facilities only */}
        {!isRestrictedView && (activeView === 'overview' || activeView === 'facilities') && (
          <div className="flex gap-3 items-center mb-6 flex-wrap">
            <select value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white text-sm focus:outline-none">
              {availableWeeks.map(w => <option key={w} value={w} className="bg-slate-800">{w === 'latest' ? 'Latest Week' : `Week ${w}`}</option>)}
            </select>
            <select value={selectedRegion} onChange={e => setSelectedRegion(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white text-sm focus:outline-none">
              <option value="all" className="bg-slate-800">All Regions</option>
              <option value="Golden Coast" className="bg-slate-800">Golden Coast</option>
              <option value="Overland" className="bg-slate-800">Overland</option>
            </select>
          </div>
        )}

        {/* ══ OVERVIEW TAB ══════════════════════════════════════════════════ */}
        {activeView === 'overview' && (
          <div className="space-y-8 pb-12">

            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label:'Total Facilities',  value: viewableData.length,         icon: Building2, grad:'from-cyan-500 to-teal-500',     sub:`${viewableData.length} active` },
                { label:'Avg Productivity',  value: viewableData.length ? Math.round(viewableData.reduce((s,f)=>s+mtd(f,'productivityMTD','productivity'),0)/viewableData.length)+'%' : '—', icon: TrendingUp, grad:'from-emerald-500 to-green-500', sub:'MTD avg' },
                { label:'Avg CPM',           value: viewableData.length ? '$'+(viewableData.reduce((s,f)=>s+mtd(f,'cpmMTD','cpm'),0)/viewableData.length).toFixed(2) : '—', icon: PieChart, grad:'from-orange-500 to-amber-500', sub:'Goal < $1.45' },
                { label:'Med B Units MTD',   value: viewableData.reduce((s,f)=>s+(f.medBUnitsMTD||f.medBUnitsThisWeek||0),0).toLocaleString(), icon: BarChart3, grad:'from-purple-500 to-pink-500', sub:'Month to date' },
              ].map((m,i) => (
                <div key={i} className="bg-white/5 backdrop-blur-xl rounded-2xl p-5 border border-white/10 shadow-xl">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-9 h-9 bg-gradient-to-br ${m.grad} rounded-xl flex items-center justify-center shadow-lg`}>
                      <m.icon className="w-5 h-5 text-white" strokeWidth={2.5} />
                    </div>
                    <span className="text-xs text-slate-500">{m.sub}</span>
                  </div>
                  <div className="text-2xl font-black text-white mb-1">{m.value}</div>
                  <div className="text-xs text-slate-400 font-bold uppercase tracking-wide">{m.label}</div>
                </div>
              ))}
            </div>

            {/* Region cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[{ region:'Golden Coast', data:goldenCoastData, color:'amber' }, { region:'Overland', data:overlandData, color:'blue' }].map(({ region, data, color }) => (
                <div key={region} onClick={() => { setSelectedRegion(region); setActiveView('facilities'); }}
                  className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-xl cursor-pointer hover:bg-white/10 hover:border-white/20 transition-all duration-300">
                  <div className="flex items-center gap-3 mb-4">
                    <MapPin className={`w-5 h-5 text-${color}-400`} strokeWidth={2.5} />
                    <div>
                      <h3 className="text-lg font-black text-white">{region}</h3>
                      <p className="text-slate-400 text-xs">{data.length} facilities — click to filter</p>
                    </div>
                  </div>
                  {data.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {[
                        { label:'Avg Productivity', val: (data.reduce((s,f)=>s+mtd(f,'productivityMTD','productivity'),0)/data.length).toFixed(1)+'%', color: prodColor(data.reduce((s,f)=>s+mtd(f,'productivityMTD','productivity'),0)/data.length) },
                        { label:'Avg CPM',           val: '$'+(data.reduce((s,f)=>s+mtd(f,'cpmMTD','cpm'),0)/data.length).toFixed(2), color: cpmColor(data.reduce((s,f)=>s+mtd(f,'cpmMTD','cpm'),0)/data.length) },
                        { label:'Med B Units MTD',   val: data.reduce((s,f)=>s+(f.medBUnitsMTD||f.medBUnitsThisWeek||0),0).toLocaleString(), color:'text-white' },
                        { label:'At Prod Goal',      val: data.filter(f=>mtd(f,'productivityMTD','productivity')>=getGoals(f.facility).productivity).length+'/'+data.length, color:'text-slate-300' },
                      ].map((m,i) => (
                        <div key={i}>
                          <div className="text-slate-400 text-xs mb-1">{m.label}</div>
                          <div className={`font-black text-lg ${m.color}`}>{m.val}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Off-Track This Week */}
            {(() => {
              const offProd = currentWeekData.filter(f => mtd(f,'productivityMTD','productivity') < getGoals(f.facility).productivity);
              const offCPM  = currentWeekData.filter(f => mtd(f,'cpmMTD','cpm') > getGoals(f.facility).cpm);
              const offMode = currentWeekData.filter(f => mtd(f,'modeOfTreatmentMTD','modeOfTreatment') < getGoals(f.facility).mode);
              const offMedB = currentWeekData.filter(f => f.medBEligible > 0 && (f.medBCaseload/f.medBEligible) < getGoals(f.facility).medB/100);
              if (!offProd.length && !offCPM.length && !offMode.length && !offMedB.length) return (
                <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-2xl p-5 flex items-center gap-3">
                  <span className="text-2xl">🏆</span>
                  <div>
                    <h3 className="text-base font-black text-emerald-300">All Buildings On Track</h3>
                    <p className="text-slate-400 text-sm">Every facility meeting all 4 goals.</p>
                  </div>
                </div>
              );
              return (
                <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl overflow-hidden">
                  <div className="p-5 border-b border-white/10 bg-gradient-to-r from-rose-900/30 to-orange-900/30 flex items-center gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div>
                      <h3 className="text-lg font-black text-white">Off-Track This Week</h3>
                      <p className="text-slate-400 text-sm">Buildings missing MTD goals</p>
                    </div>
                  </div>
                  <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label:'Productivity < 84%', items:offProd, val: f => mtd(f,'productivityMTD','productivity').toFixed(1)+'%' },
                      { label:'CPM > $1.45',         items:offCPM,  val: f => '$'+Math.trunc(mtd(f,'cpmMTD','cpm')*100)/100 },
                      { label:'Mode of Tx < goal',   items:offMode, val: f => mtd(f,'modeOfTreatmentMTD','modeOfTreatment').toFixed(1)+'%' },
                      { label:'Med B < goal on CL',  items:offMedB, val: f => f.medBEligible>0 ? Math.round((f.medBCaseload/f.medBEligible)*100)+'%' : 'N/A' },
                    ].map((g,gi) => (
                      <div key={gi} className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{g.label}</div>
                        {g.items.length === 0
                          ? <div className="text-emerald-400 text-sm font-bold">✓ All clear</div>
                          : <div className="space-y-1.5">{g.items.map((f,i) => (
                              <div key={i} className="flex items-center justify-between">
                                <span className="text-white text-xs font-medium truncate pr-2">{shortName(f.facility)}</span>
                                <span className="text-rose-300 text-xs font-black flex-shrink-0">{g.val(f)}</span>
                              </div>
                            ))}</div>
                        }
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

          </div>
        )}

        {/* ══ EXECUTIVE TAB ═════════════════════════════════════════════════ */}
        {activeView === 'exec' && !isRestrictedView && (() => {
          const monthTotals = EXEC_MONTHS.map(m => ({ ...m, totals: getMonthTotals(m.start, m.end) }));
          const facilityRows = allFacilities.map(fac => ({
            facility: fac,
            region: allWeeklyData.find(d => d.facility === fac)?.region || '',
            months: EXEC_MONTHS.map(m => getMonthFinal(fac, m.start, m.end)),
          })).filter(r => r.months.some(Boolean))
            .sort((a,b) => a.region !== b.region ? (a.region==='Golden Coast'?-1:1) : a.facility.localeCompare(b.facility));

          const EXCLUDE_STRUGGLING = ['Camino Ridge Post Acute','Pac Coast PA','Golden Harbor HC'];
          const struggling = facilityRows.filter(r => !EXCLUDE_STRUGGLING.includes(r.facility) && r.months.filter(Boolean).map(rec=>scoreRec(rec,r.facility)).filter(s=>s<=1).length >= 2);
          const improved = facilityRows.map(r => {
            const jan=r.months[0], mar=r.months[2];
            if (!jan || !mar) return null;
            const scoreDiff = scoreRec(mar,r.facility)-scoreRec(jan,r.facility);
            const prodDiff  = mtd(mar,'productivityMTD','productivity')-mtd(jan,'productivityMTD','productivity');
            return { ...r, scoreDiff, prodDiff, janScore:scoreRec(jan,r.facility), marScore:scoreRec(mar,r.facility) };
          }).filter(Boolean).sort((a,b)=>b.scoreDiff!==a.scoreDiff?b.scoreDiff-a.scoreDiff:b.prodDiff-a.prodDiff).slice(0,3);

          return (
            <div className="space-y-8 pb-12">

              {/* ALOS Input Modal */}
              {showReportModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <div className="bg-slate-900 border border-white/20 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                    <div className="p-6 border-b border-white/10">
                      <h3 className="text-xl font-black text-white">Generate {reportRegion} Report</h3>
                      <p className="text-slate-400 text-sm mt-1">Enter Average Length of Stay values, then generate.</p>
                    </div>
                    <div className="p-6 space-y-4">
                      <div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Compliance Tracker (optional)</div>
                        <label className="flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-all">
                          <Upload className="w-4 h-4 text-slate-400" />
                          <span className="text-sm text-slate-300">{complianceData[reportRegion]?.length ? `✓ ${complianceData[reportRegion].length} buildings loaded` : 'Upload Rehab_Compliance_Tracker.xlsx'}</span>
                          <input type="file" accept=".xlsx" className="hidden" onChange={handleComplianceUpload} />
                        </label>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Average Length of Stay (days)</div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-white/10">
                                <th className="text-left py-2 px-3 text-slate-400 font-bold text-xs">Building</th>
                                {['Jan','Feb','Mar','Apr'].map(m => <th key={m} className="py-2 px-3 text-slate-400 font-bold text-xs text-center">{m}</th>)}
                              </tr>
                            </thead>
                            <tbody>
                              {allFacilities.filter(f => allWeeklyData.find(d=>d.facility===f)?.region===reportRegion).map(fac => (
                                <tr key={fac} className="border-b border-white/5">
                                  <td className="py-2 px-3 text-white text-xs font-medium">{fac}</td>
                                  {['jan','feb','mar','apr'].map(mo => (
                                    <td key={mo} className="py-1 px-2">
                                      <input type="number" step="0.1" placeholder="—"
                                        value={alosData[fac]?.[mo] || ''}
                                        onChange={e => setAlosData(prev => ({ ...prev, [fac]: { ...(prev[fac]||{}), [mo]: e.target.value }}))}
                                        className="w-16 bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-white text-xs text-center focus:outline-none focus:border-cyan-400" />
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                    <div className="p-6 border-t border-white/10 flex items-center justify-between gap-3">
                      <button onClick={() => generateNarratives(reportRegion)} disabled={narrativeLoading}
                        className="px-5 py-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white rounded-xl font-semibold text-sm flex items-center gap-2 transition-all border border-white/10">
                        {narrativeLoading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Generating AI narratives...</> : <><Zap className="w-4 h-4"/>{savedNarratives[reportRegion] ? 'Regenerate Narratives' : 'Generate AI Narratives'}</>}
                      </button>
                      <div className="flex items-center gap-3">
                        {savedNarratives[reportRegion] && <span className="text-emerald-400 text-sm font-semibold">✓ Narratives ready</span>}
                        <button onClick={() => setShowReportModal(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm font-semibold transition-all">Cancel</button>
                        <button onClick={generateRegionReport} disabled={reportGenerating}
                          className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-lg">
                          {reportGenerating ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Building PDF...</> : <><Download className="w-4 h-4"/>Generate PDF</>}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Header */}
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h2 className="text-3xl font-black text-white">Executive Summary</h2>
                    <p className="text-slate-400 mt-1">Q1 · May · June MTD 2026 · {facilityRows.length} Facilities · 2 Regions</p>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button onClick={downloadLeadershipDigest}
                      className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white rounded-xl transition-all shadow-lg font-semibold text-sm flex items-center gap-2">
                      <Download className="w-3.5 h-3.5"/>Leadership Digest
                    </button>
                    <div className="text-right text-xs">
                      <div className="text-slate-500 uppercase tracking-wider mb-1">Data through</div>
                      <div className="text-white font-bold">{throughDate}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Goals reference bar */}
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 px-6 py-4">
                <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Performance Goals</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { icon:'📈', label:'Productivity',      target:'≥ 84%',             detail:'All staff including DOR' },
                    { icon:'💰', label:'CPM',               target:'< $1.45',            detail:'Cost per minute, including DOR' },
                    { icon:'🏥', label:'Med B Eligibility', target:'≥ 50% on caseload', detail:'Of eligible patients' },
                    { icon:'👥', label:'Mode of Treatment', target:'≥ 4%',              detail:'Group / concurrent therapy' },
                  ].map((g,i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="text-lg">{g.icon}</span>
                      <div>
                        <div className="text-xs font-black text-white">{g.label}</div>
                        <div className="text-sm font-black text-cyan-300">{g.target}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{g.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Company Summary — Q1 trend card + April + May */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

                {/* Q1 Card — Jan / Feb / Mar trend */}
                {(() => {
                  const q1 = monthTotals.slice(0,3);
                  if (!q1.some(m => m.totals)) return null;
                  const rows = [
                    { label:'Avg Productivity', key:'avgProd',     fmt: v=>v+'%',                                    good: v=>parseFloat(v)>=84 },
                    { label:'Avg CPM',           key:'avgCPM',     fmt: v=>'$'+v,                                    good: v=>parseFloat(v)<=1.45 },
                    { label:'Med B Units',       key:'totalUnits', fmt: v=>v.toLocaleString(),                       good: null },
                    { label:'Med B Revenue',     key:'totalAllRev',fmt: v=>'$'+(v/1000).toFixed(0)+'k',             good: null },
                    { label:'At Prod Goal',      key:'atGoalProd', fmt: (v,t)=>v+' / '+t, good: (v,t)=>v>=t*0.7,   isGoal:true },
                    { label:'At CPM Goal',       key:'atGoalCPM',  fmt: (v,t)=>v+' / '+t, good: (v,t)=>v>=t*0.7,   isGoal:true },
                    { label:'At Mode Goal',      key:'atGoalMode', fmt: (v,t)=>v+' / '+t, good: (v,t)=>v>=t*0.7,   isGoal:true },
                    { label:'At Med B% Goal',    key:'atGoalMedB', fmt: (v,t)=>v+' / '+t, good: (v,t)=>v>=t*0.7,   isGoal:true },
                    { label:'All 4 Goals',       key:'atGoalAll',  fmt: (v,t)=>v+' / '+t, good: (v,t)=>v>=t*0.5,   isGoal:true },
                  ];
                  return (
                    <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-xl">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-2xl font-black text-white">Q1</h3>
                        <span className="text-xs text-slate-500 font-bold">Jan – Mar 2026</span>
                      </div>
                      {/* Sub-headers */}
                      <div className="grid grid-cols-4 gap-1 mb-2">
                        <div className="text-slate-500 text-xs"></div>
                        {q1.map(m => (
                          <div key={m.label} className="text-center text-xs font-black text-cyan-400 uppercase tracking-wider">{m.label}</div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        {rows.map((row,ri) => (
                          <div key={ri} className="grid grid-cols-4 gap-1 py-1.5 border-b border-white/5 last:border-0 items-center">
                            <span className="text-slate-400 text-xs">{row.label}</span>
                            {q1.map((m,mi) => {
                              if (!m.totals) return <span key={mi} className="text-center text-xs text-slate-600">—</span>;
                              const v = row.key === 'totalAllRev'
                                ? (m.totals.totalRev||0) + (m.totals.totalRespRev||0)
                                : m.totals[row.key];
                              const n = m.totals.n;
                              const isGood = row.good === null ? null : row.isGoal ? row.good(v,n) : row.good(v);
                              const display = row.isGoal ? row.fmt(v,n) : row.fmt(v);
                              return (
                                <span key={mi} className={`text-center text-xs font-black ${isGood===null?'text-white':isGood?'text-emerald-300':'text-rose-300'}`}>
                                  {display}
                                </span>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Q2 Card — Apr / May / Jun */}
                {(() => {
                  const q2 = monthTotals.slice(3);
                  if (!q2.some(m => m.totals)) return null;
                  const rows = [
                    { label:'Avg Productivity', key:'avgProd',      fmt: v=>v+'%',                                   good: v=>parseFloat(v)>=84 },
                    { label:'Avg CPM',           key:'avgCPM',      fmt: v=>'$'+v,                                   good: v=>parseFloat(v)<=1.45 },
                    { label:'Med B Units',       key:'totalUnits',  fmt: v=>v.toLocaleString(),                      good: null },
                    { label:'Med B Revenue',     key:'totalAllRev', fmt: v=>'$'+(v/1000).toFixed(0)+'k',            good: null },
                    { label:'At Prod Goal',      key:'atGoalProd',  fmt: (v,t)=>v+' / '+t, good:(v,t)=>v>=t*0.7,   isGoal:true },
                    { label:'At CPM Goal',       key:'atGoalCPM',   fmt: (v,t)=>v+' / '+t, good:(v,t)=>v>=t*0.7,   isGoal:true },
                    { label:'At Mode Goal',      key:'atGoalMode',  fmt: (v,t)=>v+' / '+t, good:(v,t)=>v>=t*0.7,   isGoal:true },
                    { label:'At Med B% Goal',    key:'atGoalMedB',  fmt: (v,t)=>v+' / '+t, good:(v,t)=>v>=t*0.7,   isGoal:true },
                    { label:'All 4 Goals',       key:'atGoalAll',   fmt: (v,t)=>v+' / '+t, good:(v,t)=>v>=t*0.5,   isGoal:true },
                  ];
                  return (
                    <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-cyan-400/40 shadow-xl">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-2xl font-black text-cyan-300">Q2</h3>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 font-bold">Apr – Jun 2026</span>
                          <span className="text-xs bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 px-3 py-1 rounded-full font-bold">Latest</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-1 mb-2">
                        <div className="text-slate-500 text-xs"></div>
                        {q2.map(m => (
                          <div key={m.label} className="text-center text-xs font-black text-cyan-400 uppercase tracking-wider">{m.label}</div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        {rows.map((row,ri) => (
                          <div key={ri} className="grid grid-cols-4 gap-1 py-1.5 border-b border-white/5 last:border-0 items-center">
                            <span className="text-slate-400 text-xs">{row.label}</span>
                            {q2.map((m,mi) => {
                              if (!m.totals) return <span key={mi} className="text-center text-xs text-slate-600">—</span>;
                              const v = row.key === 'totalAllRev'
                                ? (m.totals.totalRev||0) + (m.totals.totalRespRev||0)
                                : m.totals[row.key];
                              const n = m.totals.n;
                              const isGood = row.good === null ? null : row.isGoal ? row.good(v,n) : row.good(v);
                              const display = row.isGoal ? row.fmt(v,n) : row.fmt(v);
                              return (
                                <span key={mi} className={`text-center text-xs font-black ${isGood===null?'text-white':isGood?'text-emerald-300':'text-rose-300'}`}>
                                  {display}
                                </span>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Building Scorecard */}
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl overflow-hidden">
                <div className="p-5 border-b border-white/10 bg-white/5 flex items-center justify-between cursor-pointer select-none hover:bg-white/10 transition-all" onClick={() => setScorecardOpen(v => !v)}>
                  <div>
                    <h3 className="text-lg font-black text-white">Building Scorecard — Q1 · May · June MTD</h3>
                    <p className="text-slate-400 text-sm mt-1">Productivity · CPM · Mode % · Med B Revenue · Green = at goal</p>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${scorecardOpen ? 'rotate-0' : '-rotate-90'}`}/>
                </div>
                <div className={scorecardOpen ? 'overflow-x-auto' : 'hidden'}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5">
                        <th className="text-left py-3 px-4 text-slate-400 font-bold uppercase text-xs sticky left-0 bg-slate-900/90">Facility</th>
                        <th className="py-3 px-2 text-slate-400 font-bold uppercase text-xs text-center">Rgn</th>
                        <th colSpan={12} className="py-3 px-2 text-cyan-400 font-bold uppercase text-xs text-center border-l border-white/10">Q1</th>
                        <th colSpan={12} className="py-3 px-2 text-cyan-300 font-bold uppercase text-xs text-center border-l border-white/10">Q2</th>
                      </tr>
                      <tr className="border-b border-white/10">
                        <th className="sticky left-0 bg-slate-900/90 py-1"></th><th></th>
                        {EXEC_MONTHS.slice(0,3).map(m => ['Prod','CPM','Mode','Rev'].map(col => (
                          <th key={m.label+col} className="py-2 px-2 text-cyan-600 font-bold text-xs text-center">{m.label.slice(0,3)} {col}</th>
                        )))}
                        {EXEC_MONTHS.slice(3).map(m => ['Prod','CPM','Mode','Rev'].map(col => (
                          <th key={m.label+col} className="py-2 px-2 text-cyan-600 font-bold text-xs text-center">{m.label.slice(0,3)} {col}</th>
                        )))}
                      </tr>
                    </thead>
                    <tbody>
                      {facilityRows.map((row,ri) => {
                        const isNewRegion = ri===0 || row.region !== facilityRows[ri-1].region;
                        return (
                          <React.Fragment key={ri}>
                            {isNewRegion && <tr className="bg-white/5"><td colSpan={26} className="py-2 px-4 text-xs font-black uppercase tracking-widest text-slate-400">{row.region}</td></tr>}
                            <tr className="border-b border-white/5 hover:bg-white/5">
                              <td className="py-2 px-4 text-white font-bold text-xs sticky left-0 bg-slate-900/80 whitespace-nowrap">{shortName(row.facility)}</td>
                              <td className="py-2 px-2 text-center">
                                <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${row.region==='Golden Coast'?'bg-amber-500/20 text-amber-300':'bg-blue-500/20 text-blue-300'}`}>{row.region==='Golden Coast'?'GC':'OL'}</span>
                              </td>
                              {row.months.map((rec,mi) => {
                                const p = rec ? mtd(rec,'productivityMTD','productivity') : null;
                                const c = rec ? mtd(rec,'cpmMTD','cpm') : null;
                                const mo = rec ? mtd(rec,'modeOfTreatmentMTD','modeOfTreatment') : null;
                                const rv = rec ? mtd(rec,'medicareMPPRRevenueMTD','medicareMPPRRevenue') : null;
                                const cell = (val, good, fmt) => (
                                  <td key={Math.random()} className={`py-2 px-2 text-center text-xs font-bold ${val===null?'text-slate-600':good===null?'text-slate-300':good?'text-emerald-300 bg-emerald-500/5':'text-rose-300 bg-rose-500/5'}`}>
                                    {val===null?'—':fmt(val)}
                                  </td>
                                );
                                return (
                                  <React.Fragment key={mi}>
                                    {cell(p, p!==null?p>=getGoals(row.facility).productivity:null, v=>v.toFixed(1)+'%')}
                                    {cell(c, c!==null?Math.trunc(c*100)/100<=getGoals(row.facility).cpm:null, v=>'$'+v.toFixed(2))}
                                    {cell(mo,mo!==null?parseFloat(mo.toFixed(1))>=getGoals(row.facility).mode:null, v=>v.toFixed(1)+'%')}
                                    {cell(rv,null, v=>'$'+(v/1000).toFixed(1)+'k')}
                                  </React.Fragment>
                                );
                              })}
                            </tr>
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Spotlight */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-emerald-500/10 backdrop-blur-xl rounded-2xl border border-emerald-400/20 shadow-xl p-6">
                  <div className="flex items-center gap-3 mb-5"><span className="text-2xl">📈</span><h3 className="text-lg font-black text-white">Most Improved (Q1 → June MTD)</h3></div>
                  <div className="space-y-3">
                    {improved.map((r,i) => {
                      const janProd = r.months[0] ? mtd(r.months[0],'productivityMTD','productivity') : 0;
                      const marProd = r.months[2] ? mtd(r.months[2],'productivityMTD','productivity') : 0;
                      return (
                        <div key={i} className="bg-white/5 rounded-xl px-4 py-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-white font-bold text-sm">{shortName(r.facility)}</span>
                            <span className="text-emerald-300 font-black text-sm">{r.janScore}/4 → {r.marScore}/4 goals</span>
                          </div>
                          <div className="flex gap-4 text-xs text-slate-400">
                            <span>Prod: {janProd.toFixed(1)}% → <span className={marProd>=getGoals(r.facility).productivity?'text-emerald-300 font-bold':'text-rose-300 font-bold'}>{marProd.toFixed(1)}%</span></span>
                            {r.prodDiff > 0 && <span className="text-emerald-400">+{r.prodDiff.toFixed(1)}pp</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="bg-rose-500/10 backdrop-blur-xl rounded-2xl border border-rose-400/20 shadow-xl p-6">
                  <div className="flex items-center gap-3 mb-5"><span className="text-2xl">🔴</span><h3 className="text-lg font-black text-white">Needs Attention (failing 3+ goals, 2+ months)</h3></div>
                  {struggling.length === 0
                    ? <div className="text-emerald-400 font-bold text-sm">✓ No buildings chronically failing multiple goals</div>
                    : <div className="space-y-3">{struggling.map((r,i) => (
                        <div key={i} className="bg-white/5 rounded-xl px-4 py-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-white font-bold text-sm">{shortName(r.facility)}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${r.region==='Golden Coast'?'bg-amber-500/20 text-amber-300':'bg-blue-500/20 text-blue-300'}`}>{r.region==='Golden Coast'?'GC':'OL'}</span>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            {r.months.filter(Boolean).map((rec,mi) => {
                              const s = scoreRec(rec, r.facility);
                              return <div key={mi} className={`text-xs px-2 py-1 rounded-lg font-bold ${s>=3?'bg-emerald-500/20 text-emerald-300':s===2?'bg-yellow-500/20 text-yellow-300':'bg-rose-500/20 text-rose-300'}`}>{EXEC_MONTHS[mi].label}: {s}/4</div>;
                            })}
                          </div>
                        </div>
                      ))}</div>
                  }
                </div>
              </div>

              {/* ── ALOS Table */}
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
                <div className="p-5 border-b border-white/10">
                  <h3 className="text-lg font-black text-white">Average Length of Stay (days)</h3>
                  <p className="text-slate-400 text-xs mt-1">Red = below 30 days</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 px-4 text-slate-400 font-bold text-xs uppercase">Building</th>
                        {['Jan 2026','Feb 2026','Mar 2026','Apr','May','Jun'].map(m => (
                          <th key={m} className="py-3 px-4 text-slate-400 font-bold text-xs uppercase text-center">{m}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {['Golden Coast','Overland'].map(region => {
                        const regionFacs = allFacilities.filter(f => {
                            if (f === 'Palo Alto Post Acute') return false; // handled separately below
                            return allWeeklyData.find(d=>d.facility===f)?.region===region;
                          });
                        const facRows = regionFacs.map(fac => ({ fac, a: alosData[fac]||{} })).filter(({a}) => a.jan||a.feb||a.mar||a.apr||a.may);
                        // Palo Alto: Jan/Feb/Mar under Overland, Apr/May under Golden Coast
                        const paloAltoRow = region === 'Golden Coast'
                          ? [{ fac: 'Palo Alto Post Acute', a: { jan:'', feb:'', mar:'', apr: alosData['Palo Alto Post Acute']?.apr||'', may: alosData['Palo Alto Post Acute']?.may||'', jun: alosData['Palo Alto Post Acute']?.jun||'' } }]
                          : [{ fac: 'Palo Alto Post Acute', a: { jan: alosData['Palo Alto Post Acute']?.jan||'', feb: alosData['Palo Alto Post Acute']?.feb||'', mar: alosData['Palo Alto Post Acute']?.mar||'', apr:'', may:'', jun:'' } }];
                        if (!facRows.length) return null;

                        // Compute region averages
                        const avg = (mo) => {
                          const vals = facRows.map(({a})=>parseFloat(a[mo])).filter(v=>!isNaN(v));
                          return vals.length ? (vals.reduce((s,v)=>s+v,0)/vals.length).toFixed(1) : '—';
                        };

                        return (
                          <React.Fragment key={region}>
                            {/* Region header row */}
                            <tr className="bg-white/5 border-b border-white/10">
                              <td colSpan={7} className="py-2 px-4">
                                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">{region}</span>
                              </td>
                            </tr>
                            {/* Region average row */}
                            <tr className="border-b border-white/10 bg-white/3">
                              <td className="py-2 px-4 text-slate-400 text-xs font-bold italic">Region Avg</td>
                              {['jan','feb','mar','apr','may','jun'].map((mo,vi) => {
                                const v = avg(mo);
                                return (
                                  <td key={vi} className="py-2 px-4 text-center">
                                    <span className={`text-xs font-bold ${v!=='—'&&parseFloat(v)<30?'text-rose-400':'text-cyan-300'}`}>{v}</span>
                                  </td>
                                );
                              })}
                            </tr>
                            {/* Building rows */}
                            {[...facRows, ...paloAltoRow].map(({fac, a}, i) => (
                              <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-all">
                                <td className="py-2.5 px-4 text-white text-xs font-medium pl-8">{fac}</td>
                                {[a.jan,a.feb,a.mar,a.apr,a.may,a.jun].map((v, vi) => (
                                  <td key={vi} className="py-2.5 px-4 text-center">
                                    <span className={`text-sm font-bold ${v&&parseFloat(v)<30?'text-rose-400':'text-slate-300'}`}>
                                      {v||'—'}
                                    </span>
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Compliance Overview */}
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
                <div className="p-5 border-b border-white/10 flex items-center justify-between cursor-pointer select-none hover:bg-white/5 transition-all" onClick={() => setComplianceOpen(v => !v)}>
                  <h3 className="text-lg font-black text-white">Compliance Overview</h3>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${complianceOpen ? 'rotate-0' : '-rotate-90'}`}/>
                </div>
                <div className={complianceOpen ? '' : 'hidden'}>
                  {['Golden Coast', 'Overland'].map(region => (
                    <div key={region}>
                      <div className="px-5 py-2 bg-white/5 border-b border-white/10">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{region}</span>
                      </div>
                      {(complianceData[region] || []).map((r, i) => {
                        const s = (r.status || '').toLowerCase();
                        const isGreen = s.includes('green');
                        const isRed   = s.includes('red');
                        const dotColor  = isGreen ? 'bg-emerald-400' : isRed ? 'bg-rose-400' : 'bg-yellow-400';
                        const textColor = isGreen ? 'text-emerald-300' : isRed ? 'text-rose-300' : 'text-yellow-300';
                        return (
                          <div key={i} className="flex items-start gap-4 px-5 py-3 border-b border-white/5 hover:bg-white/5 transition-all">
                            <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${dotColor}`}/>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3">
                                <span className="text-white text-sm font-semibold">{r.building}</span>
                                <span className={`text-xs font-bold ${textColor}`}>{r.status}</span>
                              </div>
                              <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">{r.actionItem}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          );
        })()}

        {/* ══ CHECK-INS TAB ══════════════════════════════════════════════════ */}
        {activeView === 'checkins' && !isRestrictedView && (
          <div className="space-y-6 pb-12">

            {/* Header */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-2xl font-black text-white">DOR Weekly Check-Ins</h2>
                  <p className="text-slate-400 text-sm mt-1">
                    {checkInData.length > 0
                      ? `${checkInData.length} buildings · Week of ${checkInWeek}`
                      : 'Upload the Microsoft Forms export to view check-ins'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {checkInData.length > 0 && (
                    <button onClick={generateCheckInSummaries} disabled={summaryLoading}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 text-white rounded-xl font-semibold text-sm flex items-center gap-2 transition-all shadow-lg">
                      {summaryLoading
                        ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Summarizing...</>
                        : <><Zap className="w-3.5 h-3.5"/>Generate AI Summaries</>}
                    </button>
                  )}
                  <label className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-xl font-semibold text-sm flex items-center gap-2 cursor-pointer transition-all">
                    <Upload className="w-4 h-4"/>Upload Check-In Excel
                    <input type="file" accept=".xlsx" className="hidden" onChange={handleCheckInUpload}/>
                  </label>
                </div>
              </div>
            </div>

            {checkInData.length === 0 && (
              <div className="bg-white/5 rounded-2xl p-12 text-center border border-white/10">
                <div className="text-4xl mb-4">📋</div>
                <p className="text-slate-300 font-semibold">No check-in data loaded</p>
                <p className="text-slate-500 text-sm mt-2">Download the Excel export from Microsoft Forms and upload it above</p>
              </div>
            )}

            {checkInData.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {checkInData.map((r, i) => {
                  const isNo   = (v) => { if (!v || typeof v !== 'string') return false; const t = v.trim().toLowerCase(); return t === 'no' || t.startsWith('no ') || t.startsWith('no-') || t.startsWith('no,'); };
                  const isEmpty = (v) => !v || ['none','n/a','na','0',''].includes(v.toString().trim().toLowerCase());

                  const therapyFlag    = isNo(r.therapyGoalMet);
                  const missingFlag    = isNo(r.missingLabor) === false && !isEmpty(r.missingLabor) && r.missingLabor.toString().toLowerCase() !== 'no';
                  const complianceFlag = isNo(r.compliance);
                  const staffingFlag   = isNo(r.staffingCoverage) || isNo(r.weekendCoverage);
                  const hasOpenPos     = !isEmpty(r.staffing);
                  const hasTravelers   = !isEmpty(r.travelers) && r.travelers.toLowerCase() !== 'na';
                  const summary        = checkInSummaries[r.facility];

                  const flagCount = [therapyFlag, missingFlag, complianceFlag, staffingFlag].filter(Boolean).length;
                  const urgency = flagCount >= 2 ? 'border-rose-400/50' : flagCount === 1 ? 'border-yellow-400/30' : 'border-white/10';

                  const SectionRow = ({label, val, flagged}) => {
                    if (!val) return null;
                    return (
                      <div className="flex items-start gap-2 text-xs py-1.5 border-b border-white/5 last:border-0">
                        <span className="text-slate-500 font-bold uppercase tracking-wide min-w-[90px] pt-0.5">{label}</span>
                        <span className={`leading-relaxed ${flagged ? 'text-rose-300' : 'text-slate-300'}`}>{val.toString()}</span>
                      </div>
                    );
                  };

                  return (
                    <div key={i} className={`bg-white/5 backdrop-blur-xl rounded-2xl border ${urgency} overflow-hidden`}>

                      {/* Header */}
                      <div className="p-4 border-b border-white/10 flex items-start justify-between gap-3">
                        <div>
                          <div className="font-black text-white text-base">{r.facility}</div>
                          <div className="text-slate-400 text-xs mt-0.5">{r.dorName} · {r.weekDisplay}</div>
                        </div>
                        <div className="flex gap-1.5 flex-wrap justify-end">
                          {therapyFlag    && <span className="text-xs px-2 py-0.5 bg-rose-500/20 text-rose-300 rounded-full font-bold">Therapy ⚠</span>}
                          {missingFlag    && <span className="text-xs px-2 py-0.5 bg-rose-500/20 text-rose-300 rounded-full font-bold">Missing Labor</span>}
                          {complianceFlag && <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-full font-bold">Compliance ⚠</span>}
                          {staffingFlag   && <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-300 rounded-full font-bold">Staffing ⚠</span>}
                          {hasOpenPos     && <span className="text-xs px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full font-bold">Open Positions</span>}
                          {hasTravelers   && <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full font-bold">Travelers</span>}
                        </div>
                      </div>

                      {/* Section responses */}
                      <div className="px-4 pt-3 pb-1">
                        <SectionRow label="Therapy Goals" val={r.therapyGoalMet} flagged={therapyFlag}/>
                        {therapyFlag && r.therapyDriver && <SectionRow label="Driver" val={r.therapyDriver} flagged={true}/>}
                        <SectionRow label="Missing Labor" val={r.missingLabor} flagged={missingFlag}/>
                        <SectionRow label="Orders/Docs" val={r.orders?.filter(v=>isNo(v)).length > 0 ? 'Issues flagged: '+r.orders.filter(v=>isNo(v)).join(', ') : r.orders?.[0] || ''} flagged={r.orders?.some(v=>isNo(v))}/>
                        <SectionRow label="Compliance" val={r.compliance} flagged={isNo(r.compliance)}/>
                        {r.complianceNotes && <SectionRow label="Notes" val={r.complianceNotes} flagged={false}/>}
                        <SectionRow label="Staffing" val={r.staffingCoverage} flagged={isNo(r.staffingCoverage)}/>
                        <SectionRow label="Weekend" val={r.weekendCoverage} flagged={isNo(r.weekendCoverage)}/>
                        <SectionRow label="Time Load" val={r.timeLoad} flagged={false}/>
                        {hasTravelers && <SectionRow label="Travelers" val={r.travelers} flagged={false}/>}
                        {hasOpenPos   && <SectionRow label="Open Positions" val={r.staffing} flagged={false}/>}
                        {r.pulse      && <SectionRow label="DOR Pulse" val={r.pulse} flagged={false}/>}
                      </div>

                      {/* AI Summary */}
                      {summary && (
                        <div className="px-4 py-3 border-t border-white/10 bg-indigo-500/5">
                          <div className="flex items-center gap-2 mb-1">
                            <Zap className="w-3 h-3 text-indigo-400"/>
                            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wide">AI Summary</span>
                          </div>
                          <p className="text-slate-300 text-xs leading-relaxed">{summary}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ FACILITIES TAB ════════════════════════════════════════════════ */}
        {activeView === 'facilities' && (
          <div className="space-y-6 pb-12">

            {/* ── DOR: My Building ── */}
            {isRestrictedView && myFacilityData && (
              <div className="space-y-6">

                {/* AI Morning Briefing */}
                <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 backdrop-blur-xl rounded-2xl border border-indigo-400/30 shadow-xl overflow-hidden">
                  <div className="p-5 border-b border-white/10 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center shadow-lg">
                        <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Weekly Briefing — Week ending {throughDate}</div>
                        <div className="text-sm text-slate-400">{myFacilityData.facility}</div>
                      </div>
                    </div>
                    <button onClick={generateBriefing} disabled={briefingLoading}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-lg font-semibold text-sm flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5" />
                      {briefingLoading ? 'Generating...' : briefingText ? 'Regenerate' : 'Generate Briefing'}
                    </button>
                  </div>
                  <div className="p-5">
                    {!briefingText && !briefingLoading && (
                      <p className="text-slate-500 text-sm italic">Press "Generate Briefing" to get your AI-powered daily action plan based on your current metrics.</p>
                    )}
                    {briefingLoading && !briefingText && (
                      <div className="flex items-center gap-3 text-indigo-300 text-sm">
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
                        Analyzing your building data...
                      </div>
                    )}
                    {briefingText && (
                      <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">{briefingText}</p>
                    )}
                  </div>
                </div>

                {/* Building header card */}
                <div className="bg-gradient-to-br from-cyan-900/40 to-teal-900/40 backdrop-blur-xl rounded-2xl border border-cyan-400/30 shadow-xl overflow-hidden">
                  <div className="p-6 border-b border-white/10 bg-gradient-to-r from-cyan-500/10 to-teal-500/10">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-xl flex items-center justify-center shadow-xl">
                          <Building2 className="w-7 h-7 text-white" strokeWidth={2.5} />
                        </div>
                        <div>
                          <h2 className="text-2xl font-black text-white">{myFacilityData.facility}</h2>
                          <div className="flex items-center gap-3 mt-1">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${myFacilityData.region==='Golden Coast'?'bg-amber-500/30 text-amber-200 border border-amber-400/50':'bg-blue-500/30 text-blue-200 border border-blue-400/50'}`}>{myFacilityData.region}</span>
                            <span className="text-slate-400 text-sm">{currentMonthName} MTD · Through {new Date(latestDateStr + 'T12:00:00').toLocaleDateString('en-US', {month:'numeric', day:'numeric', year:'numeric'})}</span>
                          </div>
                        </div>
                      </div>
                      <button onClick={generateMyReport}
                        className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg font-semibold text-sm flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Generate My Report
                      </button>
                    </div>
                  </div>

                  {/* Goal metric cards — MTD */}
                  <div className="p-5">
                    {(() => {
                      const p    = mtd(myFacilityData,'productivityMTD','productivity');
                      const c    = mtd(myFacilityData,'cpmMTD','cpm');
                      const cas  = myFacilityData.medBCaseload || 0;
                      const elig = myFacilityData.medBEligible || 0;
                      const casePct = elig > 0 ? Math.round((cas/elig)*100) : 0;
                      const mo   = mtd(myFacilityData,'modeOfTreatmentMTD','modeOfTreatment');
                      const upv  = mtd(myFacilityData,'unitsPerVisitMTD','unitsPerVisit');
                      const rev  = mtd(myFacilityData,'medicareMPPRRevenueMTD','medicareMPPRRevenue');
                      const units = myFacilityData.medBUnitsMTD || myFacilityData.medBUnitsThisWeek || 0;
                      const goals = getGoals(restrictedFacility);
                      const prodGoal = goals.productivity; const cpmGoal = goals.cpm; const modeGoal = goals.mode; const medBGoal = goals.medB;
                      return (
                        <>
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                            {[
                              { label:'Productivity', val:p.toFixed(1)+'%',  good:p>=prodGoal, sub:p>=prodGoal?'✓ Meeting goal':'Below '+prodGoal+'% goal', icon:TrendingUp, bg:prodBg(p, prodGoal), spark:dorSparkData?.productivity, higherBetter:true, proj:monthEndProjection?.productivity, projGood: monthEndProjection?.productivity>=prodGoal, projFmt: v=>v.toFixed(1)+'%' },
                              { label:'CPM',          val:'$'+Math.trunc(c*100)/100,  good:Math.trunc(c*100)/100<=cpmGoal, sub:Math.trunc(c*100)/100<cpmGoal?'✓ Under $'+cpmGoal:Math.trunc(c*100)/100===cpmGoal?'✓ At $'+cpmGoal+' target':'Above $'+cpmGoal+' target', icon:PieChart, bg:cpmBg(c, cpmGoal), spark:dorSparkData?.cpm, higherBetter:false, proj:monthEndProjection?.cpm, projGood: monthEndProjection?.cpmMTD<=cpmGoal, projFmt: v=>'$'+v.toFixed(2) },
                              { label:'Med B on CL',  val:casePct+'%',       good:casePct>=medBGoal,sub:cas+' of '+elig+' eligible', icon:Users, bg:casePct>=medBGoal?'bg-emerald-500/20 border-emerald-400/50':'bg-rose-500/20 border-rose-400/50', spark:null, proj:null },
                              { label:'Mode of Tx',   val:mo.toFixed(1)+'%', good:mo>=modeGoal, sub:mo>=modeGoal?'✓ Meeting '+modeGoal+'% goal':'Below '+modeGoal+'% goal', icon:Activity, bg:mo>=modeGoal?'bg-emerald-500/20 border-emerald-400/50':'bg-rose-500/20 border-rose-400/50', spark:dorSparkData?.modeOfTreatment, higherBetter:true, proj:monthEndProjection?.modeOfTreatment, projGood: monthEndProjection?.modeOfTreatment>=modeGoal, projFmt: v=>v.toFixed(1)+'%' },
                            ].map((card,i) => (
                              <div key={i} className={`rounded-xl p-5 border-2 ${card.bg}`}>
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <card.icon className={`w-4 h-4 ${card.good?'text-emerald-400':'text-rose-400'}`} strokeWidth={2.5} />
                                    <span className="text-xs text-slate-300 font-bold uppercase">{card.label}</span>
                                  </div>
                                  {card.spark && card.spark.length >= 2 && (
                                    <svg width="80" height="28" viewBox="0 0 80 28">
                                      <path d={sparkPath(card.spark)} fill="none" stroke={sparkColor(card.spark, card.higherBetter)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8"/>
                                      <circle cx={(80/(card.spark.length-1))*(card.spark.length-1)} cy={28-((card.spark[card.spark.length-1]-Math.min(...card.spark))/(Math.max(...card.spark)-Math.min(...card.spark)||1))*28} r="3" fill={sparkColor(card.spark, card.higherBetter)}/>
                                    </svg>
                                  )}
                                </div>
                                <div className={`text-3xl font-black ${card.good?'text-emerald-300':'text-rose-300'}`}>{card.val}</div>
                                <div className="text-xs text-slate-400 mt-2">{card.sub}</div>
                                {card.proj != null && monthEndProjection && (
                                  <div className={`mt-2 text-xs font-semibold px-2 py-1 rounded-lg inline-block ${card.projGood?'bg-emerald-500/20 text-emerald-300':'bg-amber-500/20 text-amber-300'}`}>
                                    Proj: {card.projFmt(card.proj)} · {currentMonthName.slice(0,3)} {monthEndProjection.daysTotal}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {[
                              { label:'Units / Visit',   val:upv.toFixed(2),                  color:'text-indigo-300',  bg:'bg-indigo-500/10 border-indigo-400/20',  icon:BarChart3, spark:dorSparkData?.unitsPerVisit, good:upv>=3, higherBetter:true },
                              { label:'Med B Eligible',  val:String(elig),                     color:'text-purple-300',  bg:'bg-purple-500/10 border-purple-400/20',  icon:Users     },
                              { label:'Med B Units MTD', val:units.toLocaleString(),            color:'text-blue-300',    bg:'bg-blue-500/10 border-blue-400/20',      icon:BarChart3 },
                              { label:'Medicare Rev MTD',val:'$'+(rev/1000).toFixed(1)+'k',    color:'text-emerald-300', bg:'bg-emerald-500/10 border-emerald-400/20', icon:DollarSign, proj: monthEndProjection?.revenue },
                            ].map((card,i) => (
                              <div key={i} className={`border rounded-xl p-5 ${card.bg}`}>
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <card.icon className={`w-4 h-4 ${card.color}`} strokeWidth={2.5} />
                                    <span className="text-xs text-slate-300 font-bold uppercase">{card.label}</span>
                                  </div>
                                  {card.spark && card.spark.length >= 2 && (
                                    <svg width="80" height="28" viewBox="0 0 80 28">
                                      <path d={sparkPath(card.spark)} fill="none" stroke={sparkColor(card.spark, card.higherBetter)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8"/>
                                      <circle cx="80" cy={28-((card.spark[card.spark.length-1]-Math.min(...card.spark))/(Math.max(...card.spark)-Math.min(...card.spark)||1))*28} r="3" fill={sparkColor(card.spark, card.higherBetter)}/>
                                    </svg>
                                  )}
                                </div>
                                <div className={`text-3xl font-black ${card.color}`}>{card.val}</div>
                                {card.proj != null && monthEndProjection && (
                                  <div className="mt-2 text-xs font-semibold px-2 py-1 rounded-lg inline-block bg-emerald-500/20 text-emerald-300">
                                    Proj: ${(card.proj/1000).toFixed(1)}k · {currentMonthName.slice(0,3)} {monthEndProjection.daysTotal}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Trend Alerts */}
                {myPrevWeekData && (() => {
                  const alerts = [], wins = [];
                  const prodMTD = mtd(myFacilityData,'productivityMTD','productivity');
                  const cpmMTD  = mtd(myFacilityData,'cpmMTD','cpm');
                  const prodDiff = myFacilityData.productivity - myPrevWeekData.productivity;
                  const cpmDiff  = myFacilityData.cpm - myPrevWeekData.cpm;
                  const modeDiff = myFacilityData.modeOfTreatment - myPrevWeekData.modeOfTreatment;
                  const upvDiff  = myFacilityData.unitsPerVisit - myPrevWeekData.unitsPerVisit;

                  if (prodMTD < 84) alerts.push({ msg:`Productivity ${prodMTD.toFixed(1)}% — below 84% goal`, severe:true });
                  else if (prodDiff <= -2) alerts.push({ msg:`Productivity dropped ${Math.abs(prodDiff).toFixed(1)}pp this week`, severe:false });
                  else if (prodDiff >= 2)  wins.push(`Productivity up ${prodDiff.toFixed(1)}pp this week`);

                  if (cpmMTD > 1.45) alerts.push({ msg:`CPM $${cpmMTD.toFixed(2)} — above $1.45 target`, severe:cpmMTD>1.55 });
                  else if (cpmDiff >= 0.05)  alerts.push({ msg:`CPM rose $${cpmDiff.toFixed(2)} this week`, severe:false });
                  else if (cpmDiff <= -0.05) wins.push(`CPM improved $${Math.abs(cpmDiff).toFixed(2)} this week`);

                  if (myFacilityData.modeOfTreatment === 0) alerts.push({ msg:'No group/concurrent treatment this week', severe:true });
                  else if (modeDiff <= -2) alerts.push({ msg:`Mode dropped ${Math.abs(modeDiff).toFixed(1)}pp this week`, severe:false });
                  else if (modeDiff >= 2)  wins.push(`Mode up ${modeDiff.toFixed(1)}pp this week`);

                  if (upvDiff <= -0.3) alerts.push({ msg:`Units per visit dropped ${Math.abs(upvDiff).toFixed(2)} this week`, severe:false });
                  else if (upvDiff >= 0.3) wins.push(`Units per visit up ${upvDiff.toFixed(2)} this week`);

                  if (!alerts.length && !wins.length) return null;
                  return (
                    <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl p-6">
                      <h3 className="text-lg font-black text-white mb-4">Week-over-Week Alerts</h3>
                      {alerts.length > 0 && (
                        <div className="mb-4">
                          <div className="text-sm font-bold text-rose-300 uppercase tracking-wider mb-2">⚠️ Needs Attention</div>
                          {alerts.map((a,i) => (
                            <div key={i} className={`flex items-start gap-2 px-4 py-3 rounded-xl mb-2 ${a.severe?'bg-rose-500/20 border border-rose-400/30':'bg-amber-500/10 border border-amber-400/20'}`}>
                              <span className="text-sm">{a.severe?'🔴':'🟡'}</span>
                              <span className={`text-sm font-medium ${a.severe?'text-rose-200':'text-amber-200'}`}>{a.msg}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {wins.length > 0 && (
                        <div>
                          <div className="text-sm font-bold text-emerald-300 uppercase tracking-wider mb-2">✅ Improvements This Week</div>
                          {wins.map((w,i) => (
                            <div key={i} className="flex items-start gap-2 px-4 py-3 rounded-xl mb-2 bg-emerald-500/10 border border-emerald-400/20">
                              <span className="text-sm">🟢</span>
                              <span className="text-sm font-medium text-emerald-200">{w}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Feb vs March comparison (DOR) */}
                {myFebFinal && myFacilityData.date>=EXEC_MONTHS[EXEC_MONTHS.length-1].start && (
                  <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl p-6">
                    <h3 className="text-lg font-black text-white mb-5">📊 {EXEC_MONTHS[EXEC_MONTHS.length-2].label.replace(' MTD','')} Final vs {currentMonthName} MTD</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { label:'Productivity', feb:mtd(myFebFinal,'productivityMTD','productivity'),    mar:mtd(myFacilityData,'productivityMTD','productivity'),    fmt:v=>v.toFixed(1)+'%', key:'prod', better:'higher' },
                        { label:'CPM',          feb:mtd(myFebFinal,'cpmMTD','cpm'),                     mar:mtd(myFacilityData,'cpmMTD','cpm'),                     fmt:v=>'$'+v.toFixed(2), key:'cpm',  better:'lower'  },
                        { label:'Mode of Tx',   feb:mtd(myFebFinal,'modeOfTreatmentMTD','modeOfTreatment'), mar:mtd(myFacilityData,'modeOfTreatmentMTD','modeOfTreatment'), fmt:v=>v.toFixed(1)+'%', key:'mode', better:'higher' },
                        { label:'Units/Visit',  feb:mtd(myFebFinal,'unitsPerVisitMTD','unitsPerVisit'),  mar:mtd(myFacilityData,'unitsPerVisitMTD','unitsPerVisit'),  fmt:v=>v.toFixed(2),     key:'upv',  better:'higher' },
                      ].map((m,i) => {
                        const diff = m.mar - m.feb;
                        const improved = m.better==='higher' ? diff>0.05 : diff<-0.05;
                        const declined = m.better==='higher' ? diff<-0.05 : diff>0.05;
                        const diffStr = m.key==='cpm' ? (diff>0?'+':'')+' $'+Math.abs(diff).toFixed(2) : (diff>0?'+':'')+diff.toFixed(m.key==='upv'?2:1);
                        return (
                          <div key={i} className="bg-white/5 rounded-xl p-4">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{m.label}</div>
                            <div className="flex items-end justify-between">
                              <div>
                                <div className="text-xs text-slate-500 mb-1">{EXEC_MONTHS[EXEC_MONTHS.length-2].label.replace(' MTD','')} Final</div>
                                <div className="text-lg font-black text-white">{m.fmt(m.feb)}</div>
                              </div>
                              <div className={`text-xl font-black px-2 ${improved?'text-emerald-400':declined?'text-rose-400':'text-slate-500'}`}>{improved?'↑':declined?'↓':'→'}</div>
                              <div className="text-right">
                                <div className="text-xs text-slate-500 mb-1">{currentMonthName} MTD</div>
                                <div className={`text-lg font-black ${improved?'text-emerald-300':declined?'text-rose-300':'text-white'}`}>{m.fmt(m.mar)}</div>
                              </div>
                            </div>
                            <div className={`text-xs font-bold mt-2 pt-2 border-t border-white/10 ${improved?'text-emerald-400':declined?'text-rose-400':'text-slate-500'}`}>
                              {diffStr} vs {EXEC_MONTHS[EXEC_MONTHS.length-2].label.replace(' MTD','')}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Peer Benchmarking */}
                {myRegionData.length > 1 && (() => {
                  const peers = myRegionData.filter(f => f.facility !== restrictedFacility);
                  const goals = getGoals(restrictedFacility);
                  const prodGoal = goals.productivity; const cpmGoal = goals.cpm; const modeGoal = goals.mode; const medBGoal = goals.medB;
                  const p    = mtd(myFacilityData,'productivityMTD','productivity');
                  const c    = mtd(myFacilityData,'cpmMTD','cpm');
                  const mo   = mtd(myFacilityData,'modeOfTreatmentMTD','modeOfTreatment');
                  const upv  = mtd(myFacilityData,'unitsPerVisitMTD','unitsPerVisit');

                  const peerAvg = (fn) => peers.reduce((s,f)=>s+fn(f),0)/peers.length;
                  const peerTop = (fn, higher) => higher ? Math.max(...peers.map(fn)) : Math.min(...peers.map(fn));
                  const peerRank = (fn, higher) => {
                    const all = myRegionData.map(fn).sort((a,b)=>higher?b-a:a-b);
                    return all.indexOf(fn(myFacilityData)) + 1;
                  };

                  const metrics = [
                    {
                      label: 'Productivity', mine: p, goal: prodGoal,
                      avg:   peerAvg(f=>mtd(f,'productivityMTD','productivity')),
                      top:   peerTop(f=>mtd(f,'productivityMTD','productivity'), true),
                      rank:  peerRank(f=>mtd(f,'productivityMTD','productivity'), true),
                      fmt: v=>v.toFixed(1)+'%', higher: true,
                      color: p>=prodGoal?'text-emerald-300':'text-rose-300',
                    },
                    {
                      label: 'CPM', mine: c, goal: cpmGoal,
                      avg:   peerAvg(f=>mtd(f,'cpmMTD','cpm')),
                      top:   peerTop(f=>mtd(f,'cpmMTD','cpm'), false),
                      rank:  peerRank(f=>mtd(f,'cpmMTD','cpm'), false),
                      fmt: v=>'$'+v.toFixed(2), higher: false,
                      color: Math.trunc(c*100)/100<=cpmGoal?'text-emerald-300':'text-rose-300',
                    },
                    {
                      label: 'Mode of Tx', mine: mo, goal: modeGoal,
                      avg:   peerAvg(f=>mtd(f,'modeOfTreatmentMTD','modeOfTreatment')),
                      top:   peerTop(f=>mtd(f,'modeOfTreatmentMTD','modeOfTreatment'), true),
                      rank:  peerRank(f=>mtd(f,'modeOfTreatmentMTD','modeOfTreatment'), true),
                      fmt: v=>v.toFixed(1)+'%', higher: true,
                      color: mo>=modeGoal?'text-emerald-300':'text-rose-300',
                    },
                    {
                      label: 'UPV', mine: upv, goal: 3.0,
                      avg:   peerAvg(f=>mtd(f,'unitsPerVisitMTD','unitsPerVisit')),
                      top:   peerTop(f=>mtd(f,'unitsPerVisitMTD','unitsPerVisit'), true),
                      rank:  peerRank(f=>mtd(f,'unitsPerVisitMTD','unitsPerVisit'), true),
                      fmt: v=>v.toFixed(2), higher: true,
                      color: upv>=3?'text-emerald-300':'text-rose-300',
                    },
                  ];

                  return (
                    <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl overflow-hidden">
                      <div className="p-5 border-b border-white/10 bg-gradient-to-r from-cyan-900/30 to-teal-900/30">
                        <h3 className="text-xl font-black text-white">Peer Benchmarking</h3>
                        <p className="text-slate-400 text-sm mt-1">How you compare to {peers.length} peers in {myRegion}</p>
                      </div>
                      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {metrics.map((m,i) => {
                          const gap     = m.higher ? m.mine - m.avg : m.avg - m.mine;
                          const topGap  = m.higher ? m.top - m.mine : m.mine - m.top;
                          const ahead   = gap > 0;
                          const rankOf  = myRegionData.length;
                          const barPct  = Math.min(100, Math.max(0, m.higher
                            ? ((m.mine - Math.min(...myRegionData.map(f=>mtd(f, m.label==='Productivity'?'productivityMTD':m.label==='CPM'?'cpmMTD':m.label==='Mode of Tx'?'modeOfTreatmentMTD':'unitsPerVisitMTD', m.label==='Productivity'?'productivity':m.label==='CPM'?'cpm':m.label==='Mode of Tx'?'modeOfTreatment':'unitsPerVisit')))) /
                              (Math.max(...myRegionData.map(f=>mtd(f, m.label==='Productivity'?'productivityMTD':m.label==='CPM'?'cpmMTD':m.label==='Mode of Tx'?'modeOfTreatmentMTD':'unitsPerVisitMTD', m.label==='Productivity'?'productivity':m.label==='CPM'?'cpm':m.label==='Mode of Tx'?'modeOfTreatment':'unitsPerVisit'))) -
                               Math.min(...myRegionData.map(f=>mtd(f, m.label==='Productivity'?'productivityMTD':m.label==='CPM'?'cpmMTD':m.label==='Mode of Tx'?'modeOfTreatmentMTD':'unitsPerVisitMTD', m.label==='Productivity'?'productivity':m.label==='CPM'?'cpm':m.label==='Mode of Tx'?'modeOfTreatment':'unitsPerVisit')))) || 1) * 100
                            : 0));

                          return (
                            <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/10">
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{m.label}</span>
                                <span className="text-xs font-bold text-slate-500">Rank #{m.rank} of {rankOf}</span>
                              </div>
                              <div className="flex items-end justify-between mb-3">
                                <div>
                                  <div className={`text-2xl font-black ${m.color}`}>{m.fmt(m.mine)}</div>
                                  <div className="text-xs text-slate-500 mt-0.5">Your MTD</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-bold text-slate-300">{m.fmt(m.avg)}</div>
                                  <div className="text-xs text-slate-500">Region avg</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-bold text-cyan-300">{m.fmt(m.top)}</div>
                                  <div className="text-xs text-slate-500">Region best</div>
                                </div>
                              </div>
                              {/* Bar showing position */}
                              <div className="relative h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                                <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-cyan-500/30 to-teal-500/30 rounded-full" style={{width:'100%'}} />
                                <div className="absolute top-0 h-full bg-gradient-to-r from-cyan-500 to-teal-500 rounded-full transition-all" style={{width:`${barPct}%`}} />
                              </div>
                              <div className={`text-xs font-bold ${ahead?'text-emerald-400':'text-amber-400'}`}>
                                {ahead
                                  ? `+${m.fmt(Math.abs(gap)).replace('$','')} above regional avg`
                                  : `${m.fmt(Math.abs(gap)).replace('$','')} below regional avg`}
                                {topGap > 0.01 && <span className="text-slate-500 font-normal ml-2">· {m.fmt(topGap).replace('$','')} gap to #1</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Regional Leaderboard */}
                {myRegionData.length > 0 && (
                  <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl overflow-hidden">
                    <div className="p-5 border-b border-white/10 bg-gradient-to-r from-indigo-900/30 to-purple-900/30">
                      <h3 className="text-xl font-black text-white">{myRegion} Region</h3>
                      <p className="text-slate-400 text-sm mt-1">{myRegionData.length} facilities — click headers to sort</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-white/10 bg-white/5">
                            {[{k:'facility',label:'Facility'},{k:'productivity',label:'Productivity'},{k:'cpm',label:'CPM'},{k:'modeOfTreatment',label:'Mode %'},{k:'medBCaseload',label:'Caseload'},{k:'score',label:'Goals'}].map(col => (
                              <th key={col.k}
                                onClick={() => { if(dorLeaderboardSort===col.k) setDorLeaderboardDir(d=>d==='asc'?'desc':'asc'); else { setDorLeaderboardSort(col.k); setDorLeaderboardDir(col.k==='cpm'?'asc':'desc'); }}}
                                className="py-3 px-4 text-slate-400 font-bold text-xs uppercase cursor-pointer hover:text-white select-none text-left">
                                <span className="flex items-center gap-1">
                                  {col.label}
                                  {dorLeaderboardSort===col.k ? (dorLeaderboardDir==='asc'?<ChevronUp className="w-3 h-3 text-cyan-400"/>:<ChevronDown className="w-3 h-3 text-cyan-400"/>) : <ChevronDown className="w-3 h-3 opacity-30"/>}
                                </span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[...myRegionData].sort((a,b) => {
                            const getV = (r,k) => {
                              if(k==='productivity') return mtd(r,'productivityMTD','productivity');
                              if(k==='cpm')          return mtd(r,'cpmMTD','cpm');
                              if(k==='modeOfTreatment') return mtd(r,'modeOfTreatmentMTD','modeOfTreatment');
                              if(k==='score') return scoreRec(r, r.facility);
                              return r[k]||0;
                            };
                            const va=getV(a,dorLeaderboardSort), vb=getV(b,dorLeaderboardSort);
                            return dorLeaderboardDir==='asc' ? va-vb : vb-va;
                          }).map((f,i) => {
                            const isMe = f.facility === restrictedFacility;
                            const p  = mtd(f,'productivityMTD','productivity');
                            const c  = mtd(f,'cpmMTD','cpm');
                            const mo = mtd(f,'modeOfTreatmentMTD','modeOfTreatment');
                            const sc = scoreRec(f, f.facility);
                            const fg = getGoals(f.facility);
                            return (
                              <tr key={i} className={`border-b border-white/5 ${isMe?'bg-cyan-500/10 border-cyan-400/20':'hover:bg-white/5'}`}>
                                <td className="py-3 px-4 text-sm font-bold text-white">{f.facility}{isMe&&<span className="ml-2 text-xs text-cyan-400 font-black">(You)</span>}</td>
                                <td className={`py-3 px-4 text-sm font-black ${prodColor(p, fg.productivity)}`}>{p.toFixed(1)}%</td>
                                <td className={`py-3 px-4 text-sm font-black ${cpmColor(c, fg.cpm)}`}>${Math.trunc(c*100)/100}</td>
                                <td className={`py-3 px-4 text-sm font-black ${modeColor(mo, fg.mode)}`}>{mo.toFixed(1)}%</td>
                                <td className="py-3 px-4 text-sm font-bold text-white">{f.medBCaseload||0}</td>
                                <td className="py-3 px-4"><span className={`px-2 py-1 rounded-lg text-xs font-black ${scoreBadge(sc)}`}>{sc}/4</span></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}


                {/* Monthly Performance History */}
                <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl overflow-hidden">
                  <div className="p-5 border-b border-white/10">
                    <h3 className="text-lg font-black text-white">Monthly Performance History</h3>
                    <p className="text-slate-400 text-xs mt-1">MTD values for each month</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/5">
                          {['Month','Prod %','CPM','Mode %','UPV','Med B Rev'].map(h => (
                            <th key={h} className="py-2 px-4 text-left text-xs font-bold text-slate-400 uppercase">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {getMonthlyData(restrictedFacility).slice().reverse().map((r,i) => (
                          <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                            <td className="py-2 px-4 text-white font-bold text-xs">{r.month}</td>
                            <td className={`py-2 px-4 font-black text-xs ${prodColor(r.productivity, getGoals(restrictedFacility).productivity)}`}>{r.productivity.toFixed(1)}%</td>
                            <td className={`py-2 px-4 font-black text-xs ${cpmColor(r.cpm, getGoals(restrictedFacility).cpm)}`}>${Math.trunc(r.cpm*100)/100}</td>
                            <td className={`py-2 px-4 font-black text-xs ${modeColor(r.modeOfTreatment, getGoals(restrictedFacility).mode)}`}>{r.modeOfTreatment.toFixed(1)}%</td>
                            <td className="py-2 px-4 text-slate-300 text-xs">{r.unitsPerVisit.toFixed(2)}</td>
                            <td className="py-2 px-4 text-emerald-300 font-bold text-xs">${(r.medicareMPPRRevenue/1000).toFixed(1)}k</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* ── ADMIN: All Facilities ── */}
            {!isRestrictedView && (
              <div className="space-y-4">
                <div className="flex gap-3 flex-wrap items-center">
                  <div className="relative flex-1 min-w-48">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="Search facilities..."
                      className="w-full bg-white/10 border border-white/20 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none" />
                  </div>
                  <select value={filterProductivity} onChange={e=>setFilterProductivity(e.target.value)}
                    className="bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none">
                    <option value="all" className="bg-slate-800">All Productivity</option>
                    <option value="meeting" className="bg-slate-800">Meeting Goal (≥84%)</option>
                    <option value="below" className="bg-slate-800">Below Goal</option>
                  </select>
                  <select value={filterCPM} onChange={e=>setFilterCPM(e.target.value)}
                    className="bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none">
                    <option value="all" className="bg-slate-800">All CPM</option>
                    <option value="meeting" className="bg-slate-800">At Goal (≤$1.45)</option>
                    <option value="above" className="bg-slate-800">Above Goal</option>
                  </select>
                </div>
                <div className="text-slate-400 text-sm">Showing {filteredFacilities.length} of {viewableData.length} facilities</div>

                <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl overflow-hidden divide-y divide-white/5">
                  {filteredFacilities.map((facility,idx) => {
                    const history    = getFacilityHistory(facility.facility);
                    const isExpanded = expandedFacility === facility.facility;
                    const p   = mtd(facility,'productivityMTD','productivity');
                    const c   = mtd(facility,'cpmMTD','cpm');
                    const mo  = mtd(facility,'modeOfTreatmentMTD','modeOfTreatment');
                    const upv = mtd(facility,'unitsPerVisitMTD','unitsPerVisit');
                    const rev = mtd(facility,'medicareMPPRRevenueMTD','medicareMPPRRevenue');
                    const units = facility.medBUnitsMTD || facility.medBUnitsThisWeek || 0;
                    const sc  = scoreRec(facility, facility.facility);
                    return (
                      <div key={idx}>
                        <div className="p-5 hover:bg-white/5 transition-all cursor-pointer"
                          onClick={() => setExpandedFacility(isExpanded ? null : facility.facility)}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${facility.region==='Golden Coast'?'bg-amber-500/20':'bg-blue-500/20'}`}>
                                <Building2 className={`w-5 h-5 ${facility.region==='Golden Coast'?'text-amber-300':'text-blue-300'}`} strokeWidth={2.5} />
                              </div>
                              <div>
                                <div className="text-white font-bold text-sm">{facility.facility}</div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${facility.region==='Golden Coast'?'bg-amber-500/20 text-amber-300':'bg-blue-500/20 text-blue-300'}`}>{facility.region}</span>
                                  <span className="text-slate-500 text-xs">{history.length} weeks · {facility.date}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="hidden md:grid grid-cols-4 gap-5 text-center">
                                {[
                                  { label:'Prod', value:p.toFixed(1)+'%', color:prodColor(p,getGoals(facility.facility).productivity) },
                                  { label:'CPM',  value:'$'+Math.trunc(c*100)/100, color:cpmColor(c,getGoals(facility.facility).cpm)  },
                                  { label:'Mode', value:mo.toFixed(1)+'%',color:modeColor(mo,getGoals(facility.facility).mode)},
                                  { label:'Rev',  value:'$'+(rev/1000).toFixed(1)+'k', color:'text-emerald-300' },
                                ].map((m,i) => (
                                  <div key={i}>
                                    <div className={`text-sm font-black ${m.color}`}>{m.value}</div>
                                    <div className="text-xs text-slate-500">{m.label}</div>
                                  </div>
                                ))}
                              </div>
                              <span className={`px-2 py-1 rounded-lg text-xs font-black ${scoreBadge(sc)}`}>{sc}/4</span>
                              {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400"/> : <ChevronDown className="w-5 h-5 text-slate-400"/>}
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="px-5 pb-5 border-t border-white/5">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 mb-4">
                              {[
                                { label:'Prod MTD',      val:p.toFixed(1)+'%',  color:prodColor(p,getGoals(facility.facility).productivity) },
                                { label:'CPM MTD',       val:'$'+Math.trunc(c*100)/100,  color:cpmColor(c,getGoals(facility.facility).cpm) },
                                { label:'Mode MTD',      val:mo.toFixed(1)+'%', color:modeColor(mo,getGoals(facility.facility).mode) },
                                { label:'UPV MTD',       val:upv.toFixed(2),    color:'text-slate-200' },
                                { label:'Eligible',      val:String(facility.medBEligible||0), color:'text-purple-300' },
                                { label:'On Caseload',   val:String(facility.medBCaseload||0), color:'text-indigo-300' },
                                { label:'Med B Units MTD', val:units.toLocaleString(), color:'text-blue-300' },
                                { label:'Revenue MTD',   val:'$'+(rev/1000).toFixed(1)+'k', color:'text-emerald-300' },
                              ].map((m,i) => (
                                <div key={i} className="bg-white/5 rounded-xl p-3">
                                  <div className="text-xs text-slate-500 mb-1">{m.label}</div>
                                  <div className={`text-lg font-black ${m.color}`}>{m.val}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ RESOURCES TAB (DOR only) ══════════════════════════════════════ */}
        {/* ══ COMPLIANCE TAB (DOR) ══════════════════════════════════════════ */}
        {activeView === 'compliance' && isRestrictedView && (() => {
          const allComp = [...(complianceData['Overland']||[]), ...(complianceData['Golden Coast']||[])];
          const myComp  = allComp.find(r => r.building === restrictedFacility);
          const status  = myComp?.status?.toLowerCase().replace(/\s/g,'') || '';
          const isGreen  = status.includes('green');
          const isRed    = status.includes('red');
          const statusLabel = isGreen ? 'Green' : isRed ? 'Red' : 'Yellow';
          const statusColor = isGreen ? 'text-emerald-300' : isRed ? 'text-rose-300' : 'text-yellow-300';
          const statusBg    = isGreen ? 'bg-emerald-500/20 border-emerald-400/30' : isRed ? 'bg-rose-500/20 border-rose-400/30' : 'bg-yellow-500/20 border-yellow-400/30';
          const statusDot   = isGreen ? 'bg-emerald-400' : isRed ? 'bg-rose-400' : 'bg-yellow-400';

          const categories = [
            { label: 'Orders & Care Plans',      icon: '📋' },
            { label: 'Therapy Diagnosis Entry',  icon: '🏷️' },
            { label: 'JMA / Post-Fall Screens',  icon: '🛡️' },
            { label: 'RNA Program',              icon: '👥' },
            { label: 'Daily Documentation',      icon: '📝' },
          ];

          return (
            <div className="space-y-6 pb-12">
              {/* Header */}
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-white">Compliance Overview</h2>
                    <p className="text-slate-400 text-sm mt-1">{restrictedFacility} · {myFacilityData?.region}</p>
                  </div>
                  {myComp && (
                    <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl border ${statusBg}`}>
                      <div className={`w-3 h-3 rounded-full ${statusDot}`} />
                      <span className={`text-lg font-black ${statusColor}`}>{statusLabel}</span>
                    </div>
                  )}
                </div>
              </div>

              {!myComp ? (
                <div className="bg-white/5 rounded-2xl p-8 text-center border border-white/10">
                  <p className="text-slate-400">No compliance data available for your building yet.</p>
                  <p className="text-slate-500 text-sm mt-2">Contact your regional manager for details.</p>
                </div>
              ) : (
                <>
                  {/* Action Items */}
                  <div className={`rounded-2xl p-6 border ${statusBg}`}>
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isGreen?'bg-emerald-500/30':isRed?'bg-rose-500/30':'bg-yellow-500/30'}`}>
                        <span className="text-xl">{isGreen?'✅':isRed?'🚨':'⚠️'}</span>
                      </div>
                      <div>
                        <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${statusColor}`}>
                          {isGreen ? 'On Track' : isRed ? 'Immediate Attention Required' : 'In Progress'}
                        </div>
                        <p className="text-white text-sm leading-relaxed">{myComp.actionItem}</p>
                      </div>
                    </div>
                  </div>

                  {/* Compliance Categories */}
                  <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
                    <div className="p-5 border-b border-white/10">
                      <h3 className="text-base font-black text-white">Compliance Categories</h3>
                      <p className="text-slate-400 text-xs mt-1">Current status across all 5 areas</p>
                    </div>
                    <div className="divide-y divide-white/5">
                      {categories.map((cat, i) => (
                        <div key={i} className="flex items-center gap-3 px-5 py-4 hover:bg-white/5 transition-all">
                          <span className="text-lg">{cat.icon}</span>
                          <span className="text-sm font-medium text-white">{cat.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* What to focus on */}
                  <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
                        <span className="text-sm">🎯</span>
                      </div>
                      <h3 className="text-base font-black text-white">This Week's Focus</h3>
                    </div>
                    <p className="text-slate-300 text-sm leading-relaxed">{myComp.actionItem}</p>
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <p className="text-slate-500 text-xs">Compliance data is updated monthly by your regional manager. Contact them with any questions.</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {activeView === 'resources' && isRestrictedView && (
          <div className="space-y-6 pb-12">
            <div className="bg-gradient-to-r from-cyan-500/10 to-teal-500/10 backdrop-blur-xl rounded-2xl p-6 border border-cyan-400/30">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Resources</h3>
                  <p className="text-slate-300 text-sm">Access therapy templates, guidelines, and documentation</p>
                </div>
              </div>
            </div>

            {resourcesLoading && <div className="text-center py-12 text-slate-400">Loading resources...</div>}
            {resourcesError  && <div className="bg-rose-500/10 border border-rose-400/30 rounded-2xl p-4 text-rose-300 text-sm">{resourcesError}</div>}

            {!resourcesLoading && !resourcesError && githubResources.map((category, ci) => (
              <div key={ci} className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl overflow-hidden">
                <div className="p-5 border-b border-white/10 bg-white/5">
                  <h4 className="text-lg font-black text-white">{category.name}</h4>
                  {category.description && <p className="text-slate-400 text-sm mt-1">{category.description}</p>}
                </div>
                <div className="p-4 space-y-3">
                  {category.files?.map((file, fi) => (
                    <div key={fi} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-red-500/20 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-red-300" />
                        </div>
                        <div>
                          <div className="text-white font-bold text-sm">{file.title || file.name}</div>
                          {file.description && <div className="text-slate-400 text-xs mt-0.5">{file.description}</div>}
                          {file.size && <div className="text-slate-500 text-xs">{file.size}</div>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {(() => { const fileUrl = file.url || `/resources/${category.id}/${file.filename}`; return (<>
                        <a href={fileUrl} target="_blank" rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/30 rounded-lg text-xs font-bold transition-all flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> View
                        </a>
                        <a href={fileUrl} download
                          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg text-xs font-bold transition-all flex items-center gap-1">
                          <Download className="w-3 h-3" /> Download
                        </a></>); })()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {!resourcesLoading && !resourcesError && githubResources.length === 0 && (
              <div className="text-center py-12 text-slate-400">No resources available yet.</div>
            )}

            <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-2xl p-4">
              <p className="text-sm text-cyan-400">
                <strong>Note for Administrators:</strong> To add or update resources, upload files to the GitHub repository
                in the <code className="bg-gray-800 px-2 py-1 rounded">public/resources</code> folder and update
                the <code className="bg-gray-800 px-2 py-1 rounded">resources-config.json</code> file.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
