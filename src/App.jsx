import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, ExternalLink, Activity, TrendingUp, Search, Eye, Download, CheckCircle, BarChart3, Users, Zap, PieChart, Building2, ChevronDown, ChevronUp, MapPin, Trophy, Award, Star, TrendingDown, MessageCircle, Send, X, Sparkles, FileSpreadsheet } from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import JSZip from 'jszip';
import facilityDataJson from './facility_data.json';

export default function App() {
  const [allWeeklyData] = useState(facilityDataJson);
  const [documents, setDocuments] = useState([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);

  // App-wide password protection - MUST BE BEFORE OTHER STATES
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordAttempt, setPasswordAttempt] = useState('');
  const [loginType, setLoginType] = useState(null); // 'admin' or 'dor'
  const [selectedFacilityForLogin, setSelectedFacilityForLogin] = useState('');

  // Calculate restriction status EARLY
  const isRestrictedView = loginType === 'dor';
  const restrictedFacility = isRestrictedView ? selectedFacilityForLogin : null;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeView, setActiveView] = useState(isRestrictedView ? 'facilities' : 'overview');
  const [selectedWeek, setSelectedWeek] = useState('latest');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [expandedFacility, setExpandedFacility] = useState(null);
  const [filterProductivity, setFilterProductivity] = useState('all');
  const [filterCPM, setFilterCPM] = useState('all');
  const [historicalView, setHistoricalView] = useState('weekly'); // 'weekly' or 'monthly'
  
  // Chatbot state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'Hi! I\'m your TheraScope AI assistant. Ask me anything about facility performance, rankings, or metrics!' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatMessagesEndRef = useRef(null);

  // NetHealth upload state
  const [showNetHealthModal, setShowNetHealthModal] = useState(false);
  const [netHealthFiles, setNetHealthFiles] = useState({
    productivity: null,
    cpm: null,
    census: null,
    mode: null
  });
  const [uploadProgress, setUploadProgress] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const WEEKLY_REPORT_LINK = 'https://forms.office.com/Pages/ResponsePage.aspx?id=GnwJbN56CESxFanmFuyVBuSsEiTDUNlHs0MWhL_En4tURFpRU0xLOTNUVllEQUZBQVJUUkVMMEVYTC4u';
  
  // Password protection
  const ADMIN_PASSWORD = 'WalkTalkWin';
  const DOR_PASSWORD = 'StrongSteps';
  
  const logActivity = (activityType, details) => {
    // Log to console (in production, this would send to a backend)
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: activityType,
      user: loginType === 'admin' ? 'Admin' : `DOR - ${selectedFacilityForLogin || 'Unknown'}`,
      facility: selectedFacilityForLogin || 'All',
      details: details
    };
    console.log('Activity Log:', logEntry);
    // In production, you would send this to your backend:
    // fetch('/api/log-activity', { method: 'POST', body: JSON.stringify(logEntry) });
  };
  
  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    
    if (loginType === 'admin' && passwordAttempt === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      logActivity('LOGIN', { success: true, loginType: 'admin' });
      setPasswordAttempt('');
    } else if (loginType === 'dor' && passwordAttempt === DOR_PASSWORD && selectedFacilityForLogin) {
      setIsAuthenticated(true);
      logActivity('LOGIN', { success: true, loginType: 'dor', facility: selectedFacilityForLogin });
      setPasswordAttempt('');
    } else {
      alert('Incorrect password or missing facility selection. Please try again.');
      logActivity('LOGIN', { success: false, loginType, facility: selectedFacilityForLogin });
      setPasswordAttempt('');
    }
  };
  
  // Get unique facility names for dropdown (with fallback)
  const allFacilities = allWeeklyData && allWeeklyData.length > 0 
    ? [...new Set(allWeeklyData.map(d => d.facility))].sort()
    : [];
  
  const scrollToBottom = () => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  // Load resources from IndexedDB on mount
  useEffect(() => {
    const loadResources = async () => {
      try {
        const request = indexedDB.open('TheraScope', 1);
        
        request.onerror = () => {
          console.log('IndexedDB error');
          setIsLoadingDocs(false);
        };
        
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(['resources'], 'readonly');
          const store = transaction.objectStore('resources');
          const getAllRequest = store.getAll();
          
          getAllRequest.onsuccess = () => {
            const resources = getAllRequest.result || [];
            setDocuments(resources.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate)));
            setIsLoadingDocs(false);
          };
        };
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('resources')) {
            db.createObjectStore('resources', { keyPath: 'id' });
          }
        };
      } catch (error) {
        console.log('IndexedDB not available:', error);
        setIsLoadingDocs(false);
      }
    };
    loadResources();
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Content = event.target.result;
        
        const newResource = {
          id: Date.now(),
          name: file.name,
          category: 'Uncategorized',
          uploadDate: new Date().toISOString().split('T')[0],
          size: file.size > 1024 * 1024 
            ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
            : `${(file.size / 1024).toFixed(0)} KB`,
          type: file.type,
          content: base64Content
        };

        // Save to IndexedDB
        try {
          const request = indexedDB.open('TheraScope', 1);
          
          request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(['resources'], 'readwrite');
            const store = transaction.objectStore('resources');
            const addRequest = store.put(newResource);
            
            addRequest.onsuccess = () => {
              setDocuments(prev => [newResource, ...prev]);
              alert('✅ Resource uploaded successfully!');
            };
            
            addRequest.onerror = () => {
              alert('❌ Failed to save resource. Please try again.');
            };
          };
          
          request.onerror = () => {
            alert('❌ Storage error. Please try again.');
          };
        } catch (error) {
          console.error('Storage error:', error);
          alert('Failed to save resource');
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload file');
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!confirm('Are you sure you want to delete this resource?')) return;
    
    try {
      const request = indexedDB.open('TheraScope', 1);
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['resources'], 'readwrite');
        const store = transaction.objectStore('resources');
        const deleteRequest = store.delete(docId);
        
        deleteRequest.onsuccess = () => {
          setDocuments(prev => prev.filter(d => d.id !== docId));
          alert('✅ Resource deleted successfully!');
        };
        
        deleteRequest.onerror = () => {
          alert('Failed to delete resource');
        };
      };
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete resource');
    }
  };

  const handleDownloadDocument = (doc) => {
    try {
      // Create a temporary link element
      const link = document.createElement('a');
      link.href = doc.content;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download document');
    }
  };

  const handleViewDocument = (doc) => {
    try {
      // For PDFs and images, open in new tab
      if (doc.type && (doc.type.includes('pdf') || doc.type.includes('image'))) {
        const newWindow = window.open();
        if (newWindow) {
          if (doc.type.includes('pdf')) {
            newWindow.document.write(`<iframe width='100%' height='100%' src='${doc.content}'></iframe>`);
          } else {
            newWindow.document.write(`<img src='${doc.content}' style='max-width:100%; height:auto;'/>`);
          }
        } else {
          // If popup blocked, download instead
          handleDownloadDocument(doc);
        }
      } else {
        // For other file types, just download
        handleDownloadDocument(doc);
      }
    } catch (error) {
      console.error('View error:', error);
      alert('Failed to open document. Trying download...');
      handleDownloadDocument(doc);
    }
  };

  const availableWeeks = ['latest', ...Array.from(new Set(allWeeklyData.map(d => d.week))).sort((a, b) => {
    const numA = parseInt(a);
    const numB = parseInt(b);
    return numB - numA;
  })];

  const getCurrentWeekData = () => {
    if (selectedWeek === 'latest') {
      const latestWeek = Math.max(...allWeeklyData.map(d => parseInt(d.week)));
      return allWeeklyData.filter(d => parseInt(d.week) === latestWeek);
    }
    return allWeeklyData.filter(d => d.week === selectedWeek);
  };

  const getFacilityHistory = (facilityName) => {
    return allWeeklyData
      .filter(d => d.facility === facilityName)
      .sort((a, b) => parseInt(b.week) - parseInt(a.week));
  };

  // MONTHLY ANALYTICS HELPERS
  const getMonthFromDate = (dateStr) => {
    const [year, month, day] = dateStr.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };
  
  const getMonthlyData = (facilityName) => {
    const facilityRecords = allWeeklyData.filter(d => d.facility === facilityName);
    
    // Group by month
    const monthlyGroups = {};
    facilityRecords.forEach(record => {
      const month = getMonthFromDate(record.date);
      if (!monthlyGroups[month]) {
        monthlyGroups[month] = [];
      }
      monthlyGroups[month].push(record);
    });
    
    // Calculate monthly averages
    const monthlyAverages = Object.keys(monthlyGroups).map(month => {
      const records = monthlyGroups[month];
      return {
        month,
        productivity: records.reduce((sum, r) => sum + r.productivity, 0) / records.length,
        cpm: records.reduce((sum, r) => sum + r.cpm, 0) / records.length,
        medBEligible: Math.round(records.reduce((sum, r) => sum + r.medBEligible, 0) / records.length),
        medBCaseload: Math.round(records.reduce((sum, r) => sum + r.medBCaseload, 0) / records.length),
        modeOfTreatment: records[0].modeOfTreatment !== undefined 
          ? records.reduce((sum, r) => sum + (r.modeOfTreatment || 0), 0) / records.length
          : undefined,
        weekCount: records.length
      };
    });
    
    // Sort by date and add month-over-month changes
    const sorted = monthlyAverages.sort((a, b) => new Date(a.month) - new Date(b.month));
    
    return sorted.map((month, idx) => {
      if (idx === 0) return { ...month, productivityChange: 0, cpmChange: 0 };
      const prevMonth = sorted[idx - 1];
      return {
        ...month,
        productivityChange: month.productivity - prevMonth.productivity,
        cpmChange: month.cpm - prevMonth.cpm
      };
    });
  };

  const calculateScore = (facility) => {
    let score = 0;
    const goals = {
      productivity: false,
      cpm: false,
      medB: false,
      modeOfTreatment: false
    };

    if (facility.productivity >= 84) {
      score++;
      goals.productivity = true;
    }

    if (facility.cpm <= 1.45) {
      score++;
      goals.cpm = true;
    }

    if (facility.medBEligible > 0 && (facility.medBCaseload / facility.medBEligible) >= 0.5) {
      score++;
      goals.medB = true;
    }

    if (facility.modeOfTreatment !== undefined && facility.modeOfTreatment >= 5) {
      score++;
      goals.modeOfTreatment = true;
    }

    return { score, goals, facility };
  };

  const analyzeData = (query) => {
    const currentWeekData = getCurrentWeekData();
    const rankedFacilities = currentWeekData.map(f => calculateScore(f)).sort((a, b) => b.score - a.score);
    const lowerQuery = query.toLowerCase();
    
    // Helper: Get facility history with trends
    const getFacilityTrend = (facilityName) => {
      const history = allWeeklyData
        .filter(d => d.facility === facilityName)
        .sort((a, b) => parseInt(a.week) - parseInt(b.week));
      
      if (history.length < 2) return null;
      
      const recent = history.slice(-3);
      const productivityTrend = recent[recent.length - 1].productivity - recent[0].productivity;
      const cpmTrend = recent[recent.length - 1].cpm - recent[0].cpm;
      
      return {
        history,
        recent,
        productivityTrend,
        cpmTrend,
        isImproving: productivityTrend > 0 && cpmTrend < 0
      };
    };
    
    // Helper: Get recommendations for missing goals
    const getRecommendations = (facility, goals) => {
      const recs = [];
      
      if (!goals.productivity) {
        recs.push(`**Productivity (${facility.productivity}% - Target: ≥84%):**
• Review scheduling efficiency - eliminate gaps between patients
• Reduce documentation time - use templates and voice-to-text
• Optimize patient scheduling - group patients by location/therapy type
• Consider concurrent treatments where appropriate
• Review individual therapist productivity - identify training needs`);
      }
      
      if (!goals.cpm) {
        recs.push(`**CPM ($${facility.cpm} - Target: ≤$1.45):**
• Increase productivity to spread fixed costs over more billable time
• Review staffing levels - are there too many travelers or premium staff?
• Optimize treatment intensity - ensure appropriate visit frequencies
• Implement group therapy sessions to reduce per-patient costs
• Cross-train staff to improve flexibility and reduce overtime`);
      }
      
      if (!goals.medB) {
        const ratio = facility.medBEligible > 0 ? Math.round((facility.medBCaseload / facility.medBEligible) * 100) : 0;
        recs.push(`**Med B on Caseload (${ratio}% - Target: ≥50%):**
• Increase outreach to eligible patients - proactive referrals
• Streamline evaluation process - reduce time from referral to start
• Ensure timely start of care - don't lose patients to delays
• Review referral sources - are there gaps in physician relationships?
• Track eligible patients not on caseload - identify barriers`);
      }
      
      if (!goals.modeOfTreatment) {
        recs.push(`**Mode of Treatment (${facility.modeOfTreatment || 0}% - Target: ≥5%):**
• Train staff on group therapy techniques and protocols
• Identify appropriate group candidates - similar functional levels
• Schedule regular group sessions - balance exercises, ADL training
• Implement concurrent treatment protocols - 2 patients, 1 therapist
• Create group therapy programs - fall prevention, strengthening`);
      }
      
      return recs;
    };
    
    // Check for specific facility with trend analysis
    const mentionedFacility = currentWeekData.find(f => lowerQuery.includes(f.facility.toLowerCase()));
    
    if (mentionedFacility) {
      const score = calculateScore(mentionedFacility);
      const trend = getFacilityTrend(mentionedFacility.facility);
      
      let response = `**${mentionedFacility.facility}** (${mentionedFacility.region}):\n\n`;
      response += `📊 **Performance Score:** ${score.score}/4 goals met\n\n`;
      response += `• Productivity: ${mentionedFacility.productivity}% ${score.goals.productivity ? '✅' : '❌'} (Target: ≥84%)\n`;
      response += `• CPM: $${mentionedFacility.cpm} ${score.goals.cpm ? '✅' : '❌'} (Target: ≤$1.45)\n`;
      response += `• Med B Ratio: ${mentionedFacility.medBEligible > 0 ? Math.round((mentionedFacility.medBCaseload / mentionedFacility.medBEligible) * 100) : 0}% ${score.goals.medB ? '✅' : '❌'} (Target: ≥50%)\n`;
      response += `• Mode of Treatment: ${mentionedFacility.modeOfTreatment || 0}% ${score.goals.modeOfTreatment ? '✅' : '❌'} (Target: ≥5%)\n\n`;
      
      // Add trend analysis if available
      if (trend && trend.history.length >= 2) {
        response += `**📈 Trend (last 3 weeks):**\n`;
        response += `• Productivity: ${trend.productivityTrend > 0 ? '↗️' : '↘️'} ${Math.abs(trend.productivityTrend).toFixed(1)}%\n`;
        response += `• CPM: ${trend.cpmTrend < 0 ? '↗️' : '↘️'} $${Math.abs(trend.cpmTrend).toFixed(2)}\n`;
        response += `• Overall: ${trend.isImproving ? '✅ Improving' : '⚠️ Needs attention'}\n\n`;
      }
      
      // Add recommendations if struggling
      if (score.score < 4 && (lowerQuery.includes('help') || lowerQuery.includes('improve') || lowerQuery.includes('what') || lowerQuery.includes('how'))) {
        const recs = getRecommendations(mentionedFacility, score.goals);
        if (recs.length > 0) {
          response += `**💡 Recommendations:**\n\n${recs.join('\n\n')}`;
        }
      }
      
      return response;
    }
    
    // Trend analysis queries
    if (lowerQuery.includes('trend') || lowerQuery.includes('improved') || lowerQuery.includes('declining') || lowerQuery.includes('getting better') || lowerQuery.includes('getting worse')) {
      const facilitiesWithTrends = currentWeekData.map(f => ({
        ...f,
        trend: getFacilityTrend(f.facility)
      })).filter(f => f.trend);
      
      const improving = facilitiesWithTrends
        .filter(f => f.trend.isImproving)
        .sort((a, b) => b.trend.productivityTrend - a.trend.productivityTrend)
        .slice(0, 5);
      
      const declining = facilitiesWithTrends
        .filter(f => !f.trend.isImproving && f.trend.productivityTrend < -2)
        .sort((a, b) => a.trend.productivityTrend - b.trend.productivityTrend)
        .slice(0, 3);
      
      let response = '';
      
      if (improving.length > 0) {
        response += `**📈 Most Improved Facilities:**\n\n`;
        response += improving.map(f => 
          `• **${f.facility}** (${f.region})\n  Productivity: +${f.trend.productivityTrend.toFixed(1)}%, CPM: ${f.trend.cpmTrend.toFixed(2)}`
        ).join('\n\n') + '\n\n';
      }
      
      if (declining.length > 0) {
        response += `**⚠️ Declining Facilities (Need Attention):**\n\n`;
        response += declining.map(f => 
          `• **${f.facility}** (${f.region})\n  Productivity: ${f.trend.productivityTrend.toFixed(1)}%, CPM: +${Math.abs(f.trend.cpmTrend).toFixed(2)}`
        ).join('\n\n');
      }
      
      if (!improving.length && !declining.length) {
        response = 'Not enough historical data yet to identify clear trends. Check back after a few more weeks!';
      }
      
      return response;
    }
    
    // Best practices / what top performers do differently
    if (lowerQuery.includes('best practice') || lowerQuery.includes('top facilities') || lowerQuery.includes('what are') && (lowerQuery.includes('doing') || lowerQuery.includes('different'))) {
      const topPerformers = rankedFacilities.filter(f => f.score >= 3).map(f => f.facility);
      const bottomPerformers = rankedFacilities.filter(f => f.score <= 1).map(f => f.facility);
      
      if (topPerformers.length === 0) {
        return 'No facilities are currently meeting 3+ goals. Focus on getting facilities to meet at least 2 goals first.';
      }
      
      const topAvg = {
        productivity: topPerformers.reduce((sum, f) => sum + f.productivity, 0) / topPerformers.length,
        cpm: topPerformers.reduce((sum, f) => sum + f.cpm, 0) / topPerformers.length,
        modeOfTx: topPerformers.reduce((sum, f) => sum + (f.modeOfTreatment || 0), 0) / topPerformers.length
      };
      
      return `**🏆 What Top Performers Do Differently:**\n\n` +
        `**Top facilities (${topPerformers.length} facilities scoring 3-4/4):**\n` +
        `• Average Productivity: ${topAvg.productivity.toFixed(1)}%\n` +
        `• Average CPM: $${topAvg.cpm.toFixed(2)}\n` +
        `• Average Mode of Tx: ${topAvg.modeOfTx.toFixed(1)}%\n\n` +
        `**Key Success Factors:**\n` +
        `• Maintain productivity above 84% through efficient scheduling\n` +
        `• Control costs by optimizing staffing and using group therapy\n` +
        `• Actively manage Medicare B caseload - convert 50%+ of eligible\n` +
        `• Implement group/concurrent treatments regularly (5%+ of visits)\n\n` +
        `**Action:** Share these practices with struggling facilities!`;
    }
    
    // Recommendations for struggling facilities
    if (lowerQuery.includes('help') || lowerQuery.includes('what can') || lowerQuery.includes('what should') || lowerQuery.includes('advice') || lowerQuery.includes('recommend')) {
      const strugglingFacilities = rankedFacilities.filter(f => f.score <= 2);
      
      if (strugglingFacilities.length === 0) {
        return `All facilities are doing well! Everyone is meeting at least 3/4 goals. Keep up the great work! 🎉`;
      }
      
      const facility = strugglingFacilities[0].facility;
      const goals = strugglingFacilities[0].goals;
      const recs = getRecommendations(facility, goals);
      
      let response = `**💡 Recommendations for ${facility.facility}** (${strugglingFacilities[0].score}/4 goals):\n\n`;
      response += recs.join('\n\n');
      response += `\n\n**Next Steps:**\n`;
      response += `1. Focus on 1-2 goals first - don't try to fix everything at once\n`;
      response += `2. Set weekly improvement targets - small wins build momentum\n`;
      response += `3. Check back next week to track progress\n`;
      response += `4. Reach out to top-performing facilities for best practices`;
      
      return response;
    }
    
    // Compare two facilities or facility vs average
    if (lowerQuery.includes('compare') || lowerQuery.includes('vs') || lowerQuery.includes('versus')) {
      const facilities = currentWeekData.filter(f => 
        lowerQuery.includes(f.facility.toLowerCase())
      );
      
      if (facilities.length >= 2) {
        const [f1, f2] = facilities;
        return `**⚖️ Comparison:**\n\n` +
          `**${f1.facility}:**\n` +
          `• Productivity: ${f1.productivity}%\n• CPM: $${f1.cpm}\n• Med B: ${f1.medBCaseload}/${f1.medBEligible}\n• Mode: ${f1.modeOfTreatment || 0}%\n\n` +
          `**${f2.facility}:**\n` +
          `• Productivity: ${f2.productivity}%\n• CPM: $${f2.cpm}\n• Med B: ${f2.medBCaseload}/${f2.medBEligible}\n• Mode: ${f2.modeOfTreatment || 0}%\n\n` +
          `**Winner:** ${f1.productivity > f2.productivity ? f1.facility : f2.facility} (higher productivity)`;
      }
      
      if (facilities.length === 1 && (lowerQuery.includes('average') || lowerQuery.includes('region'))) {
        const f = facilities[0];
        const regionData = currentWeekData.filter(d => d.region === f.region);
        const regionAvg = {
          productivity: regionData.reduce((s, d) => s + d.productivity, 0) / regionData.length,
          cpm: regionData.reduce((s, d) => s + d.cpm, 0) / regionData.length
        };
        
        return `**${f.facility} vs ${f.region} Average:**\n\n` +
          `**${f.facility}:**\n• Productivity: ${f.productivity}% ${f.productivity >= regionAvg.productivity ? '✅' : '↘️'}\n• CPM: $${f.cpm} ${f.cpm <= regionAvg.cpm ? '✅' : '↗️'}\n\n` +
          `**${f.region} Average:**\n• Productivity: ${regionAvg.productivity.toFixed(1)}%\n• CPM: $${regionAvg.cpm.toFixed(2)}`;
      }
    }
    
    // Rankings
    if (lowerQuery.includes('top') || lowerQuery.includes('best') || lowerQuery.includes('rank')) {
      const topFacilities = rankedFacilities.slice(0, 5);
      return `**🏆 Top 5 Facilities:**\n\n` + 
        topFacilities.map((f, idx) => 
          `${idx + 1}. **${f.facility.facility}** - ${f.score}/4 goals (${f.facility.region})`
        ).join('\n');
    }
    
    // 4/4 performers
    if (lowerQuery.includes('4/4') || lowerQuery.includes('all goals') || lowerQuery.includes('perfect')) {
      const perfect = rankedFacilities.filter(f => f.score === 4);
      if (perfect.length === 0) {
        return `No facilities are currently meeting all 4 goals. The closest are:\n\n` +
          rankedFacilities.filter(f => f.score === 3).slice(0, 3).map(f => 
            `• **${f.facility.facility}** - 3/4 goals (${f.facility.region})`
          ).join('\n');
      }
      return `**🎉 Facilities meeting all 4 goals:**\n\n` +
        perfect.map(f => `• **${f.facility.facility}** (${f.facility.region})`).join('\n');
    }
    
    // Region comparison
    if (lowerQuery.includes('golden coast') || lowerQuery.includes('overland') || lowerQuery.includes('region')) {
      const goldenCoast = currentWeekData.filter(d => d.region === 'Golden Coast');
      const overland = currentWeekData.filter(d => d.region === 'Overland');
      
      return `**📍 Regional Comparison:**\n\n` +
        `**Golden Coast** (${goldenCoast.length} facilities):\n` +
        `• Avg Productivity: ${Math.round(goldenCoast.reduce((s, f) => s + f.productivity, 0) / goldenCoast.length)}%\n` +
        `• Avg CPM: $${(goldenCoast.reduce((s, f) => s + f.cpm, 0) / goldenCoast.length).toFixed(2)}\n\n` +
        `**Overland** (${overland.length} facilities):\n` +
        `• Avg Productivity: ${Math.round(overland.reduce((s, f) => s + f.productivity, 0) / overland.length)}%\n` +
        `• Avg CPM: $${(overland.reduce((s, f) => s + f.cpm, 0) / overland.length).toFixed(2)}`;
    }
    
    // Metrics explanation
    if (lowerQuery.includes('what is') || lowerQuery.includes('explain') || lowerQuery.includes('mean')) {
      if (lowerQuery.includes('cpm')) {
        return `**CPM (Cost Per Minute)** is the average cost of providing one minute of therapy.\n\n` +
          `• **Target:** ≤ $1.45\n` +
          `• **Lower is better** - indicates more efficient service delivery\n` +
          `• Affected by staffing costs, productivity, and treatment intensity`;
      }
      if (lowerQuery.includes('productivity')) {
        return `**Team Productivity** is the percentage of available time spent providing billable therapy services.\n\n` +
          `• **Target:** ≥ 84%\n` +
          `• **Higher is better** - indicates efficient use of therapist time\n` +
          `• Includes direct patient care and documentation`;
      }
      if (lowerQuery.includes('med b') || lowerQuery.includes('medicare b')) {
        return `**Medicare Part B** refers to patients whose therapy is covered under Medicare Part B insurance.\n\n` +
          `• **Eligible:** Total patients who qualify for Med B\n` +
          `• **On Caseload:** Actively receiving therapy\n` +
          `• **Target:** ≥ 50% of eligible patients on caseload\n` +
          `• Important for revenue and compliance`;
      }
      if (lowerQuery.includes('mode of treatment')) {
        return `**Mode of Treatment** measures the percentage of therapy delivered in group or concurrent sessions.\n\n` +
          `• **Target:** ≥ 5%\n` +
          `• **Group:** Multiple patients treated simultaneously\n` +
          `• **Concurrent:** Two patients treated at same time\n` +
          `• Improves efficiency and patient socialization`;
      }
    }
    
    // Need improvement
    if (lowerQuery.includes('struggling') || lowerQuery.includes('low') || lowerQuery.includes('worst')) {
      const needsWork = rankedFacilities.filter(f => f.score <= 1).slice(0, 3);
      if (needsWork.length === 0) {
        return `Great news! All facilities are performing reasonably well. The lowest performers are still meeting 2+ goals.`;
      }
      return `**⚠️ Facilities needing attention:**\n\n` +
        needsWork.map(f => 
          `• **${f.facility.facility}** - ${f.score}/4 goals (${f.facility.region})\n` +
          `  Missing: ${!f.goals.productivity ? 'Productivity ' : ''}${!f.goals.cpm ? 'CPM ' : ''}${!f.goals.medB ? 'Med B ' : ''}${!f.goals.modeOfTreatment ? 'Mode of Tx' : ''}`
        ).join('\n\n');
    }
    
    // Monthly queries
    if (lowerQuery.includes('month') || lowerQuery.includes('september') || lowerQuery.includes('october') || lowerQuery.includes('november') || lowerQuery.includes('december')) {
      // Check for specific facility monthly data
      const mentionedFacility = currentWeekData.find(f => lowerQuery.includes(f.facility.toLowerCase()));
      
      if (mentionedFacility) {
        const monthlyData = getMonthlyData(mentionedFacility.facility);
        return `**📅 Monthly Performance for ${mentionedFacility.facility}:**\n\n` +
          monthlyData.map(m => {
            const trend = m.productivityChange > 0 ? '↗️ Improving' : m.productivityChange < 0 ? '↘️ Declining' : '➡️ Stable';
            return `**${m.month}** (${m.weekCount} weeks):\n` +
              `• Productivity: ${m.productivity.toFixed(1)}% ${m.productivityChange !== undefined && m.productivityChange !== 0 ? `(${m.productivityChange > 0 ? '+' : ''}${m.productivityChange.toFixed(1)}%)` : ''}\n` +
              `• CPM: $${m.cpm.toFixed(2)} ${m.cpmChange !== undefined && m.cpmChange !== 0 ? `(${m.cpmChange > 0 ? '+' : ''}${m.cpmChange.toFixed(2)})` : ''}\n` +
              `• Trend: ${trend}`;
          }).join('\n\n');
      }
      
      // General monthly overview
      const allMonths = {};
      allWeeklyData.forEach(record => {
        const month = getMonthFromDate(record.date);
        if (!allMonths[month]) allMonths[month] = [];
        allMonths[month].push(record);
      });
      
      const monthlyStats = Object.keys(allMonths).sort().map(month => {
        const records = allMonths[month];
        return {
          month,
          avgProductivity: records.reduce((s, r) => s + r.productivity, 0) / records.length,
          avgCPM: records.reduce((s, r) => s + r.cpm, 0) / records.length,
          facilitiesReporting: new Set(records.map(r => r.facility)).size
        };
      });
      
      return `**📅 Monthly Overview:**\n\n` +
        monthlyStats.map(m => 
          `**${m.month}**:\n` +
          `• Avg Productivity: ${m.avgProductivity.toFixed(1)}%\n` +
          `• Avg CPM: $${m.avgCPM.toFixed(2)}\n` +
          `• Facilities Reporting: ${m.facilitiesReporting}`
        ).join('\n\n');
    }
    
    // Default response
    return `I can help you with:\n\n` +
      `• **Facility performance** - "How is Mountain View doing?"\n` +
      `• **Monthly data** - "Show me monthly averages for Eden HC"\n` +
      `• **Trends** - "Which facilities improved the most?"\n` +
      `• **Rankings** - "Who are the top performers?"\n` +
      `• **Comparisons** - "Compare Eden HC to Overland average"\n` +
      `• **Recommendations** - "What can struggling facilities do?"\n` +
      `• **Best practices** - "What are top facilities doing differently?"\n` +
      `• **Metrics** - "What is CPM?"\n\n` +
      `Try asking me a specific question!`;
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatInput('');
    setIsTyping(true);

    // Simulate AI thinking time
    setTimeout(() => {
      const response = analyzeData(userMessage);
      setChatMessages(prev => [...prev, { role: 'assistant', content: response }]);
      setIsTyping(false);
    }, 500);
  };

  const currentWeekData = getCurrentWeekData();
  
  // Apply facility restriction if in restricted view
  const viewableData = isRestrictedView 
    ? currentWeekData.filter(f => f.facility === restrictedFacility)
    : currentWeekData;
  
  const rankedFacilities = viewableData.map(f => calculateScore(f)).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.facility.productivity !== a.facility.productivity) return b.facility.productivity - a.facility.productivity;
    return a.facility.cpm - b.facility.cpm;
  });

  const filteredFacilities = viewableData.filter(facility => {
    const matchesSearch = facility.facility.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRegion = selectedRegion === 'all' || facility.region === selectedRegion;
    const matchesProductivity = 
      filterProductivity === 'all' ||
      (filterProductivity === 'high' && facility.productivity >= 84) ||
      (filterProductivity === 'low' && facility.productivity < 84);
    const matchesCPM = 
      filterCPM === 'all' ||
      (filterCPM === 'good' && facility.cpm <= 1.45) ||
      (filterCPM === 'high' && facility.cpm > 1.45);
    
    return matchesSearch && matchesRegion && matchesProductivity && matchesCPM;
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

  const getCPMColor = (cpm) => cpm <= 1.45 ? 'text-emerald-400' : 'text-rose-400';

  const getProductivityBg = (productivity) => {
    if (productivity >= 90) return 'from-emerald-500/20 to-teal-500/20 border-emerald-400/30';
    if (productivity >= 84) return 'from-teal-500/20 to-cyan-500/20 border-teal-400/30';
    if (productivity >= 75) return 'from-amber-500/20 to-orange-500/20 border-amber-400/30';
    return 'from-rose-500/20 to-red-500/20 border-rose-400/30';
  };

  const getScoreBadge = (score) => {
    if (score === 4) return {
      icon: Trophy,
      label: 'Top Performer',
      color: 'from-yellow-400 to-amber-500',
      bgColor: 'from-yellow-500/20 to-amber-500/20',
      borderColor: 'border-yellow-400/50',
      textColor: 'text-yellow-300'
    };
    if (score === 3) return {
      icon: Award,
      label: 'High Performer',
      color: 'from-slate-300 to-slate-400',
      bgColor: 'from-slate-500/20 to-slate-600/20',
      borderColor: 'border-slate-400/50',
      textColor: 'text-slate-300'
    };
    if (score === 2) return {
      icon: Star,
      label: 'Good Performer',
      color: 'from-orange-400 to-orange-600',
      bgColor: 'from-orange-500/20 to-orange-600/20',
      borderColor: 'border-orange-400/50',
      textColor: 'text-orange-300'
    };
    if (score === 1) return {
      icon: TrendingUp,
      label: 'Needs Improvement',
      color: 'from-blue-400 to-blue-500',
      bgColor: 'from-blue-500/20 to-blue-600/20',
      borderColor: 'border-blue-400/50',
      textColor: 'text-blue-300'
    };
    return {
      icon: TrendingDown,
      label: 'Action Required',
      color: 'from-rose-400 to-red-500',
      bgColor: 'from-rose-500/20 to-red-500/20',
      borderColor: 'border-rose-400/50',
      textColor: 'text-rose-300'
    };
  };

  const goldenCoastData = currentWeekData.filter(d => d.region === 'Golden Coast');
  const overlandData = currentWeekData.filter(d => d.region === 'Overland');

  const metrics = [
    { 
      label: 'Total Facilities', 
      value: viewableData.length,
      icon: Building2, 
      change: isRestrictedView ? `${selectedFacilityForLogin} only` : `${viewableData.length} Active facilities`,
      gradient: 'from-cyan-500 via-teal-500 to-emerald-500',
      bgGradient: 'from-cyan-50 to-teal-50'
    },
    { 
      label: isRestrictedView ? 'My Productivity' : 'Avg Productivity', 
      value: `${Math.round(viewableData.reduce((sum, f) => sum + f.productivity, 0) / viewableData.length)}%`,
      icon: TrendingUp, 
      change: selectedWeek === 'latest' ? 'This week' : `Week ${selectedWeek}`,
      gradient: 'from-emerald-500 via-green-500 to-lime-500',
      bgGradient: 'from-emerald-50 to-green-50'
    },
    { 
      label: isRestrictedView ? 'My CPM' : 'Avg CPM', 
      value: `$${(viewableData.reduce((sum, f) => sum + f.cpm, 0) / viewableData.length).toFixed(2)}`,
      icon: PieChart, 
      change: selectedWeek === 'latest' ? 'This week' : `Week ${selectedWeek}`,
      gradient: 'from-violet-500 via-purple-500 to-fuchsia-500',
      bgGradient: 'from-violet-50 to-purple-50'
    },
    { 
      label: isRestrictedView ? 'My Med B' : 'Total Med B', 
      value: viewableData.reduce((sum, f) => sum + f.medBEligible, 0),
      icon: BarChart3, 
      change: `${viewableData.reduce((sum, f) => sum + f.medBCaseload, 0)} on caseload`,
      gradient: 'from-rose-500 via-pink-500 to-fuchsia-500',
      bgGradient: 'from-rose-50 to-pink-50'
    }
  ];

  // Helper function to create DOR PDF
  const createDORPDF = (facility, history) => {
    const doc = new jsPDF();
    
    doc.setFontSize(24);
    doc.setTextColor(8, 145, 178);
    doc.text('TheraScope', 105, 20, { align: 'center' });
    
    doc.setFontSize(16);
    doc.setTextColor(71, 85, 105);
    doc.text('Weekly Performance Report', 105, 30, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`Facility: ${facility.facility}`, 20, 45);
    doc.text(`Report Week: ${facility.date}`, 20, 52);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 59);
    
    doc.setFontSize(14);
    doc.setTextColor(8, 145, 178);
    doc.text('Performance Metrics', 20, 75);
    
    const medBPct = facility.medBEligible > 0 ? Math.round((facility.medBCaseload / facility.medBEligible) * 100) : 0;
    
    doc.autoTable({
      startY: 80,
      head: [['Metric', 'Your Result', 'Goal', 'Status']],
      body: [
        ['Productivity', `${facility.productivity}%`, '>= 84%', facility.productivity >= 84 ? '✓ Met' : '✗ Not Met'],
        ['CPM', `$${facility.cpm}`, '<= $1.45', facility.cpm <= 1.45 ? '✓ Met' : '✗ Not Met'],
        ['Med B Performance', `${medBPct}%`, '', '']
      ],
      theme: 'grid',
      headStyles: { fillColor: [8, 145, 178] }
    });
    
    let yPos = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.setTextColor(8, 145, 178);
    doc.text('DOR-Specific Metrics', 20, yPos);
    
    doc.autoTable({
      startY: yPos + 5,
      head: [['Metric', 'This Week']],
      body: [
        ['Med B Units Billed', String(facility.medBUnitsThisWeek || 'N/A')],
        ['Units Per Visit', String(facility.unitsPerVisit || 'N/A')],
        ['Mode of Treatment', `${facility.modeOfTreatment || 0}%`]
      ],
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241] }
    });
    
    if (history.length > 0) {
      yPos = doc.lastAutoTable.finalY + 15;
      doc.setFontSize(14);
      doc.setTextColor(8, 145, 178);
      doc.text('4-Week Trend', 20, yPos);
      
      doc.autoTable({
        startY: yPos + 5,
        head: [['Week', 'Productivity', 'CPM', 'Med B Caseload']],
        body: history.map(h => [h.date, `${h.productivity}%`, `$${h.cpm}`, String(h.medBCaseload)]),
        theme: 'grid',
        headStyles: { fillColor: [20, 184, 166] }
      });
    }
    
    // Add Best Practices & Recommendations
    yPos = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.setTextColor(139, 92, 246);
    doc.text('Best Practices & Recommendations', 20, yPos);
    
    const recommendations = [];
    
    // CPM recommendations
    if (facility.cpm > 1.45) {
      recommendations.push(['CPM Improvement', 'Consider increasing concurrent/group treatments where medically appropriate to improve CPM. Review treatment plans to ensure optimal grouping opportunities.']);
    }
    
    // Productivity recommendations
    if (facility.productivity < 84) {
      recommendations.push(['Productivity', 'Review team productivity including per diem staff to ensure optimal efficiency. Verify all staff members are meeting individual productivity targets.']);
    }
    
    // Med B best practices (always shown)
    recommendations.push(['Med B Growth', 'Monitor long-term care populations for any functional declines. Coordinate with MDS/RNA to identify residents who may benefit from skilled services. Ensure timely evaluations for potential Medicare beneficiaries.']);
    
    if (recommendations.length > 0) {
      doc.autoTable({
        startY: yPos + 5,
        head: [['Focus Area', 'Recommendation']],
        body: recommendations,
        theme: 'grid',
        headStyles: { fillColor: [139, 92, 246] },
        bodyStyles: { fontSize: 9 },
        columnStyles: { 
          0: { cellWidth: 40, fontStyle: 'bold' },
          1: { cellWidth: 130 }
        }
      });
    }
    
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Confidential - For Director of Rehab Only', 105, 280, { align: 'center' });
    
    return doc;
  };

  // Helper function to create Admin PDF
  const createAdminPDF = (data) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    
    const goldenCoast = data.filter(d => d.region === 'Golden Coast').sort((a, b) => a.facility.localeCompare(b.facility));
    const overland = data.filter(d => d.region === 'Overland').sort((a, b) => a.facility.localeCompare(b.facility));
    
    doc.setFontSize(24);
    doc.setTextColor(8, 145, 178);
    doc.text('TheraScope', 148, 15, { align: 'center' });
    
    doc.setFontSize(16);
    doc.setTextColor(71, 85, 105);
    doc.text('Weekly Admin Performance Report', 148, 25, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Week: ${data[0]?.date || 'N/A'}`, 20, 35);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 40);
    doc.text(`Total Facilities: ${data.length}`, 20, 45);
    
    doc.setFontSize(14);
    doc.setTextColor(217, 119, 6);
    doc.text('Golden Coast Region', 20, 55);
    
    const gcData = goldenCoast.map(f => [
      f.facility, `${f.productivity}%`, `$${f.cpm}`, String(f.medBEligible), 
      String(f.medBCaseload), String(f.medBUnitsThisWeek || 'N/A')
    ]);
    
    const gcAvgProd = goldenCoast.reduce((s, f) => s + f.productivity, 0) / goldenCoast.length;
    const gcAvgCpm = goldenCoast.reduce((s, f) => s + f.cpm, 0) / goldenCoast.length;
    const gcTotalEligible = goldenCoast.reduce((s, f) => s + f.medBEligible, 0);
    const gcTotalCaseload = goldenCoast.reduce((s, f) => s + f.medBCaseload, 0);
    const gcTotalUnits = goldenCoast.reduce((s, f) => s + (f.medBUnitsThisWeek || 0), 0);
    
    gcData.push(['TOTALS/AVG', `${gcAvgProd.toFixed(1)}%`, `$${gcAvgCpm.toFixed(2)}`, 
      String(gcTotalEligible), String(gcTotalCaseload), String(gcTotalUnits)]);
    
    doc.autoTable({
      startY: 60,
      head: [['Facility', 'Productivity', 'CPM', 'Med B Eligible', 'Med B Caseload', 'Med B Units']],
      body: gcData,
      theme: 'grid',
      headStyles: { fillColor: [217, 119, 6] },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 55 } }
    });
    
    let yPos = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.setTextColor(59, 130, 246);
    doc.text('Overland Region', 20, yPos);
    
    const ovData = overland.map(f => [
      f.facility, `${f.productivity}%`, `$${f.cpm}`, String(f.medBEligible),
      String(f.medBCaseload), String(f.medBUnitsThisWeek || 'N/A')
    ]);
    
    const ovAvgProd = overland.reduce((s, f) => s + f.productivity, 0) / overland.length;
    const ovAvgCpm = overland.reduce((s, f) => s + f.cpm, 0) / overland.length;
    const ovTotalEligible = overland.reduce((s, f) => s + f.medBEligible, 0);
    const ovTotalCaseload = overland.reduce((s, f) => s + f.medBCaseload, 0);
    const ovTotalUnits = overland.reduce((s, f) => s + (f.medBUnitsThisWeek || 0), 0);
    
    ovData.push(['TOTALS/AVG', `${ovAvgProd.toFixed(1)}%`, `$${ovAvgCpm.toFixed(2)}`,
      String(ovTotalEligible), String(ovTotalCaseload), String(ovTotalUnits)]);
    
    doc.autoTable({
      startY: yPos + 5,
      head: [['Facility', 'Productivity', 'CPM', 'Med B Eligible', 'Med B Caseload', 'Med B Units']],
      body: ovData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 55 } }
    });
    
    yPos = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.setTextColor(20, 184, 166);
    doc.text('Company-Wide Summary', 20, yPos);
    
    doc.autoTable({
      startY: yPos + 5,
      head: [['Metric', 'Golden Coast', 'Overland', 'Total/Average']],
      body: [
        ['Facilities', String(goldenCoast.length), String(overland.length), String(data.length)],
        ['Avg Productivity', `${gcAvgProd.toFixed(1)}%`, `${ovAvgProd.toFixed(1)}%`, `${((gcAvgProd + ovAvgProd) / 2).toFixed(1)}%`],
        ['Avg CPM', `$${gcAvgCpm.toFixed(2)}`, `$${ovAvgCpm.toFixed(2)}`, `$${((gcAvgCpm + ovAvgCpm) / 2).toFixed(2)}`],
        ['Total Med B Eligible', String(gcTotalEligible), String(ovTotalEligible), String(gcTotalEligible + ovTotalEligible)],
        ['Total Med B Caseload', String(gcTotalCaseload), String(ovTotalCaseload), String(gcTotalCaseload + ovTotalCaseload)],
        ['Total Med B Units', String(gcTotalUnits), String(ovTotalUnits), String(gcTotalUnits + ovTotalUnits)]
      ],
      theme: 'grid',
      headStyles: { fillColor: [20, 184, 166] }
    });
    
    // Add new page for Strategic Focus
    doc.addPage();
    
    doc.setFontSize(20);
    doc.setTextColor(8, 145, 178);
    doc.text('Strategic Focus & Facility Updates', 148, 20, { align: 'center' });
    
    // Golden Coast Strategic Notes
    doc.setFontSize(14);
    doc.setTextColor(217, 119, 6);
    doc.text('GOLDEN COAST REGION', 20, 35);
    
    const gcStrategic = [
      ['PAC Hills', 'Performing well, maintain current trajectory'],
      ['Gilroy', 'High traveler reliance; priority to reduce travelers and boost CPM. DOR productivity improvement needed.'],
      ['Camino Ridge PA', 'New DOR starts January - facility in rebuilding phase. 2 travelers, continued staffing growth planned.'],
      ['LAPA', 'Strong performance overall. Focus: increase Med B units. No travelers.'],
      ['PAC Coast', 'Top-heavy staffing (more therapists than assistants). PRN and some FT productivity concerns - ongoing DOR education. Rubato implementation for SI billing upcoming.'],
      ['Morgan Hill', 'Outlier facility with 3 FT therapists including DOR.'],
      ['The Win', 'Currently 2 travelers, focus on reduction. Strong sensory program performance.'],
      ['Mountain View HC', 'Zero travelers as of February. DOR returning January. Good SI utilization.']
    ];
    
    doc.autoTable({
      startY: 40,
      head: [['Facility', 'Strategic Focus & Updates']],
      body: gcStrategic,
      theme: 'grid',
      headStyles: { fillColor: [217, 119, 6], fontSize: 10 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 
        0: { cellWidth: 50, fontStyle: 'bold' },
        1: { cellWidth: 220 }
      }
    });
    
    // Overland Strategic Notes
    yPos = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.setTextColor(59, 130, 246);
    doc.text('OVERLAND REGION', 20, yPos);
    
    const ovStrategic = [
      ['Eden', 'Very stable with 4 travelers. Great Med B/SI utilization.'],
      ['Capital', '1 PTA traveler. Overall doing OK. DOR working on Ultramist for LTC to help with DC.'],
      ['Palo Alto', 'DOR difficulty with LOS management. 3 travelers (1 converted to FT). Admin to work with DOR on expectations.'],
      ['West Shore', 'Finally gained FT staff. Only 1 COTA traveler. Stable staff. Rebuilding mode for Med B. Rubato to be launched for SI billing.'],
      ['Golden Harbor', 'Rubato to be launched for SI billing. Need additional OT staff (1 traveler). Team needs behavioral health education for behavioral residents.'],
      ['Belmont', 'CRITICAL: Current OT staff unhappy and may quit - facility rebuilding needed. 2 travelers (PT/OT). Med B units negligible, work with DOR.'],
      ['BW/CW', 'Med B non-existent. 2 travelers. Rebuilding mode with staffing.']
    ];
    
    doc.autoTable({
      startY: yPos + 5,
      head: [['Facility', 'Strategic Focus & Updates']],
      body: ovStrategic,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], fontSize: 10 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 
        0: { cellWidth: 50, fontStyle: 'bold' },
        1: { cellWidth: 220 }
      }
    });
    
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Confidential - For Administrative Use Only', 148, 200, { align: 'center' });
    
    return doc;
  };

  // Generate PDF reports for all facilities - Creates actual PDFs now!
  const generateAllReports = async () => {
    try {
      const confirmed = window.confirm('Generate reports for all 17 facilities + 1 admin report?\n\nThis will create 18 PDFs and download as ZIP.\n\nThis may take 30-60 seconds.');
      if (!confirmed) return;

      alert('Generating 18 PDFs... Please wait, this may take up to 60 seconds.');
      
      const latestWeek = Math.max(...allWeeklyData.map(d => parseInt(d.week)));
      const latestWeekData = allWeeklyData.filter(d => parseInt(d.week) === latestWeek);
      
      const zip = new JSZip();
      
      for (const facility of latestWeekData) {
        const facilityHistory = allWeeklyData
          .filter(d => d.facility === facility.facility)
          .sort((a, b) => parseInt(a.week) - parseInt(b.week))
          .slice(-4);
        
        const pdf = createDORPDF(facility, facilityHistory);
        const pdfBlob = pdf.output('blob');
        const filename = `DOR_${facility.facility.replace(/ /g, '_')}_Week_${latestWeek}.pdf`;
        zip.file(filename, pdfBlob);
      }
      
      const adminPdf = createAdminPDF(latestWeekData);
      const adminPdfBlob = adminPdf.output('blob');
      zip.file(`ADMIN_Weekly_Report_Week_${latestWeek}.pdf`, adminPdfBlob);
      
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Weekly_Reports_Week_${latestWeek}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      
      alert(`✅ Success! Downloaded ZIP with:\n• 17 DOR Reports\n• 1 Admin Report\n\nCheck your Downloads folder!`);
      
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Error generating reports. Please try again.');
    }
  };

  // Generate PDF report for DOR's facility only  
  const generateMyReport = async () => {
    try {
      const confirmed = window.confirm(`Generate your report for ${restrictedFacility}?`);
      if (!confirmed) return;
      
      alert('Generating your PDF... Please wait.');
      
      const latestWeek = Math.max(...allWeeklyData.map(d => parseInt(d.week)));
      const myData = allWeeklyData.filter(d => d.facility === restrictedFacility && parseInt(d.week) === latestWeek)[0];
      
      if (!myData) {
        alert('❌ No data found for your facility this week.');
        return;
      }
      
      const facilityHistory = allWeeklyData
        .filter(d => d.facility === restrictedFacility)
        .sort((a, b) => parseInt(a.week) - parseInt(b.week))
        .slice(-4);
      
      const pdf = createDORPDF(myData, facilityHistory);
      pdf.save(`DOR_${restrictedFacility.replace(/ /g, '_')}_Week_${latestWeek}.pdf`);
      
      alert(`✅ Success! Downloaded your report for Week ${latestWeek}!\n\nCheck your Downloads folder.`);
      
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Error generating report. Please try again.');
    }
  };
    try {
      const confirmed = window.confirm('Generate reports for all 17 facilities + 1 admin report?\n\nThis will download a ZIP file with 18 text-based reports.\n\nFor professional PDFs, use: python3 generate_weekly_reports.py');
      if (!confirmed) return;

      alert('Generating reports... This will take a moment.');
      
      // Get latest week data
      const latestWeek = Math.max(...allWeeklyData.map(d => parseInt(d.week)));
      const latestWeekData = allWeeklyData.filter(d => parseInt(d.week) === latestWeek);
      
      // For now, just download the Python script instructions
      const instructions = `TheraScope Weekly Reports - Week ${latestWeek}

INSTRUCTIONS:
To generate professional PDF reports, run this command:

  python3 generate_weekly_reports.py

This will create:
• 17 DOR Reports (one per facility) 
• 1 Admin Report (regional summary)
• Packaged in: Weekly_Reports_Week_${latestWeek}.zip

FACILITIES (${latestWeekData.length} total):
${latestWeekData.map(f => `  • ${f.facility}`).join('\n')}

The Python script is in your GitHub repo root.
Contact support if you need help running it.`;

      const blob = new Blob([instructions], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Report_Instructions_Week_${latestWeek}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      
      alert(`✅ Instructions downloaded!\n\nTo generate professional PDFs:\n1. Open your terminal\n2. Run: python3 generate_weekly_reports.py\n3. Download the ZIP file\n\nOr use the Python script from your repo!`);
      
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Error. Please use: python3 generate_weekly_reports.py');
    }
  };

  // Generate PDF report for DOR's facility only
  const generateMyReport = async () => {
    try {
      const confirmed = window.confirm(`Generate report for ${restrictedFacility}?\n\nThis will create a text-based report.\n\nFor professional PDF, contact your admin.`);
      if (!confirmed) return;
      
      const latestWeek = Math.max(...allWeeklyData.map(d => parseInt(d.week)));
      const myData = allWeeklyData.filter(d => d.facility === restrictedFacility && parseInt(d.week) === latestWeek)[0];
      
      if (!myData) {
        alert('❌ No data found for your facility this week.');
        return;
      }
      
      const facilityHistory = allWeeklyData
        .filter(d => d.facility === restrictedFacility)
        .sort((a, b) => parseInt(a.week) - parseInt(b.week))
        .slice(-4);
      
      const medBPct = myData.medBEligible > 0 ? Math.round((myData.medBCaseload / myData.medBEligible) * 100) : 0;
      
      const report = `
═══════════════════════════════════════════════════════════
                      TheraScope
              Weekly Performance Report
═══════════════════════════════════════════════════════════

Facility: ${restrictedFacility}
Report Week: ${myData.date}
Generated: ${new Date().toLocaleDateString()}

═══════════════════════════════════════════════════════════
                  PERFORMANCE METRICS
═══════════════════════════════════════════════════════════

Metric                  Your Result    Goal      Status
────────────────────────────────────────────────────────────
Productivity            ${myData.productivity}%           >= 84%      ${myData.productivity >= 84 ? '✓ Met' : '✗ Not Met'}
CPM                     $${myData.cpm}          <= $1.45    ${myData.cpm <= 1.45 ? '✓ Met' : '✗ Not Met'}
Med B Performance       ${medBPct}%            -         -

═══════════════════════════════════════════════════════════
                  DOR-SPECIFIC METRICS
═══════════════════════════════════════════════════════════

Med B Units Billed:     ${myData.medBUnitsThisWeek || 'N/A'}
Units Per Visit:        ${myData.unitsPerVisit || 'N/A'}
Mode of Treatment:      ${myData.modeOfTreatment || 0}%

═══════════════════════════════════════════════════════════
                    4-WEEK TREND
═══════════════════════════════════════════════════════════

Week         Productivity    CPM      Med B Caseload
────────────────────────────────────────────────────────────
${facilityHistory.map(h => `${h.date}    ${h.productivity}%           $${h.cpm}    ${h.medBCaseload}`).join('\n')}

═══════════════════════════════════════════════════════════
Confidential - For Director of Rehab Only
For professional PDF format, contact your administrator
═══════════════════════════════════════════════════════════
`;

      const blob = new Blob([report], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${restrictedFacility.replace(/ /g, '_')}_Report_Week_${latestWeek}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      
      alert(`✅ Report downloaded!\n\nCheck your Downloads folder for:\n${restrictedFacility.replace(/ /g, '_')}_Report_Week_${latestWeek}.txt\n\nFor professional PDF format, contact your admin.`);
      
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Error generating report. Please contact your admin.');
    }
  };

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="fixed inset-0 opacity-20">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, rgba(100, 200, 255, 0.3) 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}></div>
        </div>

        <div className="relative max-w-md w-full">
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl">
            {/* Logo */}
            <div className="flex flex-col items-center mb-8">
              <div className="relative mb-4">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-400 to-teal-500 rounded-2xl blur-lg opacity-75 animate-pulse"></div>
                <div className="relative w-16 h-16 bg-gradient-to-br from-cyan-400 via-teal-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-2xl">
                  <Zap className="w-10 h-10 text-white" strokeWidth={2.5} />
                </div>
              </div>
              <h1 className="text-3xl font-black bg-gradient-to-r from-cyan-300 via-teal-300 to-emerald-300 bg-clip-text text-transparent">
                TheraScope
              </h1>
              <p className="text-slate-400 text-sm mt-2">Secure Access Portal</p>
            </div>

            {!loginType ? (
              /* Login Type Selection */
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-white text-center mb-6">Select Access Type</h2>
                <button
                  onClick={() => setLoginType('admin')}
                  className="w-full p-6 bg-gradient-to-r from-cyan-500/20 to-teal-500/20 hover:from-cyan-500/30 hover:to-teal-500/30 border border-cyan-500/30 hover:border-cyan-500/50 rounded-2xl transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-white group-hover:text-cyan-300 transition-colors">Admin Access</div>
                      <div className="text-sm text-slate-400">Full system access</div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setLoginType('dor')}
                  className="w-full p-6 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 hover:from-blue-500/30 hover:to-indigo-500/30 border border-blue-500/30 hover:border-blue-500/50 rounded-2xl transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-white group-hover:text-blue-300 transition-colors">DOR Access</div>
                      <div className="text-sm text-slate-400">Facility-specific access</div>
                    </div>
                  </div>
                </button>
              </div>
            ) : (
              /* Password Entry Form */
              <form onSubmit={handlePasswordSubmit} className="space-y-6">
                <button
                  type="button"
                  onClick={() => {
                    setLoginType(null);
                    setPasswordAttempt('');
                    setSelectedFacilityForLogin('');
                  }}
                  className="text-sm text-slate-400 hover:text-white flex items-center gap-2 mb-4"
                >
                  ← Back
                </button>

                <div>
                  <h2 className="text-xl font-bold text-white mb-2">
                    {loginType === 'admin' ? 'Admin Login' : 'DOR Login'}
                  </h2>
                  <p className="text-sm text-slate-400 mb-6">
                    {loginType === 'admin' ? 'Enter admin password' : 'Select facility and enter DOR password'}
                  </p>
                </div>

                {loginType === 'dor' && (
                  <div>
                    <label className="block text-sm font-bold text-white mb-2">Select Facility</label>
                    <select
                      value={selectedFacilityForLogin}
                      onChange={(e) => setSelectedFacilityForLogin(e.target.value)}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="" className="bg-slate-800">Select a facility...</option>
                      {allFacilities.map(facility => (
                        <option key={facility} value={facility} className="bg-slate-800">{facility}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-white mb-2">Password</label>
                  <input
                    type="password"
                    value={passwordAttempt}
                    onChange={(e) => setPasswordAttempt(e.target.value)}
                    placeholder="Enter password"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full px-6 py-4 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white font-bold rounded-xl transition-all shadow-lg"
                >
                  Sign In
                </button>
              </form>
            )}
          </div>

          <p className="text-center text-slate-500 text-sm mt-6">
            TheraScope Analytics Platform © 2025
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="fixed inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, rgba(100, 200, 255, 0.3) 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}></div>
      </div>

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
            
            <div className="flex gap-3 items-center">
              {!isRestrictedView && (
                <button
                  onClick={generateAllReports}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all shadow-lg font-semibold text-sm flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Generate Reports
                </button>
              )}
              
              <a 
                href={WEEKLY_REPORT_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-xl hover:from-cyan-600 hover:to-teal-600 transition-all shadow-lg font-semibold text-sm flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Submit Weekly Report
              </a>
              
              {!isRestrictedView && (
                <button
                  onClick={() => {
                    const password = prompt('Enter admin password:');
                    if (password === 'WalkTalkWin') {
                      setShowNetHealthModal(true);
                    } else if (password !== null) {
                      alert('Incorrect password');
                    }
                  }}
                  className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center transition-all border border-white/10 hover:border-white/20"
                  title="Admin Tools"
                >
                  <svg className="w-5 h-5 text-slate-400 hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="relative max-w-7xl mx-auto px-6 py-10">
        {isRestrictedView && (
          <div className="mb-6 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border border-blue-500/30 rounded-2xl p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Building2 className="w-8 h-8 text-blue-400" />
                <div>
                  <h2 className="text-2xl font-black text-white">{restrictedFacility}</h2>
                  <p className="text-blue-300 text-sm">Facility Dashboard View</p>
                </div>
              </div>
              <button
                onClick={generateMyReport}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg font-semibold text-sm flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Generate My Report
              </button>
            </div>
          </div>
        )}
        
        <div className="flex gap-3 mb-10 bg-white/5 backdrop-blur-xl rounded-3xl p-2 shadow-2xl border border-white/10 overflow-x-auto">
          {[
            ...(!isRestrictedView ? [{ id: 'overview', label: 'Overview', icon: Activity }] : []),
            ...(!isRestrictedView ? [{ id: 'rankings', label: 'Rankings', icon: Trophy }] : []),
            { id: 'facilities', label: isRestrictedView ? 'My Facility' : 'All Facilities', icon: Building2 },
            { id: 'resources', label: 'Resources', icon: FileText }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id)}
              className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-bold transition-all duration-300 flex-1 justify-center whitespace-nowrap ${
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

        {(activeView === 'overview' || activeView === 'facilities' || activeView === 'rankings') && (
          <div className="mb-6 flex items-center gap-4 flex-wrap">
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

            {activeView === 'facilities' && (
              <>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="px-6 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl text-white font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="all" className="bg-slate-800">All Regions</option>
                  <option value="Golden Coast" className="bg-slate-800">Golden Coast</option>
                  <option value="Overland" className="bg-slate-800">Overland</option>
                </select>
                {selectedRegion !== 'all' && (
                  <button
                    onClick={() => setSelectedRegion('all')}
                    className="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold rounded-2xl hover:from-red-600 hover:to-pink-600 transition-all duration-300 shadow-lg hover:shadow-red-500/50 flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Clear Filter
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {activeView === 'overview' && (
          <div className="space-y-10 animate-fadeIn">
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

            <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${isRestrictedView ? 'relative' : ''}`}>
              {isRestrictedView && (
                <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md z-10 rounded-3xl flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-xl font-bold text-white mb-2">Regional Metrics</p>
                    <p className="text-slate-400">Access restricted to facility view only</p>
                  </div>
                </div>
              )}
              <div 
                onClick={() => {
                  setSelectedRegion('Golden Coast');
                  setActiveView('facilities');
                }}
                className="bg-gradient-to-br from-amber-900/40 to-yellow-900/40 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl cursor-pointer hover:border-amber-400/50 hover:shadow-amber-500/20 hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02]"
              >
                <div className="flex items-center gap-3 mb-6">
                  <MapPin className="w-8 h-8 text-amber-400" strokeWidth={2.5} />
                  <div>
                    <h3 className="text-2xl font-black text-white">Golden Coast</h3>
                    <p className="text-amber-200 font-medium">{goldenCoastData.length} facilities • Click to view</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="text-xs text-amber-200 font-bold uppercase mb-1">Avg Productivity</div>
                    <div className="text-3xl font-black text-white">
                      {Math.round(goldenCoastData.reduce((s, f) => s + f.productivity, 0) / goldenCoastData.length)}%
                    </div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="text-xs text-amber-200 font-bold uppercase mb-1">Avg CPM</div>
                    <div className="text-3xl font-black text-white">
                      ${(goldenCoastData.reduce((s, f) => s + f.cpm, 0) / goldenCoastData.length).toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="text-xs text-amber-200 font-bold uppercase mb-1">Med B Performance</div>
                    <div className="text-3xl font-black text-white">
                      {(() => {
                        const totalCaseload = goldenCoastData.reduce((s, f) => s + f.medBCaseload, 0);
                        const totalEligible = goldenCoastData.reduce((s, f) => s + f.medBEligible, 0);
                        return totalEligible > 0 ? Math.round((totalCaseload / totalEligible) * 100) : 0;
                      })()}%
                    </div>
                  </div>
                  {/* 4th Metric - Admin: Med B Units, DOR: Mode of Treatment */}
                  {!isRestrictedView ? (
                    <div className="bg-white/10 rounded-xl p-4">
                      <div className="text-xs text-amber-200 font-bold uppercase mb-1">Med B Units</div>
                      <div className="text-3xl font-black text-white">
                        {Math.round(goldenCoastData.reduce((s, f) => s + (f.medBUnitsThisWeek || 0), 0))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white/10 rounded-xl p-4">
                      <div className="text-xs text-amber-200 font-bold uppercase mb-1">Mode of Treatment</div>
                      <div className="text-3xl font-black text-white">
                        {(() => {
                          const facilitiesWithMode = goldenCoastData.filter(f => f.modeOfTreatment);
                          return facilitiesWithMode.length > 0 
                            ? (facilitiesWithMode.reduce((s, f) => s + f.modeOfTreatment, 0) / facilitiesWithMode.length).toFixed(1)
                            : 0;
                        })()}%
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div 
                onClick={() => {
                  setSelectedRegion('Overland');
                  setActiveView('facilities');
                }}
                className="bg-gradient-to-br from-blue-900/40 to-indigo-900/40 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl cursor-pointer hover:border-blue-400/50 hover:shadow-blue-500/20 hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02]"
              >
                <div className="flex items-center gap-3 mb-6">
                  <MapPin className="w-8 h-8 text-blue-400" strokeWidth={2.5} />
                  <div>
                    <h3 className="text-2xl font-black text-white">Overland</h3>
                    <p className="text-blue-200 font-medium">{overlandData.length} facilities • Click to view</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="text-xs text-blue-200 font-bold uppercase mb-1">Avg Productivity</div>
                    <div className="text-3xl font-black text-white">
                      {Math.round(overlandData.reduce((s, f) => s + f.productivity, 0) / overlandData.length)}%
                    </div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="text-xs text-blue-200 font-bold uppercase mb-1">Avg CPM</div>
                    <div className="text-3xl font-black text-white">
                      ${(overlandData.reduce((s, f) => s + f.cpm, 0) / overlandData.length).toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="text-xs text-blue-200 font-bold uppercase mb-1">Med B Performance</div>
                    <div className="text-3xl font-black text-white">
                      {(() => {
                        const totalCaseload = overlandData.reduce((s, f) => s + f.medBCaseload, 0);
                        const totalEligible = overlandData.reduce((s, f) => s + f.medBEligible, 0);
                        return totalEligible > 0 ? Math.round((totalCaseload / totalEligible) * 100) : 0;
                      })()}%
                    </div>
                  </div>
                  {/* 4th Metric - Admin: Med B Units, DOR: Mode of Treatment */}
                  {!isRestrictedView ? (
                    <div className="bg-white/10 rounded-xl p-4">
                      <div className="text-xs text-blue-200 font-bold uppercase mb-1">Med B Units</div>
                      <div className="text-3xl font-black text-white">
                        {Math.round(overlandData.reduce((s, f) => s + (f.medBUnitsThisWeek || 0), 0))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white/10 rounded-xl p-4">
                      <div className="text-xs text-blue-200 font-bold uppercase mb-1">Mode of Treatment</div>
                      <div className="text-3xl font-black text-white">
                        {(() => {
                          const facilitiesWithMode = overlandData.filter(f => f.modeOfTreatment);
                          return facilitiesWithMode.length > 0 
                            ? (facilitiesWithMode.reduce((s, f) => s + f.modeOfTreatment, 0) / facilitiesWithMode.length).toFixed(1)
                            : 0;
                        })()}%
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

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
                    Showing {allWeeklyData.length} records from your DOR Weekly Reports across 17 facilities with AI-powered insights.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 text-white bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/20">
                      <CheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0" strokeWidth={2.5} />
                      <span className="font-bold">AI Chatbot Assistant</span>
                    </div>
                    <div className="flex items-center gap-3 text-white bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/20">
                      <CheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0" strokeWidth={2.5} />
                      <span className="font-bold">Smart Analytics</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

{activeView === 'rankings' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white/5 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 overflow-hidden">
              <div className="p-8 bg-gradient-to-r from-yellow-900/30 via-amber-900/30 to-orange-900/30 border-b border-white/10">
                <div className="flex items-center gap-4 mb-4">
                  <Trophy className="w-12 h-12 text-yellow-400" strokeWidth={2.5} />
                  <div>
                    <h2 className="text-3xl font-black text-white tracking-tight">Performance Rankings</h2>
                    <p className="text-slate-300 mt-2 text-lg font-medium">
                      Facilities ranked by 4 key performance goals
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="text-xs text-slate-300 font-bold uppercase mb-2">Goal 1</div>
                    <div className="text-sm text-white font-bold">Productivity ≥ 84%</div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="text-xs text-slate-300 font-bold uppercase mb-2">Goal 2</div>
                    <div className="text-sm text-white font-bold">CPM ≤ $1.45</div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="text-xs text-slate-300 font-bold uppercase mb-2">Goal 3</div>
                    <div className="text-sm text-white font-bold">Med B Performance</div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="text-xs text-slate-300 font-bold uppercase mb-2">Goal 4</div>
                    <div className="text-sm text-white font-bold">Mode of Treatment ≥ 5%</div>
                  </div>
                </div>
              </div>

              <div className="p-8">
                {rankedFacilities.map((item, idx) => {
                  const badge = getScoreBadge(item.score);
                  const BadgeIcon = badge.icon;
                  
                  return (
                    <div 
                      key={idx}
                      className={`mb-6 p-8 bg-gradient-to-br ${badge.bgColor} backdrop-blur-sm rounded-3xl border ${badge.borderColor} transition-all duration-300 hover:scale-102 transform`}
                    >
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex items-start gap-5 flex-1">
                          <div className="text-4xl font-black text-white w-12 text-center">
                            #{idx + 1}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 flex-wrap mb-2">
                              <h3 className="text-2xl font-black text-white">{item.facility.facility}</h3>
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                item.facility.region === 'Golden Coast' 
                                  ? 'bg-amber-500/30 text-amber-200 border border-amber-400/50' 
                                  : 'bg-blue-500/30 text-blue-200 border border-blue-400/50'
                              }`}>
                                {item.facility.region}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className={`flex items-center gap-2 px-4 py-2 bg-gradient-to-r ${badge.color} rounded-full`}>
                                <BadgeIcon className="w-5 h-5 text-white" strokeWidth={2.5} />
                                <span className="text-white font-black text-sm">{badge.label}</span>
                              </div>
                              <div className="flex items-center gap-2 text-white font-black text-xl">
                                <span>{item.score}/4</span>
                                <span className="text-slate-400 text-sm">Goals Met</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className={`p-4 rounded-xl border-2 ${item.goals.productivity ? 'bg-emerald-500/20 border-emerald-400/50' : 'bg-slate-500/10 border-slate-400/30'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            {item.goals.productivity ? (
                              <CheckCircle className="w-5 h-5 text-emerald-400" strokeWidth={2.5} />
                            ) : (
                              <div className="w-5 h-5 rounded-full border-2 border-slate-400"></div>
                            )}
                            <div className="text-xs text-slate-300 font-bold uppercase">Productivity</div>
                          </div>
                          <div className={`text-2xl font-black ${item.goals.productivity ? 'text-emerald-300' : 'text-slate-400'}`}>
                            {item.facility.productivity}%
                          </div>
                        </div>

                        <div className={`p-4 rounded-xl border-2 ${item.goals.cpm ? 'bg-emerald-500/20 border-emerald-400/50' : 'bg-slate-500/10 border-slate-400/30'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            {item.goals.cpm ? (
                              <CheckCircle className="w-5 h-5 text-emerald-400" strokeWidth={2.5} />
                            ) : (
                              <div className="w-5 h-5 rounded-full border-2 border-slate-400"></div>
                            )}
                            <div className="text-xs text-slate-300 font-bold uppercase">CPM</div>
                          </div>
                          <div className={`text-2xl font-black ${item.goals.cpm ? 'text-emerald-300' : 'text-slate-400'}`}>
                            ${item.facility.cpm}
                          </div>
                        </div>

                        <div className={`p-4 rounded-xl border-2 ${item.goals.medB ? 'bg-emerald-500/20 border-emerald-400/50' : 'bg-slate-500/10 border-slate-400/30'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            {item.goals.medB ? (
                              <CheckCircle className="w-5 h-5 text-emerald-400" strokeWidth={2.5} />
                            ) : (
                              <div className="w-5 h-5 rounded-full border-2 border-slate-400"></div>
                            )}
                            <div className="text-xs text-slate-300 font-bold uppercase">Med B Performance</div>
                          </div>
                          <div className={`text-2xl font-black ${item.goals.medB ? 'text-emerald-300' : 'text-slate-400'}`}>
                            {item.facility.medBEligible > 0 ? Math.round((item.facility.medBCaseload / item.facility.medBEligible) * 100) : 0}%
                          </div>
                        </div>

                        {/* 4th Metric - Different for Admin vs DOR */}
                        {!isRestrictedView ? (
                          // Admin View: Med B Units This Week
                          <div className="p-4 rounded-xl border-2 bg-blue-500/20 border-blue-400/50">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="text-xs text-slate-300 font-bold uppercase">Med B Units</div>
                            </div>
                            <div className="text-2xl font-black text-blue-300">
                              {item.facility.medBUnitsThisWeek || 0}
                            </div>
                            <div className="text-xs text-slate-400 mt-1">this week</div>
                          </div>
                        ) : (
                          // DOR View: Mode of Treatment (kept for DORs)
                          <div className={`p-4 rounded-xl border-2 ${item.goals.modeOfTreatment ? 'bg-emerald-500/20 border-emerald-400/50' : 'bg-slate-500/10 border-slate-400/30'}`}>
                            <div className="flex items-center gap-2 mb-2">
                              {item.goals.modeOfTreatment ? (
                                <CheckCircle className="w-5 h-5 text-emerald-400" strokeWidth={2.5} />
                              ) : (
                                <div className="w-5 h-5 rounded-full border-2 border-slate-400"></div>
                              )}
                              <div className="text-xs text-slate-300 font-bold uppercase">Mode of Treatment</div>
                            </div>
                            <div className={`text-2xl font-black ${item.goals.modeOfTreatment ? 'text-emerald-300' : 'text-slate-400'}`}>
                              {item.facility.modeOfTreatment !== undefined ? item.facility.modeOfTreatment : 0}%
                            </div>
                          </div>
                        )}
                      </div>

                      {/* DOR-Only Additional Metrics */}
                      {isRestrictedView && (
                        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/10">
                          <div className="p-4 rounded-xl border-2 bg-purple-500/20 border-purple-400/50">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="text-xs text-slate-300 font-bold uppercase">Units Per Visit</div>
                            </div>
                            <div className="text-2xl font-black text-purple-300">
                              {item.facility.unitsPerVisit ? item.facility.unitsPerVisit.toFixed(2) : '0.00'}
                            </div>
                            <div className="text-xs text-slate-400 mt-1">operational metric</div>
                          </div>

                          <div className="p-4 rounded-xl border-2 bg-blue-500/20 border-blue-400/50">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="text-xs text-slate-300 font-bold uppercase">Med B Units</div>
                            </div>
                            <div className="text-2xl font-black text-blue-300">
                              {item.facility.medBUnitsThisWeek || 0}
                            </div>
                            <div className="text-xs text-slate-400 mt-1">this week</div>
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

{activeView === 'facilities' && (
          <div className="space-y-6 animate-fadeIn">
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

            <div className="bg-white/5 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 overflow-hidden">
              <div className="p-8 bg-gradient-to-r from-cyan-900/30 to-teal-900/30 border-b border-white/10">
                <h2 className="text-3xl font-black text-white tracking-tight">Facility Performance</h2>
                <p className="text-slate-300 mt-2 text-lg font-medium">
                  Showing {filteredFacilities.length} facilities {selectedRegion !== 'all' && `in ${selectedRegion}`} • Click to view historical data
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
                              <div className="flex items-center gap-3">
                                <h3 className="text-2xl font-black text-white tracking-tight">{facility.facility}</h3>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                  facility.region === 'Golden Coast' 
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30' 
                                    : 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
                                }`}>
                                  {facility.region}
                                </span>
                              </div>
                              <p className="text-sm text-slate-400 font-medium mt-1">
                                {history.length} weeks of data • {facility.date}
                              </p>
                            </div>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-6 h-6 text-cyan-400" />
                          ) : (
                            <ChevronDown className="w-6 h-6 text-slate-400" />
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
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

                          <div className={`bg-gradient-to-br ${facility.cpm <= 1.45 ? 'from-emerald-500/20 to-teal-500/20 border-emerald-400/30' : 'from-rose-500/20 to-red-500/20 border-rose-400/30'} backdrop-blur-sm rounded-2xl p-6 border transform hover:scale-105 transition-all duration-300`}>
                            <div className="flex items-center gap-3 mb-3">
                              <PieChart className={`w-5 h-5 ${getCPMColor(facility.cpm)}`} strokeWidth={2.5} />
                              <div className="text-xs text-slate-300 font-bold uppercase tracking-wider">CPM</div>
                            </div>
                            <div className={`text-4xl font-black ${getCPMColor(facility.cpm)}`}>
                              ${facility.cpm}
                            </div>
                            <div className="text-xs text-slate-400 mt-2 font-medium">
                              {facility.cpm <= 1.45 ? 'Under target ✓' : 'Above target'}
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

                          {/* 5th Metric - Different for Admin vs DOR */}
                          {!isRestrictedView ? (
                            // Admin View: Med B Units This Week
                            <div className="bg-gradient-to-br from-blue-500/20 to-indigo-500/20 backdrop-blur-sm rounded-2xl p-6 border border-blue-400/30 transform hover:scale-105 transition-all duration-300">
                              <div className="flex items-center gap-3 mb-3">
                                <BarChart3 className="w-5 h-5 text-blue-300" strokeWidth={2.5} />
                                <div className="text-xs text-slate-300 font-bold uppercase tracking-wider">Med B Units</div>
                              </div>
                              <div className="text-4xl font-black text-blue-300">{facility.medBUnitsThisWeek || 0}</div>
                              <div className="text-xs text-slate-400 mt-2 font-medium">This week</div>
                            </div>
                          ) : (
                            // DOR View: Mode of Treatment
                            facility.modeOfTreatment !== undefined && (
                              <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 backdrop-blur-sm rounded-2xl p-6 border border-orange-400/30 transform hover:scale-105 transition-all duration-300">
                                <div className="flex items-center gap-3 mb-3">
                                  <Activity className="w-5 h-5 text-orange-300" strokeWidth={2.5} />
                                  <div className="text-xs text-slate-300 font-bold uppercase tracking-wider">Mode of Tx</div>
                                </div>
                                <div className="text-4xl font-black text-orange-300">{facility.modeOfTreatment}%</div>
                                <div className="text-xs text-slate-400 mt-2 font-medium">Group/Concurrent</div>
                              </div>
                            )
                          )}
                        </div>

                        {/* DOR-Only Additional Metrics Row */}
                        {isRestrictedView && (
                          <div className="grid grid-cols-2 gap-5 mt-5 pt-5 border-t border-white/10">
                            <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-sm rounded-2xl p-6 border border-purple-400/30 transform hover:scale-105 transition-all duration-300">
                              <div className="flex items-center gap-3 mb-3">
                                <Activity className="w-5 h-5 text-purple-300" strokeWidth={2.5} />
                                <div className="text-xs text-slate-300 font-bold uppercase tracking-wider">Units Per Visit</div>
                              </div>
                              <div className="text-4xl font-black text-purple-300">
                                {facility.unitsPerVisit ? facility.unitsPerVisit.toFixed(2) : '0.00'}
                              </div>
                              <div className="text-xs text-slate-400 mt-2 font-medium">Operational metric</div>
                            </div>

                            <div className="bg-gradient-to-br from-blue-500/20 to-indigo-500/20 backdrop-blur-sm rounded-2xl p-6 border border-blue-400/30 transform hover:scale-105 transition-all duration-300">
                              <div className="flex items-center gap-3 mb-3">
                                <BarChart3 className="w-5 h-5 text-blue-300" strokeWidth={2.5} />
                                <div className="text-xs text-slate-300 font-bold uppercase tracking-wider">Med B Units</div>
                              </div>
                              <div className="text-4xl font-black text-blue-300">{facility.medBUnitsThisWeek || 0}</div>
                              <div className="text-xs text-slate-400 mt-2 font-medium">This week</div>
                            </div>
                          </div>
                        )}
                      </div>

                      {isExpanded && (
                        <div className="bg-white/3 p-8 border-t border-white/10 animate-fadeIn">
                          <div className="flex items-center justify-between mb-6">
                            <h4 className="text-xl font-bold text-white">Historical Performance</h4>
                            <div className="flex gap-2 bg-white/5 rounded-xl p-1">
                              <button
                                onClick={() => setHistoricalView('weekly')}
                                className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                  historicalView === 'weekly'
                                    ? 'bg-cyan-500 text-white'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                Weekly
                              </button>
                              <button
                                onClick={() => setHistoricalView('monthly')}
                                className={`px-4 py-2 rounded-lg font-bold transition-all ${
                                  historicalView === 'monthly'
                                    ? 'bg-cyan-500 text-white'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                Monthly
                              </button>
                            </div>
                          </div>

                          {historicalView === 'weekly' ? (
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead>
                                  <tr className="text-left border-b border-white/10">
                                    <th className="pb-4 text-sm font-bold text-slate-300 uppercase tracking-wider">Week</th>
                                    <th className="pb-4 text-sm font-bold text-slate-300 uppercase tracking-wider">Date</th>
                                    <th className="pb-4 text-sm font-bold text-slate-300 uppercase tracking-wider">Productivity</th>
                                    <th className="pb-4 text-sm font-bold text-slate-300 uppercase tracking-wider">CPM</th>
                                    <th className="pb-4 text-sm font-bold text-slate-300 uppercase tracking-wider">Med B Eligible</th>
                                    <th className="pb-4 text-sm font-bold text-slate-300 uppercase tracking-wider">On Caseload</th>
                                    {history[0].modeOfTreatment !== undefined && (
                                      <th className="pb-4 text-sm font-bold text-slate-300 uppercase tracking-wider">Mode of Tx</th>
                                    )}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                  {history.map((record, idx) => (
                                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                                      <td className="py-4 text-white font-bold">{record.week}</td>
                                      <td className="py-4 text-slate-300 font-medium">{record.date}</td>
                                      <td className={`py-4 font-bold ${getProductivityColor(record.productivity)}`}>
                                        {record.productivity}%
                                      </td>
                                      <td className={`py-4 font-bold ${getCPMColor(record.cpm)}`}>
                                        ${record.cpm}
                                      </td>
                                      <td className="py-4 text-purple-300 font-bold">{record.medBEligible}</td>
                                      <td className="py-4 text-blue-300 font-bold">{record.medBCaseload}</td>
                                      {record.modeOfTreatment !== undefined && (
                                        <td className="py-4 text-orange-300 font-bold">{record.modeOfTreatment}%</td>
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {getMonthlyData(facility.facility).map((monthData, idx) => (
                                <div
                                  key={idx}
                                  className="bg-white/5 rounded-2xl p-6 border border-white/10 hover:border-cyan-400/30 transition-all"
                                >
                                  <div className="flex items-center justify-between mb-4">
                                    <div>
                                      <h5 className="text-xl font-black text-white">{monthData.month}</h5>
                                      <p className="text-sm text-slate-400">Average of {monthData.weekCount} weeks</p>
                                    </div>
                                    {idx > 0 && (
                                      <div className="text-right">
                                        {monthData.productivityChange !== 0 && (
                                          <div className={`text-sm font-bold ${monthData.productivityChange > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {monthData.productivityChange > 0 ? '↗️' : '↘️'} {Math.abs(monthData.productivityChange).toFixed(1)}% productivity
                                          </div>
                                        )}
                                        {monthData.cpmChange !== 0 && (
                                          <div className={`text-sm font-bold ${monthData.cpmChange < 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {monthData.cpmChange < 0 ? '↗️' : '↘️'} ${Math.abs(monthData.cpmChange).toFixed(2)} CPM
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                    <div className="bg-white/5 rounded-xl p-4">
                                      <div className="text-xs text-slate-400 mb-1">Productivity</div>
                                      <div className={`text-2xl font-black ${getProductivityColor(monthData.productivity)}`}>
                                        {monthData.productivity.toFixed(1)}%
                                      </div>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-4">
                                      <div className="text-xs text-slate-400 mb-1">CPM</div>
                                      <div className={`text-2xl font-black ${getCPMColor(monthData.cpm)}`}>
                                        ${monthData.cpm.toFixed(2)}
                                      </div>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-4">
                                      <div className="text-xs text-slate-400 mb-1">Med B Eligible</div>
                                      <div className="text-2xl font-black text-purple-300">
                                        {monthData.medBEligible}
                                      </div>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-4">
                                      <div className="text-xs text-slate-400 mb-1">On Caseload</div>
                                      <div className="text-2xl font-black text-blue-300">
                                        {monthData.medBCaseload}
                                      </div>
                                    </div>
                                    {monthData.modeOfTreatment !== undefined && (
                                      <div className="bg-white/5 rounded-xl p-4">
                                        <div className="text-xs text-slate-400 mb-1">Mode of Tx</div>
                                        <div className="text-2xl font-black text-orange-300">
                                          {monthData.modeOfTreatment.toFixed(1)}%
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeView === 'resources' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Info banner */}
            <div className="bg-gradient-to-r from-cyan-500/10 to-teal-500/10 backdrop-blur-xl rounded-2xl p-6 border border-cyan-400/30">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">Personal Resources</h3>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    Upload therapy templates, guidelines, and documentation for quick access. 
                    Resources are stored locally in your browser. 
                    <span className="text-cyan-300"> Max file size: 5MB</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-black text-white tracking-tight">Resources</h2>
                  <p className="text-slate-300 mt-2 text-lg font-medium">Upload and manage therapy resources & documentation</p>
                </div>
                <label className="relative group cursor-pointer">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-2xl blur opacity-75 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl hover:from-emerald-600 hover:to-teal-600 transition-all duration-300 shadow-xl transform hover:scale-105 font-bold">
                    <Upload className="w-5 h-5" />
                    Upload Resource
                  </div>
                  <input type="file" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>

              <div className="flex gap-4 mb-8">
                <div className="flex-1 relative">
                  <Search className="w-5 h-5 text-slate-400 absolute left-5 top-1/2 transform -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search resources..."
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
                {isLoadingDocs ? (
                  <div className="text-center py-12">
                    <div className="inline-block w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-400 mt-4">Loading documents...</p>
                  </div>
                ) : filteredDocs.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400 text-lg">No resources uploaded yet</p>
                    <p className="text-slate-500 text-sm mt-2">Click "Upload Resource" to add your first file</p>
                  </div>
                ) : (
                  filteredDocs.map((doc, idx) => (
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
                        <button 
                          onClick={() => handleViewDocument(doc)}
                          className="p-3 text-slate-300 hover:bg-white/10 hover:text-cyan-400 rounded-xl transition-all border border-transparent hover:border-cyan-400/50"
                          title="View/Open"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleDownloadDocument(doc)}
                          className="p-3 text-slate-300 hover:bg-white/10 hover:text-emerald-400 rounded-xl transition-all border border-transparent hover:border-emerald-400/50"
                          title="Download"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="p-3 text-slate-300 hover:bg-white/10 hover:text-rose-400 rounded-xl transition-all border border-transparent hover:border-rose-400/50"
                          title="Delete"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Chatbot */}
      <div className="fixed bottom-6 right-6 z-50">
        {chatOpen ? (
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl shadow-2xl border border-white/20 w-96 h-[600px] flex flex-col overflow-hidden">
            {/* Chat Header */}
            <div className="bg-gradient-to-r from-cyan-500 to-teal-500 p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-white font-black text-lg">AI Assistant</h3>
                  <p className="text-cyan-100 text-xs font-medium">Powered by TheraScope</p>
                </div>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="text-white hover:bg-white/20 rounded-xl p-2 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl p-4 ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white'
                        : 'bg-white/10 text-slate-200 backdrop-blur-sm border border-white/20'
                    }`}
                  >
                    <p className="text-sm font-medium whitespace-pre-line">{msg.content}</p>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white/10 text-slate-200 backdrop-blur-sm border border-white/20 rounded-2xl p-4">
                    <div className="flex gap-2">
                      <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatMessagesEndRef} />
            </div>

            {/* Chat Input */}
            <form onSubmit={handleChatSubmit} className="p-4 bg-white/5 backdrop-blur-sm border-t border-white/10">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask me anything..."
                  className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-medium"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="px-4 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-xl hover:from-cyan-600 hover:to-teal-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>
        ) : (
          <button
            onClick={() => setChatOpen(true)}
            className="relative group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-teal-500 rounded-full blur-lg opacity-75 group-hover:opacity-100 animate-pulse transition-opacity"></div>
            <div className="relative w-16 h-16 bg-gradient-to-r from-cyan-500 to-teal-500 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform duration-300">
              <MessageCircle className="w-8 h-8 text-white" strokeWidth={2.5} />
            </div>
          </button>
        )}
      </div>

      {/* NetHealth Upload Modal */}
      {showNetHealthModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 max-w-3xl w-full border border-white/20 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-500 rounded-2xl flex items-center justify-center">
                  <FileSpreadsheet className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white">Data Processing Tools</h2>
                  <p className="text-slate-400 text-sm">Automated weekly data workflow</p>
                </div>
              </div>
              <button
                onClick={() => setShowNetHealthModal(false)}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Instructions */}
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-emerald-400 mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Quick 5-Minute Weekly Process
                </h3>
                <ol className="space-y-3 text-slate-300">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white text-sm font-bold">1</span>
                    <span><strong className="text-white">Export 4 Reports</strong> (all facilities, current week)</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white text-sm font-bold">2</span>
                    <div>
                      <strong className="text-white">Run the data processor:</strong>
                      <code className="block mt-2 bg-black/50 px-4 py-2 rounded-lg text-sm font-mono text-emerald-300">
                        python process_nethealth_reports.py prod.xlsx cpm.xlsx census.xlsx mode.xlsx
                      </code>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white text-sm font-bold">3</span>
                    <span><strong className="text-white">Upload the generated data file</strong> to repository</span>
                  </li>
                </ol>
              </div>

              {/* Required Reports */}
              <div className="bg-white/5 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Required Data Sources:</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="text-sm font-bold text-cyan-400 mb-1">1. Productivity Data</div>
                    <div className="text-xs text-slate-400">Staff efficiency metrics</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="text-sm font-bold text-purple-400 mb-1">2. Cost Data</div>
                    <div className="text-xs text-slate-400">Financial performance metrics</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="text-sm font-bold text-pink-400 mb-1">3. Census Data</div>
                    <div className="text-xs text-slate-400">Patient population metrics</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="text-sm font-bold text-amber-400 mb-1">4. Treatment Data</div>
                    <div className="text-xs text-slate-400">Care delivery metrics</div>
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setShowNetHealthModal(false)}
                className="w-full px-6 py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl transition-all"
              >
                Close
              </button>
        </div>
    </div>
  </div>
  )}
}
