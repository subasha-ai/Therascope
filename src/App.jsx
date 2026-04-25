import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp, Search, Download, CheckCircle, BarChart3, Users, Zap, PieChart, Building2, ChevronDown, ChevronUp, MapPin, Star, TrendingDown, FileText, ExternalLink, DollarSign, ArrowLeft } from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import facilityDataJson from './facility_data.json';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const ADMIN_PASSWORD      = 'WalkTalkWin';
const MASTER_DOR_PASSWORD = 'StrongSteps';
const WEEKLY_REPORT_LINK  = 'https://forms.office.com/Pages/ResponsePage.aspx?id=GnwJbN56CESxFanmFuyVBuSsEiTDUNlHs0MWhL_En4tURFpRU0xLOTNUVllEQUZBQVJUUkVMMEVYTC4u';

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

const EXEC_MONTHS = [
  { label: 'Jan',     start: '2026-01-01', end: '2026-01-31' },
  { label: 'Feb',     start: '2026-02-01', end: '2026-02-28' },
  { label: 'Mar MTD', start: '2026-03-01', end: '2026-03-29' },
];

// ─── PURE HELPERS (no hooks) ──────────────────────────────────────────────────
// Always show MTD value, fall back to week value
const mtd = (rec, mtdKey, wkKey) => parseFloat(rec?.[mtdKey] || rec?.[wkKey] || 0);

// Score a record 0-4 across all 4 goals
const scoreRec = (rec) => {
  if (!rec) return 0;
  let s = 0;
  if (mtd(rec, 'productivityMTD',    'productivity')    >= 84)  s++;
  if (mtd(rec, 'cpmMTD',             'cpm')             <= 1.45) s++;
  const elig = rec.medBEligible || 0, cas = rec.medBCaseload || 0;
  if (elig > 0 && cas / elig >= 0.5) s++;
  if (mtd(rec, 'modeOfTreatmentMTD', 'modeOfTreatment') >= 4)   s++;
  return s;
};

const prodColor  = v => v >= 84   ? 'text-emerald-300' : 'text-rose-300';
const cpmColor   = v => v <= 1.45 ? 'text-emerald-300' : 'text-rose-300';
const modeColor  = v => v >= 4    ? 'text-emerald-300' : 'text-amber-300';
const prodBg     = v => v >= 84   ? 'bg-emerald-500/20 border-emerald-400/50' : 'bg-rose-500/20 border-rose-400/50';
const cpmBg      = v => v <= 1.45 ? 'bg-emerald-500/20 border-emerald-400/50' : 'bg-rose-500/20 border-rose-400/50';
const shortName  = n => n.replace(' Post Acute','').replace(' Healthcare Center','');
const scoreBadge = s => s >= 3 ? 'bg-emerald-500/20 text-emerald-300' : s === 2 ? 'bg-yellow-500/20 text-yellow-300' : 'bg-rose-500/20 text-rose-300';

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function App() {
  const allWeeklyData = facilityDataJson;

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
    const recs = allWeeklyData.filter(d => d.facility === restrictedFacility && d.date.startsWith('2026-02'));
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
      atGoalProd: recs.filter(r => mtd(r,'productivityMTD','productivity') >= 84).length,
      atGoalCPM:  recs.filter(r => mtd(r,'cpmMTD','cpm') <= 1.45).length,
      n: recs.length,
    };
  };

  // Filtered facilities for admin view
  const filteredFacilities = viewableData.filter(f => {
    const matchSearch = !searchTerm || f.facility.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRegion = selectedRegion === 'all' || f.region === selectedRegion;
    const p = mtd(f,'productivityMTD','productivity');
    const c = mtd(f,'cpmMTD','cpm');
    const matchProd = filterProductivity === 'all' || (filterProductivity === 'meeting' ? p >= 84 : p < 84);
    const matchCPM  = filterCPM === 'all'          || (filterCPM === 'meeting'          ? c <= 1.45 : c > 1.45);
    return matchSearch && matchRegion && matchProd && matchCPM;
  });

  // Computed display values
  const latestDateStr = allWeeklyData.reduce((max,d) => d.date > max ? d.date : max, '');
  const throughDate = (() => {
    const d = new Date(latestDateStr);
    d.setDate(d.getDate() + 6);
    return d.toISOString().split('T')[0];
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
    const d = new Date(throughDate);
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const dayOfMonth  = d.getDate();
    const pct = dayOfMonth / daysInMonth;
    if (pct <= 0) return null;
    const p   = mtd(myFacilityData,'productivityMTD','productivity');
    const c   = mtd(myFacilityData,'cpmMTD','cpm');
    const mo  = mtd(myFacilityData,'modeOfTreatmentMTD','modeOfTreatment');
    const upv = mtd(myFacilityData,'unitsPerVisitMTD','unitsPerVisit');
    return {
      productivity:    +(p).toFixed(1),
      cpm:             +(c).toFixed(2),
      modeOfTreatment: +(mo).toFixed(1),
      unitsPerVisit:   +(upv).toFixed(2),
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
      cpm: { current: c.toFixed(2), target: 1.45, trend: myPrevWeekData ? (c - mtd(myPrevWeekData,'cpmMTD','cpm')).toFixed(2)+' vs last week' : 'n/a' },
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
          ['CPM',           '$'+c.toFixed(2),   '< $1.45',      c <= 1.45 ? '✓' : '✗'],
          ['Mode of Tx',    mo.toFixed(1)+'%',  '>= 4%',        mo >= 4 ? '✓' : '✗'],
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
      doc.text('January - March 2026', pageW/2, 75, { align:'center' });
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
        head: [['Facility','Rgn','Jan Prod','Jan CPM','Jan Mode','Jan Rev','Feb Prod','Feb CPM','Feb Mode','Feb Rev','Mar Prod','Mar CPM','Mar Mode','Mar Rev']],
        body: allFacilities.map(fac => {
          const region = allWeeklyData.find(d => d.facility === fac)?.region || '';
          const row = [shortName(fac), region === 'Golden Coast' ? 'GC' : 'OL'];
          EXEC_MONTHS.forEach(m => {
            const rec = getMonthFinal(fac, m.start, m.end);
            if (!rec) { row.push('—','—','—','—'); return; }
            row.push(
              mtd(rec,'productivityMTD','productivity').toFixed(1)+'%',
              '$'+mtd(rec,'cpmMTD','cpm').toFixed(2),
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
      doc.text('Most Improved (Jan to Mar, composite goals)', 14, 35);
      doc.autoTable({
        startY: 40,
        head: [['Facility','Jan Goals','Mar Goals','Prod Change']],
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
        head: [['Facility','Region','Jan Score','Feb Score','Mar Score']],
        body: struggling.map(fac => {
          const region = allWeeklyData.find(d => d.facility === fac)?.region || '';
          const scores = EXEC_MONTHS.map(m => scoreRec(getMonthFinal(fac, m.start, m.end))+'/4');
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

  // ─── LOGIN SCREEN ────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="fixed inset-0 opacity-20">
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
                      <div className="text-white font-bold">Leadership / Admin</div>
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
    ...(!isRestrictedView ? [{ id:'overview',  label:'Overview',        icon: Activity  }] : []),
    ...(!isRestrictedView ? [{ id:'exec',       label:'Executive',       icon: Star      }] : []),
    {                        id:'facilities',   label: isRestrictedView ? 'My Facility' : 'All Facilities', icon: Building2 },
    ...(isRestrictedView  ? [{ id:'resources',  label:'Resources',       icon: FileText  }] : []),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="fixed inset-0 opacity-20">
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
              <a href={WEEKLY_REPORT_LINK} target="_blank" rel="noopener noreferrer"
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-xl hover:from-cyan-600 hover:to-teal-600 transition-all shadow-lg font-semibold text-sm flex items-center gap-2">
                <ExternalLink className="w-4 h-4" /> Submit Weekly Report
              </a>
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
                        { label:'At Prod Goal',      val: data.filter(f=>mtd(f,'productivityMTD','productivity')>=84).length+'/'+data.length, color:'text-slate-300' },
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
              const offProd = currentWeekData.filter(f => mtd(f,'productivityMTD','productivity') < 84);
              const offCPM  = currentWeekData.filter(f => mtd(f,'cpmMTD','cpm') > 1.45);
              const offMode = currentWeekData.filter(f => mtd(f,'modeOfTreatmentMTD','modeOfTreatment') < 4);
              const offMedB = currentWeekData.filter(f => f.medBEligible > 0 && (f.medBCaseload/f.medBEligible) < 0.5);
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
                      { label:'CPM > $1.45',         items:offCPM,  val: f => '$'+mtd(f,'cpmMTD','cpm').toFixed(2) },
                      { label:'Mode of Tx < 4%',     items:offMode, val: f => mtd(f,'modeOfTreatmentMTD','modeOfTreatment').toFixed(1)+'%' },
                      { label:'Med B < 50% on CL',   items:offMedB, val: f => f.medBEligible>0 ? Math.round((f.medBCaseload/f.medBEligible)*100)+'%' : 'N/A' },
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

            {/* Feb vs March Comparison */}
            {(() => {
              const febFinals = {}, marchLatest = {};
              allWeeklyData.filter(d => d.date.startsWith('2026-02')).forEach(d => { if (!febFinals[d.facility] || d.week > febFinals[d.facility].week) febFinals[d.facility] = d; });
              allWeeklyData.filter(d => d.date.startsWith('2026-03')).forEach(d => { if (!marchLatest[d.facility] || d.week > marchLatest[d.facility].week) marchLatest[d.facility] = d; });
              const facs = Object.keys(febFinals).filter(f => marchLatest[f]).sort();
              if (!facs.length) return null;
              const COLS = [
                { key:'prod', label:'Prod %', f:r=>mtd(r,'productivityMTD','productivity'),    fmt:v=>v.toFixed(1)+'%', better:'higher' },
                { key:'cpm',  label:'CPM',    f:r=>mtd(r,'cpmMTD','cpm'),                     fmt:v=>'$'+v.toFixed(2), better:'lower'  },
                { key:'mode', label:'Mode %', f:r=>mtd(r,'modeOfTreatmentMTD','modeOfTreatment'), fmt:v=>v.toFixed(1)+'%', better:'higher' },
                { key:'upv',  label:'UPV',    f:r=>mtd(r,'unitsPerVisitMTD','unitsPerVisit'),  fmt:v=>v.toFixed(2),     better:'higher' },
              ];
              return (
                <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl overflow-hidden">
                  <div className="p-5 border-b border-white/10 bg-gradient-to-r from-indigo-900/30 to-purple-900/30 flex items-center gap-3">
                    <span className="text-2xl">📊</span>
                    <div>
                      <h3 className="text-lg font-black text-white">February Final vs March MTD</h3>
                      <p className="text-slate-400 text-sm">All facilities — MTD values compared</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/5">
                          <th className="text-left py-3 px-4 text-slate-400 font-bold text-xs uppercase">Facility</th>
                          <th className="text-center py-2 px-2 text-slate-400 font-bold text-xs uppercase">Rgn</th>
                          {COLS.map(c => <th key={c.key} className="text-center py-3 px-3 text-slate-400 font-bold text-xs uppercase">{c.label}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {facs.map((fac,i) => {
                          const feb = febFinals[fac], mar = marchLatest[fac];
                          return (
                            <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                              <td className="py-2 px-4 text-white font-bold text-xs">{fac}</td>
                              <td className="py-2 px-2 text-center">
                                <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${mar.region==='Golden Coast'?'bg-amber-500/20 text-amber-300':'bg-blue-500/20 text-blue-300'}`}>
                                  {mar.region==='Golden Coast'?'GC':'OL'}
                                </span>
                              </td>
                              {COLS.map(col => {
                                const fv = col.f(feb), mv = col.f(mar), diff = mv - fv;
                                const improved = col.better==='higher' ? diff > 0.05 : diff < -0.05;
                                const declined = col.better==='higher' ? diff < -0.05 : diff > 0.05;
                                const sign = diff > 0 ? '+' : '';
                                const diffStr = col.key==='cpm' ? sign+'$'+Math.abs(diff).toFixed(2) : sign+diff.toFixed(col.key==='upv'?2:1);
                                return (
                                  <td key={col.key} className="py-2 px-3 text-center">
                                    <div className="text-white text-xs font-bold">{col.fmt(mv)}</div>
                                    <div className={`text-xs font-bold mt-0.5 ${improved?'text-emerald-400':declined?'text-rose-400':'text-slate-500'}`}>
                                      {improved?'↑':declined?'↓':'→'} {diffStr}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
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

          const struggling = facilityRows.filter(r => r.months.filter(Boolean).map(scoreRec).filter(s=>s<=1).length >= 2);
          const improved = facilityRows.map(r => {
            const jan=r.months[0], mar=r.months[2];
            if (!jan || !mar) return null;
            const scoreDiff = scoreRec(mar)-scoreRec(jan);
            const prodDiff  = mtd(mar,'productivityMTD','productivity')-mtd(jan,'productivityMTD','productivity');
            return { ...r, scoreDiff, prodDiff, janScore:scoreRec(jan), marScore:scoreRec(mar) };
          }).filter(Boolean).sort((a,b)=>b.scoreDiff!==a.scoreDiff?b.scoreDiff-a.scoreDiff:b.prodDiff-a.prodDiff).slice(0,3);

          return (
            <div className="space-y-8 pb-12">
              {/* Header */}
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h2 className="text-3xl font-black text-white">Executive Summary</h2>
                    <p className="text-slate-400 mt-1">January – March 2026 · {facilityRows.length} Facilities · 2 Regions</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <button onClick={generateExecPDF}
                      className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-xl hover:from-cyan-600 hover:to-teal-600 transition-all shadow-lg font-semibold text-sm flex items-center gap-2">
                      <Download className="w-4 h-4" /> Export PDF
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

              {/* 3-Month Company Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {monthTotals.map((m,mi) => m.totals && (
                  <div key={mi} className={`bg-white/5 backdrop-blur-xl rounded-2xl p-6 border shadow-xl ${mi===2?'border-cyan-400/40':'border-white/10'}`}>
                    <div className="flex items-center justify-between mb-5">
                      <h3 className={`text-2xl font-black ${mi===2?'text-cyan-300':'text-white'}`}>{m.label}</h3>
                      {mi===2 && <span className="text-xs bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 px-3 py-1 rounded-full font-bold">Latest</span>}
                    </div>
                    <div className="space-y-3">
                      {[
                        { label:'Avg Productivity', val:m.totals.avgProd+'%',                               good:parseFloat(m.totals.avgProd)>=84 },
                        { label:'Avg CPM',           val:'$'+m.totals.avgCPM,                               good:parseFloat(m.totals.avgCPM)<=1.45 },
                        { label:'Med B Units',       val:m.totals.totalUnits.toLocaleString(),              good:null },
                        { label:'Med B Revenue',     val:'$'+(m.totals.totalRev/1000).toFixed(0)+'k',      good:null },
                        { label:'At Prod Goal',      val:m.totals.atGoalProd+' / '+m.totals.n+' bldgs',    good:m.totals.atGoalProd>=m.totals.n*0.7 },
                        { label:'At CPM Goal',       val:m.totals.atGoalCPM+' / '+m.totals.n+' bldgs',    good:m.totals.atGoalCPM>=m.totals.n*0.7 },
                      ].map((row,ri) => (
                        <div key={ri} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                          <span className="text-slate-400 text-sm">{row.label}</span>
                          <span className={`font-black text-base ${row.good===null?'text-white':row.good?'text-emerald-300':'text-rose-300'}`}>{row.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Building Scorecard */}
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl overflow-hidden">
                <div className="p-5 border-b border-white/10 bg-white/5">
                  <h3 className="text-lg font-black text-white">Building Scorecard — 3 Month View</h3>
                  <p className="text-slate-400 text-sm mt-1">Productivity · CPM · Mode % · Med B Revenue · Green = at goal</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5">
                        <th className="text-left py-3 px-4 text-slate-400 font-bold uppercase text-xs sticky left-0 bg-slate-900/90">Facility</th>
                        <th className="py-3 px-2 text-slate-400 font-bold uppercase text-xs text-center">Rgn</th>
                        {EXEC_MONTHS.map(m => <th key={m.label} colSpan={4} className="py-3 px-2 text-slate-300 font-bold uppercase text-xs text-center border-l border-white/10">{m.label}</th>)}
                      </tr>
                      <tr className="border-b border-white/10">
                        <th className="sticky left-0 bg-slate-900/90 py-1"></th><th></th>
                        {EXEC_MONTHS.map(m => ['Prod','CPM','Mode','Rev'].map(col => <th key={m.label+col} className="py-2 px-2 text-slate-500 font-bold text-xs text-center">{col}</th>))}
                      </tr>
                    </thead>
                    <tbody>
                      {facilityRows.map((row,ri) => {
                        const isNewRegion = ri===0 || row.region !== facilityRows[ri-1].region;
                        return (
                          <React.Fragment key={ri}>
                            {isNewRegion && <tr className="bg-white/5"><td colSpan={14} className="py-2 px-4 text-xs font-black uppercase tracking-widest text-slate-400">{row.region}</td></tr>}
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
                                    {cell(p, p!==null?p>=84:null, v=>v.toFixed(1)+'%')}
                                    {cell(c, c!==null?c<=1.45:null, v=>'$'+v.toFixed(2))}
                                    {cell(mo,mo!==null?mo>=4:null, v=>v.toFixed(1)+'%')}
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
                  <div className="flex items-center gap-3 mb-5"><span className="text-2xl">📈</span><h3 className="text-lg font-black text-white">Most Improved (Jan → Mar)</h3></div>
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
                            <span>Prod: {janProd.toFixed(1)}% → <span className={marProd>=84?'text-emerald-300 font-bold':'text-rose-300 font-bold'}>{marProd.toFixed(1)}%</span></span>
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
                              const s = scoreRec(rec);
                              return <div key={mi} className={`text-xs px-2 py-1 rounded-lg font-bold ${s>=3?'bg-emerald-500/20 text-emerald-300':s===2?'bg-yellow-500/20 text-yellow-300':'bg-rose-500/20 text-rose-300'}`}>{EXEC_MONTHS[mi].label}: {s}/4</div>;
                            })}
                          </div>
                        </div>
                      ))}</div>
                  }
                </div>
              </div>
            </div>
          );
        })()}

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
                            <span className="text-slate-400 text-sm">Week ending {throughDate}</span>
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
                      return (
                        <>
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                            {[
                              { label:'Productivity', val:p.toFixed(1)+'%',  good:p>=84,      sub:p>=84?'✓ Meeting goal':'Below 84% goal', icon:TrendingUp, bg:prodBg(p), spark:dorSparkData?.productivity, proj:monthEndProjection?.productivity, projGood: monthEndProjection?.productivity>=84, projFmt: v=>v.toFixed(1)+'%' },
                              { label:'CPM',          val:'$'+c.toFixed(2),  good:c<=1.45,    sub:c<=1.45?'✓ Under $1.45':'Above $1.45 target', icon:PieChart, bg:cpmBg(c), spark:dorSparkData?.cpm, proj:monthEndProjection?.cpm, projGood: monthEndProjection?.cpm<=1.45, projFmt: v=>'$'+v.toFixed(2) },
                              { label:'Med B on CL',  val:casePct+'%',       good:casePct>=50,sub:cas+' of '+elig+' eligible', icon:Users, bg:casePct>=50?'bg-emerald-500/20 border-emerald-400/50':'bg-rose-500/20 border-rose-400/50', spark:null, proj:null },
                              { label:'Mode of Tx',   val:mo.toFixed(1)+'%', good:mo>=4,      sub:mo>=4?'✓ Meeting 4% goal':'Below 4% goal', icon:Activity, bg:mo>=4?'bg-emerald-500/20 border-emerald-400/50':'bg-rose-500/20 border-rose-400/50', spark:dorSparkData?.modeOfTreatment, proj:monthEndProjection?.modeOfTreatment, projGood: monthEndProjection?.modeOfTreatment>=4, projFmt: v=>v.toFixed(1)+'%' },
                            ].map((card,i) => (
                              <div key={i} className={`rounded-xl p-5 border-2 ${card.bg}`}>
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <card.icon className={`w-4 h-4 ${card.good?'text-emerald-400':'text-rose-400'}`} strokeWidth={2.5} />
                                    <span className="text-xs text-slate-300 font-bold uppercase">{card.label}</span>
                                  </div>
                                  {card.spark && card.spark.length >= 2 && (
                                    <svg width="80" height="28" viewBox="0 0 80 28">
                                      <path d={sparkPath(card.spark)} fill="none" stroke={card.good?'#34d399':'#f87171'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"/>
                                      <circle cx={(80/(card.spark.length-1))*(card.spark.length-1)} cy={28-((card.spark[card.spark.length-1]-Math.min(...card.spark))/(Math.max(...card.spark)-Math.min(...card.spark)||1))*28} r="3" fill={card.good?'#34d399':'#f87171'}/>
                                    </svg>
                                  )}
                                </div>
                                <div className={`text-3xl font-black ${card.good?'text-emerald-300':'text-rose-300'}`}>{card.val}</div>
                                <div className="text-xs text-slate-400 mt-2">{card.sub}</div>
                                {card.proj != null && monthEndProjection && (
                                  <div className={`mt-2 text-xs font-semibold px-2 py-1 rounded-lg inline-block ${card.projGood?'bg-emerald-500/20 text-emerald-300':'bg-amber-500/20 text-amber-300'}`}>
                                    Proj: {card.projFmt(card.proj)} · day {monthEndProjection.daysIn}/{monthEndProjection.daysTotal}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {[
                              { label:'Units / Visit',   val:upv.toFixed(2),                  color:'text-indigo-300',  bg:'bg-indigo-500/10 border-indigo-400/20',  icon:BarChart3, spark:dorSparkData?.unitsPerVisit, good:upv>=3 },
                              { label:'Med B Eligible',  val:String(elig),                     color:'text-purple-300',  bg:'bg-purple-500/10 border-purple-400/20',  icon:Users     },
                              { label:'Med B Units MTD', val:units.toLocaleString(),            color:'text-blue-300',    bg:'bg-blue-500/10 border-blue-400/20',      icon:BarChart3 },
                              { label:'Medicare Rev MTD',val:'$'+(rev/1000).toFixed(1)+'k',    color:'text-emerald-300', bg:'bg-emerald-500/10 border-emerald-400/20', icon:DollarSign},
                            ].map((card,i) => (
                              <div key={i} className={`border rounded-xl p-5 ${card.bg}`}>
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <card.icon className={`w-4 h-4 ${card.color}`} strokeWidth={2.5} />
                                    <span className="text-xs text-slate-300 font-bold uppercase">{card.label}</span>
                                  </div>
                                  {card.spark && card.spark.length >= 2 && (
                                    <svg width="80" height="28" viewBox="0 0 80 28">
                                      <path d={sparkPath(card.spark)} fill="none" stroke={card.good?'#818cf8':'#f87171'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"/>
                                      <circle cx="80" cy={28-((card.spark[card.spark.length-1]-Math.min(...card.spark))/(Math.max(...card.spark)-Math.min(...card.spark)||1))*28} r="3" fill={card.good?'#818cf8':'#f87171'}/>
                                    </svg>
                                  )}
                                </div>
                                <div className={`text-3xl font-black ${card.color}`}>{card.val}</div>
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
                {myFebFinal && myFacilityData.date.startsWith('2026-03') && (
                  <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl p-6">
                    <h3 className="text-lg font-black text-white mb-5">📊 February Final vs {currentMonthName} MTD</h3>
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
                                <div className="text-xs text-slate-500 mb-1">Feb Final</div>
                                <div className="text-lg font-black text-white">{m.fmt(m.feb)}</div>
                              </div>
                              <div className={`text-xl font-black px-2 ${improved?'text-emerald-400':declined?'text-rose-400':'text-slate-500'}`}>{improved?'↑':declined?'↓':'→'}</div>
                              <div className="text-right">
                                <div className="text-xs text-slate-500 mb-1">Mar MTD</div>
                                <div className={`text-lg font-black ${improved?'text-emerald-300':declined?'text-rose-300':'text-white'}`}>{m.fmt(m.mar)}</div>
                              </div>
                            </div>
                            <div className={`text-xs font-bold mt-2 pt-2 border-t border-white/10 ${improved?'text-emerald-400':declined?'text-rose-400':'text-slate-500'}`}>
                              {diffStr} vs Feb
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

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
                              if(k==='score') return scoreRec(r);
                              return r[k]||0;
                            };
                            const va=getV(a,dorLeaderboardSort), vb=getV(b,dorLeaderboardSort);
                            return dorLeaderboardDir==='asc' ? va-vb : vb-va;
                          }).map((f,i) => {
                            const isMe = f.facility === restrictedFacility;
                            const p  = mtd(f,'productivityMTD','productivity');
                            const c  = mtd(f,'cpmMTD','cpm');
                            const mo = mtd(f,'modeOfTreatmentMTD','modeOfTreatment');
                            const sc = scoreRec(f);
                            return (
                              <tr key={i} className={`border-b border-white/5 ${isMe?'bg-cyan-500/10 border-cyan-400/20':'hover:bg-white/5'}`}>
                                <td className="py-3 px-4 text-sm font-bold text-white">{f.facility}{isMe&&<span className="ml-2 text-xs text-cyan-400 font-black">(You)</span>}</td>
                                <td className={`py-3 px-4 text-sm font-black ${prodColor(p)}`}>{p.toFixed(1)}%</td>
                                <td className={`py-3 px-4 text-sm font-black ${cpmColor(c)}`}>${c.toFixed(2)}</td>
                                <td className={`py-3 px-4 text-sm font-black ${modeColor(mo)}`}>{mo.toFixed(1)}%</td>
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

                {/* Historical Table */}
                <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-xl overflow-hidden">
                  <div className="p-5 border-b border-white/10 flex items-center justify-between">
                    <h3 className="text-lg font-black text-white">Historical Performance</h3>
                    <div className="flex gap-2">
                      {['weekly','monthly'].map(v => (
                        <button key={v} onClick={()=>setHistoricalView(v)}
                          className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${historicalView===v?'bg-cyan-500 text-white':'bg-white/10 text-slate-400 hover:text-white'}`}>
                          {v.charAt(0).toUpperCase()+v.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/5">
                          {(historicalView==='weekly'
                            ? ['Week','Date','Prod %','CPM','Mode %','UPV','Med B Units','Revenue']
                            : ['Month','Prod %','CPM','Mode %','UPV','Med B Units','Revenue']
                          ).map(h => <th key={h} className="py-2 px-4 text-left text-xs font-bold text-slate-400 uppercase">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {historicalView==='weekly'
                          ? getFacilityHistory(restrictedFacility).slice(-12).reverse().map((r,i) => (
                              <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                                <td className="py-2 px-4 text-white font-bold text-xs">{r.week}</td>
                                <td className="py-2 px-4 text-slate-300 text-xs">{r.date}</td>
                                <td className={`py-2 px-4 font-black text-xs ${prodColor(r.productivity||0)}`}>{(r.productivity||0).toFixed(1)}%</td>
                                <td className={`py-2 px-4 font-black text-xs ${cpmColor(r.cpm||0)}`}>${(r.cpm||0).toFixed(2)}</td>
                                <td className={`py-2 px-4 font-black text-xs ${modeColor(r.modeOfTreatment||0)}`}>{(r.modeOfTreatment||0).toFixed(1)}%</td>
                                <td className="py-2 px-4 text-slate-300 text-xs">{(r.unitsPerVisit||0).toFixed(2)}</td>
                                <td className="py-2 px-4 text-blue-300 font-bold text-xs">{r.medBUnitsThisWeek||0}</td>
                                <td className="py-2 px-4 text-emerald-300 font-bold text-xs">${((r.medicareMPPRRevenue||0)/1000).toFixed(1)}k</td>
                              </tr>
                            ))
                          : getMonthlyData(restrictedFacility).slice().reverse().map((r,i) => (
                              <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                                <td className="py-2 px-4 text-white font-bold text-xs">{r.month}</td>
                                <td className={`py-2 px-4 font-black text-xs ${prodColor(r.productivity)}`}>{r.productivity.toFixed(1)}%</td>
                                <td className={`py-2 px-4 font-black text-xs ${cpmColor(r.cpm)}`}>${r.cpm.toFixed(2)}</td>
                                <td className={`py-2 px-4 font-black text-xs ${modeColor(r.modeOfTreatment)}`}>{r.modeOfTreatment.toFixed(1)}%</td>
                                <td className="py-2 px-4 text-slate-300 text-xs">{r.unitsPerVisit.toFixed(2)}</td>
                                <td className="py-2 px-4 text-blue-300 font-bold text-xs">{r.medBUnitsThisWeek.toLocaleString()}</td>
                                <td className="py-2 px-4 text-emerald-300 font-bold text-xs">${(r.medicareMPPRRevenue/1000).toFixed(1)}k</td>
                              </tr>
                            ))
                        }
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
                    const sc  = scoreRec(facility);
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
                                  { label:'Prod', value:p.toFixed(1)+'%', color:prodColor(p) },
                                  { label:'CPM',  value:'$'+c.toFixed(2), color:cpmColor(c)  },
                                  { label:'Mode', value:mo.toFixed(1)+'%',color:modeColor(mo)},
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
                                { label:'Prod MTD',      val:p.toFixed(1)+'%',  color:prodColor(p) },
                                { label:'CPM MTD',       val:'$'+c.toFixed(2),  color:cpmColor(c) },
                                { label:'Mode MTD',      val:mo.toFixed(1)+'%', color:modeColor(mo) },
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
                            <div className="flex gap-2 mb-3">
                              {['weekly','monthly'].map(v => (
                                <button key={v} onClick={()=>setHistoricalView(v)}
                                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${historicalView===v?'bg-cyan-500 text-white':'bg-white/10 text-slate-400 hover:text-white'}`}>
                                  {v.charAt(0).toUpperCase()+v.slice(1)}
                                </button>
                              ))}
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-white/10">
                                    {(historicalView==='weekly'
                                      ? ['Week','Date','Prod%','CPM','Mode%','UPV','Med B Units','Rev MTD']
                                      : ['Month','Prod%','CPM','Mode%','UPV','Med B Units','Revenue']
                                    ).map(h => <th key={h} className="py-2 px-3 text-left text-xs font-bold text-slate-500 uppercase">{h}</th>)}
                                  </tr>
                                </thead>
                                <tbody>
                                  {historicalView==='weekly'
                                    ? history.slice(-8).reverse().map((r,i) => (
                                        <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                                          <td className="py-1.5 px-3 text-white font-bold">{r.week}</td>
                                          <td className="py-1.5 px-3 text-slate-400">{r.date}</td>
                                          <td className={`py-1.5 px-3 font-black ${prodColor(r.productivity||0)}`}>{(r.productivity||0).toFixed(1)}%</td>
                                          <td className={`py-1.5 px-3 font-black ${cpmColor(r.cpm||0)}`}>${(r.cpm||0).toFixed(2)}</td>
                                          <td className={`py-1.5 px-3 font-black ${modeColor(r.modeOfTreatment||0)}`}>{(r.modeOfTreatment||0).toFixed(1)}%</td>
                                          <td className="py-1.5 px-3 text-slate-300">{(r.unitsPerVisit||0).toFixed(2)}</td>
                                          <td className="py-1.5 px-3 text-blue-300 font-bold">{r.medBUnitsThisWeek||0}</td>
                                          <td className="py-1.5 px-3 text-emerald-300 font-bold">${((r.medicareMPPRRevenueMTD||r.medicareMPPRRevenue||0)/1000).toFixed(1)}k</td>
                                        </tr>
                                      ))
                                    : getMonthlyData(facility.facility).slice().reverse().map((r,i) => (
                                        <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                                          <td className="py-1.5 px-3 text-white font-bold">{r.month}</td>
                                          <td className={`py-1.5 px-3 font-black ${prodColor(r.productivity)}`}>{r.productivity.toFixed(1)}%</td>
                                          <td className={`py-1.5 px-3 font-black ${cpmColor(r.cpm)}`}>${r.cpm.toFixed(2)}</td>
                                          <td className={`py-1.5 px-3 font-black ${modeColor(r.modeOfTreatment)}`}>{r.modeOfTreatment.toFixed(1)}%</td>
                                          <td className="py-1.5 px-3 text-slate-300">{r.unitsPerVisit.toFixed(2)}</td>
                                          <td className="py-1.5 px-3 text-blue-300 font-bold">{r.medBUnitsThisWeek.toLocaleString()}</td>
                                          <td className="py-1.5 px-3 text-emerald-300 font-bold">${(r.medicareMPPRRevenue/1000).toFixed(1)}k</td>
                                        </tr>
                                      ))
                                  }
                                </tbody>
                              </table>
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
                          <div className="text-white font-bold text-sm">{file.title}</div>
                          {file.description && <div className="text-slate-400 text-xs mt-0.5">{file.description}</div>}
                          {file.size && <div className="text-slate-500 text-xs">{file.size}</div>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <a href={file.url} target="_blank" rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/30 rounded-lg text-xs font-bold transition-all flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> View
                        </a>
                        <a href={file.url} download
                          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-lg text-xs font-bold transition-all flex items-center gap-1">
                          <Download className="w-3 h-3" /> Download
                        </a>
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
