import React, { useState, useEffect } from 'react';
import { Upload, FileText, ExternalLink, Activity, TrendingUp, Calendar, Search, Eye, Download, CheckCircle, BarChart3, Users, Clock, Zap, PieChart, Building2, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import facilityDataJson from './facility_data.json';

export default function App() {
  // Load real data from your CSV export
  const [allWeeklyData, setAllWeeklyData] = useState(facilityDataJson);

  const [documents, setDocuments] = useState([
    { id: 1, name: 'Therapy Guidelines 2024.pdf', category: 'Guidelines', uploadDate: '2024-12-15', size: '2.4 MB' },
    { id: 2, name: 'Progress Note Template.docx', category: 'Templates', uploadDate: '2024-12-10', size: '156 KB' },
    { id: 3, name: 'Medicare B Requirements.pdf', category: 'Compliance', uploadDate: '2024-12-01', size: '1.8 MB' }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeView, setActiveView] = useState('overview');
  const [selectedWeek, setSelectedWeek] = useState('latest');
  const [expandedFacility, setExpandedFacility] = useState(null);
  const [filterProductivity, setFilterProductivity] = useState('all');
  const [filterCPM, setFilterCPM] = useState('all');

  // Microsoft Forms link
  const WEEKLY_REPORT_LINK = 'https://forms.office.com/Pages/ResponsePage.aspx?id=GnwJbN56CESxFanmFuyVBuSsEiTDUNlHs0MWhL_En4tURFpRU0xLOTNUVllEQUZBQVJUUkVMMEVYTC4u';

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const newDoc = {
        id: documents.length + 1,
        name: file.name,
        category: 'Uncategorized',
        uploadDate: new Date().toISOString().split('T')[0],
        size: `${(file.size / 1024).toFixed(0)} KB`
      };
      setDocuments([newDoc, ...documents]);
    }
  };

  // Get unique weeks for the dropdown
  const availableWeeks = ['latest', ...Array.from(new Set(allWeeklyData.map(d => d.week))).sort((a, b) => b - a)];

  // Get current week data based on selection
  const getCurrentWeekData = () => {
    if (selectedWeek === 'latest') {
      const latestWeek = Math.max(...allWeeklyData.map(d => parseInt(d.week)));
      return allWeeklyData.filter(d => parseInt(d.week) === latestWeek);
    }
    return allWeeklyData.filter(d => d.week === selectedWeek);
  };

  // Get historical data for a facility
  const getFacilityHistory = (facilityName) => {
    return allWeeklyData
      .filter(d => d.facility === facilityName)
      .sort((a, b) => parseInt(b.week) - parseInt(a.week));
  };

  const currentWeekData = getCurrentWeekData();

  // Apply filters
  const filteredFacilities = currentWeekData.filter(facility => {
    const matchesSearch = facility.facility.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProductivity = 
      filterProductivity === 'all' ||
      (filterProductivity === 'high' && facility.productivity >= 84) ||
      (filterProductivity === 'low' && facility.productivity < 84);
    const matchesCPM = 
      filterCPM === 'all' ||
      (filterCPM === 'good' && facility.cpm < 1.45) ||
      (filterCPM === 'high' && facility.cpm >= 1.45);
    
    return matchesSearch && matchesProductivity && matchesCPM;
  });

  const categories = ['all', ...new Set(documents.map(doc => doc.category))];

  const filteredDocs = documents.filter(doc => 
    (selectedCategory === 'all' || doc.category === selectedCategory) &&
    doc.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getProductivityColor = (productivity) => {
    if (productivity >= 90) return 'text-emerald-400';
    if (productivity >= 84) return 'text-teal-400';
    if (productivity >= 75) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getCPMColor = (cpm) => {
    if (cpm < 1.45) return 'text-emerald-400';
    return 'text-rose-400';
  };

  const getProductivityBg = (productivity) => {
    if (productivity >= 90) return 'from-emerald-500/20 to-teal-500/20 border-emerald-400/30';
    if (productivity >= 84) return 'from-teal-500/20 to-cyan-500/20 border-teal-400/30';
    if (productivity >= 75) return 'from-amber-500/20 to-orange-500/20 border-amber-400/30';
    return 'from-rose-500/20 to-red-500/20 border-rose-400/30';
  };

  const metrics = [
    { 
      label: 'Total Facilities', 
      value: new Set(allWeeklyData.map(d => d.facility)).size,
      icon: Building2, 
      change: 'Active reporting',
      gradient: 'from-cyan-500 via-teal-500 to-emerald-500',
      bgGradient: 'from-cyan-50 to-teal-50'
    },
    { 
      label: 'Avg Productivity', 
      value: `${Math.round(currentWeekData.reduce((sum, f) => sum + f.productivity, 0) / currentWeekData.length)}%`,
      icon: TrendingUp, 
      change: selectedWeek === 'latest' ? 'This week' : `Week ${selectedWeek}`,
      gradient: 'from-emerald-500 via-green-500 to-lime-500',
      bgGradient: 'from-emerald-50 to-green-50'
    },
    { 
      label: 'Avg CPM', 
      value: `$${(currentWeekData.reduce((sum, f) => sum + f.cpm, 0) / currentWeekData.length).toFixed(2)}`,
      icon: PieChart, 
      change: selectedWeek === 'latest' ? 'This week' : `Week ${selectedWeek}`,
      gradient: 'from-violet-500 via-purple-500 to-fuchsia-500',
      bgGradient: 'from-violet-50 to-purple-50'
    },
    { 
      label: 'Total Med B', 
      value: currentWeekData.reduce((sum, f) => sum + f.medBEligible, 0),
      icon: BarChart3, 
      change: `${currentWeekData.reduce((sum, f) => sum + f.medBCaseload, 0)} on caseload`,
      gradient: 'from-rose-500 via-pink-500 to-fuchsia-500',
      bgGradient: 'from-rose-50 to-pink-50'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Animated Background Pattern */}
      <div className="fixed inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, rgba(100, 200, 255, 0.3) 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}></div>
      </div>

      {/* Header */}
      <header className="relative bg-white/10 backdrop-blur-xl border-b border-white/20 sticky top-0 z-50 shadow-2xl">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-400 to-teal-500 rounded-2xl blur-lg opacity-75 animate-pulse"></div>
                <div className="relative w-14 h-14 bg-gradient-to-br from-cyan-400 via-teal-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-2xl transform rotate-6 hover:rotate-0 transition-transform duration-500">
                  <Zap className="w-8 h-8 text-white" strokeWidth={2.5} />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-black bg-gradient-to-r from-cyan-300 via-teal-300 to-emerald-300 bg-clip-text text-transparent tracking-tight">
                  TheraScope
                </h1>
                <p className="text-sm text-slate-400 font-medium tracking-wide">Visibility • Control • Intelligence</p>
              </div>
            </div>
            
            <a 
              href={WEEKLY_REPORT_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-teal-500 rounded-2xl blur opacity-75 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-2xl hover:from-cyan-600 hover:to-teal-600 transition-all duration-300 shadow-xl transform hover:scale-105 font-bold">
                <ExternalLink className="w-5 h-5" />
                Submit Weekly Report
              </div>
            </a>
          </div>
        </div>
      </header>

      <div className="relative max-w-7xl mx-auto px-6 py-10">
        {/* Navigation Tabs */}
        <div className="flex gap-3 mb-10 bg-white/5 backdrop-blur-xl rounded-3xl p-2 shadow-2xl border border-white/10">
          {[
            { id: 'overview', label: 'Overview', icon: Activity },
            { id: 'facilities', label: 'All Facilities', icon: Building2 },
            { id: 'documents', label: 'Documents', icon: FileText }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id)}
              className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-bold transition-all duration-300 flex-1 justify-center ${
                activeView === tab.id
                  ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-2xl transform scale-105'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Week Selector */}
        {(activeView === 'overview' || activeView === 'facilities') && (
          <div className="mb-6 flex items-center gap-4">
            <label className="text-white font-bold text-lg">Viewing:</label>
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="px-6 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl text-white font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {availableWeeks.map(week => (
                <option key={week} value={week} className="bg-slate-800">
                  {week === 'latest' ? 'Latest Week' : `Week ${week}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Overview Tab */}
        {activeView === 'overview' && (
          <div className="space-y-10 animate-fadeIn">
            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {metrics.map((metric, idx) => (
                <div 
                  key={idx}
                  className={`relative bg-gradient-to-br ${metric.bgGradient} rounded-3xl p-8 shadow-2xl border border-white/20 hover:shadow-cyan-500/20 transition-all duration-500 transform hover:scale-105 hover:-translate-y-2 group overflow-hidden`}
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/20 to-transparent rounded-full blur-3xl"></div>
                  <div className="relative">
                    <div className={`w-16 h-16 bg-gradient-to-br ${metric.gradient} rounded-2xl flex items-center justify-center mb-6 shadow-xl transform group-hover:rotate-12 transition-transform duration-500`}>
                      <metric.icon className="w-8 h-8 text-white" strokeWidth={2.5} />
                    </div>
                    <div className="text-5xl font-black text-slate-900 mb-2 tracking-tight">{metric.value}</div>
                    <div className="text-sm text-slate-700 font-bold mb-3 uppercase tracking-wide">{metric.label}</div>
                    <div className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 bg-gradient-to-r ${metric.gradient} text-white rounded-full shadow-lg`}>
                      <TrendingUp className="w-3 h-3" />
                      {metric.change}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Data Source Info */}
            <div className="relative bg-gradient-to-br from-indigo-900/40 via-purple-900/40 to-pink-900/40 backdrop-blur-xl rounded-3xl p-10 border border-white/20 shadow-2xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10"></div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-3xl"></div>
              
              <div className="relative flex items-start gap-6">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-2xl transform hover:rotate-12 transition-transform duration-500">
                  <CheckCircle className="w-8 h-8 text-white" strokeWidth={2.5} />
                </div>
                <div className="flex-1">
                  <h3 className="text-3xl font-black text-white mb-3 tracking-tight">Real Data Loaded! ✓</h3>
                  <p className="text-slate-300 mb-6 text-lg font-medium">
                    Showing {allWeeklyData.length} records from your DOR Weekly Reports across {new Set(allWeeklyData.map(d => d.facility)).size} facilities and {new Set(allWeeklyData.map(d => d.week)).size} weeks.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 text-white bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/20">
                      <CheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0" strokeWidth={2.5} />
                      <span className="font-bold">Currently using exported CSV data</span>
                    </div>
                    <div className="flex items-center gap-3 text-white bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/20">
                      <CheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0" strokeWidth={2.5} />
                      <span className="font-bold">To auto-sync: Share Excel link</span>
                    </div>
                  </div>
                  <div className="mt-6 p-4 bg-white/5 rounded-xl border border-white/10">
                    <p className="text-sm text-slate-400 font-medium">
                      <strong className="text-cyan-400">Next step:</strong> Share your Excel Online file link to enable automatic updates when DORs submit weekly reports.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Facilities Tab */}
        {activeView === 'facilities' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Filters */}
            <div className="bg-white/5 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-6">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px] relative">
                  <Search className="w-5 h-5 text-slate-400 absolute left-5 top-1/2 transform -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search facilities..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-14 pr-6 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-slate-400 font-medium"
                  />
                </div>
                
                <select
                  value={filterProductivity}
                  onChange={(e) => setFilterProductivity(e.target.value)}
                  className="px-6 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white font-bold"
                >
                  <option value="all" className="bg-slate-800">All Productivity</option>
                  <option value="high" className="bg-slate-800">≥84% (Meeting Goal)</option>
                  <option value="low" className="bg-slate-800">&lt;84% (Below Goal)</option>
                </select>

                <select
                  value={filterCPM}
                  onChange={(e) => setFilterCPM(e.target.value)}
                  className="px-6 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white font-bold"
                >
                  <option value="all" className="bg-slate-800">All CPM</option>
                  <option value="good" className="bg-slate-800">&lt;$1.45 (Good)</option>
                  <option value="high" className="bg-slate-800">≥$1.45 (High)</option>
                </select>
              </div>
            </div>

            {/* Facilities List */}
            <div className="bg-white/5 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 overflow-hidden">
              <div className="p-8 bg-gradient-to-r from-cyan-900/30 to-teal-900/30 border-b border-white/10">
                <h2 className="text-3xl font-black text-white tracking-tight">Facility Performance</h2>
                <p className="text-slate-300 mt-2 text-lg font-medium">
                  Showing {filteredFacilities.length} facilities • Click to view historical data
                </p>
              </div>
              
              <div className="divide-y divide-white/10">
                {filteredFacilities.map((facility, idx) => {
                  const history = getFacilityHistory(facility.facility);
                  const isExpanded = expandedFacility === facility.facility;
                  
                  return (
                    <div key={idx} className="transition-all duration-300">
                      <div 
                        className="p-8 hover:bg-white/5 transition-all duration-300 cursor-pointer"
                        onClick={() => setExpandedFacility(isExpanded ? null : facility.facility)}
                      >
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-5 flex-1">
                            <Building2 className="w-8 h-8 text-cyan-400" strokeWidth={2.5} />
                            <div className="flex-1">
                              <h3 className="text-2xl font-black text-white tracking-tight">{facility.facility}</h3>
                              <p className="text-sm text-slate-400 font-medium mt-1">
                                {history.length} weeks of data available
                              </p>
                            </div>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-6 h-6 text-cyan-400" />
                          ) : (
                            <ChevronDown className="w-6 h-6 text-slate-400" />
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                          <div className={`bg-gradient-to-br ${getProductivityBg(facility.productivity)} backdrop-blur-sm rounded-2xl p-6 border transform hover:scale-105 transition-all duration-300`}>
                            <div className="flex items-center gap-3 mb-3">
                              <TrendingUp className={`w-5 h-5 ${getProductivityColor(facility.productivity)}`} strokeWidth={2.5} />
                              <div className="text-xs text-slate-300 font-bold uppercase tracking-wider">Productivity</div>
                            </div>
                            <div className={`text-4xl font-black ${getProductivityColor(facility.productivity)}`}>
                              {facility.productivity}%
                            </div>
                            <div className="text-xs text-slate-400 mt-2 font-medium">
                              {facility.productivity >= 84 ? 'Meeting goal ✓' : 'Below goal'}
                            </div>
                          </div>

                          <div className={`bg-gradient-to-br ${facility.cpm < 1.45 ? 'from-emerald-500/20 to-teal-500/20 border-emerald-400/30' : 'from-rose-500/20 to-red-500/20 border-rose-400/30'} backdrop-blur-sm rounded-2xl p-6 border transform hover:scale-105 transition-all duration-300`}>
                            <div className="flex items-center gap-3 mb-3">
                              <PieChart className={`w-5 h-5 ${getCPMColor(facility.cpm)}`} strokeWidth={2.5} />
                              <div className="text-xs text-slate-300 font-bold uppercase tracking-wider">CPM</div>
                            </div>
                            <div className={`text-4xl font-black ${getCPMColor(facility.cpm)}`}>
                              ${facility.cpm}
                            </div>
                            <div className="text-xs text-slate-400 mt-2 font-medium">
                              {facility.cpm < 1.45 ? 'Under target ✓' : 'Above target'}
                            </div>
                          </div>

                          <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-sm rounded-2xl p-6 border border-purple-400/30 transform hover:scale-105 transition-all duration-300">
                            <div className="flex items-center gap-3 mb-3">
                              <BarChart3 className="w-5 h-5 text-purple-300" strokeWidth={2.5} />
                              <div className="text-xs text-slate-300 font-bold uppercase tracking-wider">Med B Eligible</div>
                            </div>
                            <div className="text-4xl font-black text-purple-300">{facility.medBEligible}</div>
                            <div className="text-xs text-slate-400 mt-2 font-medium">Total eligible</div>
                          </div>

                          <div className="bg-gradient-to-br from-blue-500/20 to-indigo-500/20 backdrop-blur-sm rounded-2xl p-6 border border-blue-400/30 transform hover:scale-105 transition-all duration-300">
                            <div className="flex items-center gap-3 mb-3">
                              <Users className="w-5 h-5 text-blue-300" strokeWidth={2.5} />
                              <div className="text-xs text-slate-300 font-bold uppercase tracking-wider">On Caseload</div>
                            </div>
                            <div className="text-4xl font-black text-blue-300">{facility.medBCaseload}</div>
                            <div className="text-xs text-slate-400 mt-2 font-medium">Active patients</div>
                          </div>
                        </div>
                      </div>

                      {/* Historical Data */}
                      {isExpanded && (
                        <div className="bg-white/3 p-8 border-t border-white/10 animate-fadeIn">
                          <h4 className="text-xl font-bold text-white mb-6">Historical Performance</h4>
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="text-left border-b border-white/10">
                                  <th className="pb-4 text-sm font-bold text-slate-300 uppercase tracking-wider">Week</th>
                                  <th className="pb-4 text-sm font-bold text-slate-300 uppercase tracking-wider">Productivity</th>
                                  <th className="pb-4 text-sm font-bold text-slate-300 uppercase tracking-wider">CPM</th>
                                  <th className="pb-4 text-sm font-bold text-slate-300 uppercase tracking-wider">Med B Eligible</th>
                                  <th className="pb-4 text-sm font-bold text-slate-300 uppercase tracking-wider">On Caseload</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                {history.map((record, idx) => (
                                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                                    <td className="py-4 text-white font-bold">{record.week}</td>
                                    <td className={`py-4 font-bold ${getProductivityColor(record.productivity)}`}>
                                      {record.productivity}%
                                    </td>
                                    <td className={`py-4 font-bold ${getCPMColor(record.cpm)}`}>
                                      ${record.cpm}
                                    </td>
                                    <td className="py-4 text-purple-300 font-bold">{record.medBEligible}</td>
                                    <td className="py-4 text-blue-300 font-bold">{record.medBCaseload}</td>
                                  </tr>
                                ))}
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
          </div>
        )}

        {/* Documents Tab */}
        {activeView === 'documents' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white/5 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-black text-white tracking-tight">Document Library</h2>
                  <p className="text-slate-300 mt-2 text-lg font-medium">Upload and manage therapy documentation</p>
                </div>
                <label className="relative group cursor-pointer">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-2xl blur opacity-75 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl hover:from-emerald-600 hover:to-teal-600 transition-all duration-300 shadow-xl transform hover:scale-105 font-bold">
                    <Upload className="w-5 h-5" />
                    Upload Document
                  </div>
                  <input type="file" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>

              <div className="flex gap-4 mb-8">
                <div className="flex-1 relative">
                  <Search className="w-5 h-5 text-slate-400 absolute left-5 top-1/2 transform -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search documents..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-14 pr-6 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-slate-400 font-medium"
                  />
                </div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-6 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white font-bold"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat} className="bg-slate-800">
                      {cat === 'all' ? 'All Categories' : cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-4">
                {filteredDocs.map((doc, idx) => (
                  <div 
                    key={doc.id}
                    className="flex items-center justify-between p-6 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 hover:bg-white/15 hover:border-cyan-400/50 transition-all duration-300 group"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-xl transform group-hover:rotate-6 transition-transform duration-300">
                        <FileText className="w-7 h-7 text-white" strokeWidth={2.5} />
                      </div>
                      <div>
                        <h3 className="font-black text-white text-lg">{doc.name}</h3>
                        <p className="text-sm text-slate-400 font-medium mt-1">
                          {doc.category} • {doc.uploadDate} • {doc.size}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button className="p-3 text-slate-300 hover:bg-white/10 hover:text-cyan-400 rounded-xl transition-all border border-transparent hover:border-cyan-400/50">
                        <Eye className="w-5 h-5" />
                      </button>
                      <button className="p-3 text-slate-300 hover:bg-white/10 hover:text-emerald-400 rounded-xl transition-all border border-transparent hover:border-emerald-400/50">
                        <Download className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fadeIn > * {
          animation: fadeIn 0.6s ease-out forwards;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
}
