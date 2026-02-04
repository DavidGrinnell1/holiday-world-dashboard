import { useState, useEffect } from 'react';
import Head from 'next/head';
import Papa from 'papaparse';

const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRkOJoNqbem9kUXbfFV0UkMzDr6GlBt6zaio_WYLnDhYduZtfSWEzJxjI83NNTFZU_rV4atXkuEJp3k/pub?output=csv";
const SHEET_EDIT_URL = "https://docs.google.com/spreadsheets/d/1LVtu5MNBQtwSQJKZlMJecnsHJ6NWdn6Fd89Ef2tX-iY/edit?usp=sharing";

const categoryColors = {
  "Recruitment": { bg: "#FEF3C7", border: "#F59E0B", text: "#92400E" },
  "Trip Packages": { bg: "#E0E7FF", border: "#6366F1", text: "#3730A3" },
  "Start Planning": { bg: "#D1FAE5", border: "#10B981", text: "#065F46" },
  "Buy Early": { bg: "#DBEAFE", border: "#3B82F6", text: "#1E40AF" },
  "Purchase": { bg: "#FCE7F3", border: "#EC4899", text: "#9D174D" },
  "Events": { bg: "#FEE2E2", border: "#EF4444", text: "#991B1B" },
};

const statusConfig = {
  "Not Started": { bg: "bg-slate-500/20", text: "text-slate-400", dot: "bg-slate-400" },
  "In Progress": { bg: "bg-amber-500/20", text: "text-amber-400", dot: "bg-amber-400" },
  "Done": { bg: "bg-emerald-500/20", text: "text-emerald-400", dot: "bg-emerald-400" },
};

const getCategory = (campaign) => {
  if (campaign.includes("Recruitment")) return "Recruitment";
  if (campaign.includes("Trip Packages") || campaign.includes("Cottages")) return "Trip Packages";
  if (campaign.includes("Start Planning")) return "Start Planning";
  if (campaign.includes("Buy Early")) return "Buy Early";
  if (campaign.includes("Buy Now") || campaign.includes("Buy Weekends") || campaign.includes("Final Push")) return "Purchase";
  return "Events";
};

export default function Dashboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [expandedCampaign, setExpandedCampaign] = useState(null);
  const today = new Date();

  const fetchData = async () => {
    try {
      const response = await fetch(SHEET_URL);
      const csvText = await response.text();
      
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const parsed = results.data.map((row, idx) => ({
            id: idx + 1,
            campaign: row['Campaign'] || '',
            type: row['Deliverable Type'] || '',
            milestone: row['Milestone'] || '',
            status: row['Status'] || 'Not Started',
            date: row['Milestone Date'] || '',
            dueDate: row['Due Date (Assets)'] || '',
            startDate: row['Campaign Start'] || '',
            category: getCategory(row['Campaign'] || ''),
          })).filter(row => row.campaign);
          
          setData(parsed);
          setLastUpdated(new Date());
          setLoading(false);
          setError(null);
        },
        error: (err) => {
          setError('Failed to parse spreadsheet');
          setLoading(false);
        }
      });
    } catch (err) {
      setError('Failed to fetch spreadsheet');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return new Date(parts[2], parts[0] - 1, parts[1]);
    }
    return new Date(dateStr);
  };

  const formatDate = (dateStr) => {
    const date = parseDate(dateStr);
    if (!date || isNaN(date)) return dateStr;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  
  const formatDateLong = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };
  
  const isPastDue = (dateStr) => {
    const date = parseDate(dateStr);
    if (!date || isNaN(date)) return false;
    return date < today;
  };
  
  const isUpcoming = (dateStr) => {
    const date = parseDate(dateStr);
    if (!date || isNaN(date)) return false;
    const twoWeeks = new Date(today);
    twoWeeks.setDate(twoWeeks.getDate() + 14);
    return date >= today && date <= twoWeeks;
  };

  const categories = [...new Set(data.map(d => d.category))];
  const campaigns = [...new Set(data.map(d => d.campaign))];
  
  const normalizeStatus = (s) => (s || '').toLowerCase().trim();
  
  const upcomingMilestones = data.filter(d => isUpcoming(d.date) && normalizeStatus(d.status) !== 'done').sort((a, b) => {
    const dateA = parseDate(a.date);
    const dateB = parseDate(b.date);
    return (dateA || 0) - (dateB || 0);
  }).slice(0, 8);
  
  const attentionRequired = data.filter(d => isPastDue(d.date) && normalizeStatus(d.status) !== 'done');
  const inProgressItems = data.filter(d => normalizeStatus(d.status) === 'in progress');
  const completedItems = data.filter(d => normalizeStatus(d.status) === 'done');
  
  const campaignProgress = campaigns.map(campaign => {
    const items = data.filter(d => d.campaign === campaign);
    if (items.length === 0) return null;
    const completed = items.filter(d => normalizeStatus(d.status) === 'done').length;
    const inProgress = items.filter(d => normalizeStatus(d.status) === 'in progress').length;
    return { 
      campaign, 
      category: items[0].category, 
      total: items.length, 
      completed,
      inProgress,
      progress: (completed / items.length) * 100, 
      startDate: items[0].startDate, 
      dueDate: items[0].dueDate 
    };
  }).filter(Boolean).sort((a, b) => {
    const dateA = parseDate(a.startDate);
    const dateB = parseDate(b.startDate);
    return (dateA || 0) - (dateB || 0);
  });

  const StatusBadge = ({ status }) => {
    const config = statusConfig[status] || statusConfig["Not Started"];
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></span>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Head><title>Holiday World Dashboard</title></Head>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading from Google Sheets...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Head><title>Holiday World Dashboard</title></Head>
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">{error}</p>
          <button onClick={fetchData} className="px-4 py-2 bg-amber-500 text-white rounded-lg">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Head>
        <title>Holiday World 2026 Production Calendar</title>
        <meta name="description" content="Campaign production tracking dashboard" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <img src="/holiday-world-logo-2.svg" alt="Holiday World" className="h-12 w-auto mb-1" />
              <p className="text-slate-400 text-sm">2026 Campaign Production Calendar</p>
            </div>
            <div className="flex items-center gap-6">
              <button onClick={fetchData} className="text-slate-400 hover:text-white transition-colors" title="Refresh data">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <div className="text-right">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Today</p>
                <p className="text-white font-medium mono">{formatDateLong(today)}</p>
              </div>
              {attentionRequired.length > 0 && (
                <>
                  <div className="h-10 w-px bg-white/10"></div>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/30">
                    <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse-slow"></span>
                    <span className="text-red-300 text-sm font-medium">{attentionRequired.length} Need Attention</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Milestones', value: data.length, icon: '🎯', sub: `${campaigns.length} campaigns` },
            { label: 'Completed', value: completedItems.length, icon: '✅', sub: `${Math.round((completedItems.length / data.length) * 100)}% done` },
            { label: 'In Progress', value: inProgressItems.length, icon: '🔄', sub: 'actively working' },
            { label: 'Need Attention', value: attentionRequired.length, icon: '⚠️', sub: 'past due date' }
          ].map((stat, i) => (
            <div key={i} className="glass rounded-2xl p-5 animate-slide" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-slate-400 text-sm mb-1">{stat.label}</p>
                  <p className="text-3xl font-semibold text-white">{stat.value}</p>
                  <p className="text-slate-500 text-xs mt-1">{stat.sub}</p>
                </div>
                <span className="text-2xl">{stat.icon}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          <button 
            onClick={() => setActiveFilter('all')} 
            className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${activeFilter === 'all' ? 'bg-white text-slate-900' : 'glass text-slate-300 hover:text-white glass-hover'}`}
          >
            All Campaigns
          </button>
          {categories.map(cat => (
            <button 
              key={cat} 
              onClick={() => setActiveFilter(cat)} 
              className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${activeFilter === cat ? 'text-slate-900' : 'glass text-slate-300 hover:text-white glass-hover'}`} 
              style={activeFilter === cat ? { backgroundColor: categoryColors[cat]?.border || '#fff' } : {}}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-3">
            <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Campaign Timeline
              <span className="text-slate-500 text-sm font-normal ml-2">Click to expand</span>
            </h2>
            {campaignProgress.filter(c => activeFilter === 'all' || c.category === activeFilter).map((campaign, i) => {
              const colors = categoryColors[campaign.category] || categoryColors.Events;
              const isExpanded = expandedCampaign === campaign.campaign;
              const campaignMilestones = data.filter(d => d.campaign === campaign.campaign);
              const hasAttention = campaignMilestones.some(m => isPastDue(m.date) && normalizeStatus(m.status) !== 'done');
              
              return (
                <div 
                  key={campaign.campaign} 
                  className={`glass rounded-2xl overflow-hidden transition-all glass-hover cursor-pointer animate-slide ${hasAttention ? 'border-red-500/30' : ''}`} 
                  style={{ animationDelay: `${i * 0.05}s` }} 
                  onClick={() => setExpandedCampaign(isExpanded ? null : campaign.campaign)}
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3">
                        <div className="w-1 h-12 rounded-full" style={{ backgroundColor: colors.border }} />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-white font-medium text-lg">{campaign.campaign}</h3>
                            {hasAttention && <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse-slow"></span>}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}40` }}>
                              {campaign.category}
                            </span>
                            <span className="text-slate-500 text-sm mono">Campaign starts {formatDate(campaign.startDate)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-3">
                          {campaign.inProgress > 0 && <span className="text-amber-400 text-sm">{campaign.inProgress} active</span>}
                          <div>
                            <p className="text-white font-medium">{campaign.completed}/{campaign.total}</p>
                            <p className="text-slate-500 text-xs">complete</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden flex">
                      <div className="h-full transition-all duration-500 bg-emerald-500" style={{ width: `${campaign.progress}%` }} />
                      <div className="h-full transition-all duration-500 bg-amber-500" style={{ width: `${(campaign.inProgress / campaign.total) * 100}%` }} />
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-white/5 bg-black/20 p-5">
                      <div className="space-y-2">
                        {campaignMilestones.map((m, j) => {
                          const needsAttention = isPastDue(m.date) && normalizeStatus(m.status) !== 'done';
                          const isDone = normalizeStatus(m.status) === 'done';
                          const isInProgress = normalizeStatus(m.status) === 'in progress';
                          return (
                            <div 
                              key={j} 
                              className={`flex items-center justify-between p-3 rounded-xl ${
                                isDone ? 'bg-emerald-500/10 border border-emerald-500/20' : 
                                needsAttention ? 'bg-red-500/10 border border-red-500/20' : 
                                isInProgress ? 'bg-amber-500/10 border border-amber-500/20' : 
                                isUpcoming(m.date) ? 'bg-blue-500/10 border border-blue-500/20' : 
                                'bg-white/5'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${isDone ? 'bg-emerald-400' : needsAttention ? 'bg-red-400' : isInProgress ? 'bg-amber-400' : 'bg-slate-500'}`} />
                                <div>
                                  <p className={`text-sm ${isDone ? 'text-emerald-300 line-through opacity-70' : 'text-white'}`}>{m.milestone}</p>
                                  <p className="text-slate-500 text-xs">{m.type.split(',')[0]}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <p className={`mono text-sm ${isDone ? 'text-emerald-400' : needsAttention ? 'text-red-400' : isInProgress ? 'text-amber-400' : 'text-slate-400'}`}>
                                  {formatDate(m.date)}
                                </p>
                                <StatusBadge status={m.status} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="space-y-6">
            {attentionRequired.length > 0 && (
              <div className="glass rounded-2xl p-5 status-glow border-red-500/30 animate-slide">
                <h3 className="text-red-400 font-medium mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Attention Required
                </h3>
                <div className="space-y-2">
                  {attentionRequired.slice(0, 6).map((m, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-red-500/10 rounded-xl">
                      <div className="flex-1 min-w-0 mr-3">
                        <p className="text-white text-sm truncate">{m.campaign}</p>
                        <p className="text-red-300/70 text-xs truncate">{m.milestone}</p>
                      </div>
                      <StatusBadge status={m.status} />
                    </div>
                  ))}
                  {attentionRequired.length > 6 && (
                    <p className="text-red-400/60 text-xs text-center pt-2">+{attentionRequired.length - 6} more items</p>
                  )}
                </div>
              </div>
            )}
            
            {inProgressItems.length > 0 && (
              <div className="glass rounded-2xl p-5 animate-slide" style={{ animationDelay: '0.1s' }}>
                <h3 className="text-amber-400 font-medium mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  In Progress
                </h3>
                <div className="space-y-2">
                  {inProgressItems.slice(0, 5).map((m, i) => {
                    const colors = categoryColors[m.category] || categoryColors.Events;
                    return (
                      <div key={i} className="flex items-center justify-between p-3 bg-amber-500/10 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-1 h-8 rounded-full" style={{ backgroundColor: colors.border }} />
                          <div>
                            <p className="text-white text-sm">{m.campaign}</p>
                            <p className="text-slate-500 text-xs">{m.milestone}</p>
                          </div>
                        </div>
                        <p className="text-amber-400 text-xs mono">{formatDate(m.date)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="glass rounded-2xl p-5 animate-slide" style={{ animationDelay: '0.2s' }}>
              <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                Coming Up (Next 2 Weeks)
              </h3>
              {upcomingMilestones.length > 0 ? (
                <div className="space-y-2">
                  {upcomingMilestones.map((m, i) => {
                    const colors = categoryColors[m.category] || categoryColors.Events;
                    return (
                      <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-1 h-8 rounded-full" style={{ backgroundColor: colors.border }} />
                          <div>
                            <p className="text-white text-sm">{m.campaign}</p>
                            <p className="text-slate-500 text-xs">{m.milestone}</p>
                          </div>
                        </div>
                        <p className="text-blue-400 text-xs mono">{formatDate(m.date)}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-slate-500 text-sm">No upcoming milestones</p>
              )}
            </div>

            <div className="glass rounded-2xl p-5 animate-slide" style={{ animationDelay: '0.3s' }}>
              <h3 className="text-white font-medium mb-4">How to Update</h3>
              <p className="text-slate-400 text-sm mb-3">Edit statuses directly in the Google Sheet. The dashboard refreshes automatically every 30 seconds.</p>
              <a 
                href={SHEET_EDIT_URL}
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm hover:bg-emerald-500/30 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open Google Sheet
              </a>
            </div>

            <div className="glass rounded-2xl p-5 animate-slide" style={{ animationDelay: '0.4s' }}>
              <h3 className="text-white font-medium mb-4">Status Guide</h3>
              <div className="space-y-3">
                {Object.entries(statusConfig).map(([key, config]) => (
                  <div key={key} className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded ${config.dot}`} />
                    <span className={`text-sm ${config.text}`}>{key}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-white/10 mt-4 pt-4">
                <h4 className="text-white text-sm font-medium mb-3">Categories</h4>
                <div className="space-y-2">
                  {Object.entries(categoryColors).map(([cat, colors]) => (
                    <div key={cat} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: colors.border }} />
                      <span className="text-slate-400 text-sm">{cat}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <footer className="border-t border-white/10 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between text-slate-500 text-sm">
            <p>Prepared by Tanner+West</p>
            {lastUpdated && <p className="mono">Data refreshed: {lastUpdated.toLocaleTimeString()}</p>}
          </div>
        </div>
      </footer>
    </div>
  );
}
