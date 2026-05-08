import React, { useState, useEffect, useRef, useCallback } from 'react';
import { avatarColor, initials, formatEmailDate, TAG_COLORS_MAP, TAG_LABELS, getContacts, getTasks } from '../lib/utils';

const SEARCH_HISTORY_KEY = 'mhg_search_history';

function getHistory() {
  try { return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]'); }
  catch { return []; }
}

function addHistory(q) {
  if (!q?.trim()) return;
  const h = [q, ...getHistory().filter(x => x !== q)].slice(0, 10);
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(h));
}

function Av({ name, size = 32 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: avatarColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 500, color: 'white', flexShrink: 0 }}>
      {initials(name)}
    </div>
  );
}

export function SearchPanel({ threads, accessToken, onSelectThread }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState(getHistory());
  const [filters, setFilters] = useState({ type: 'all', dateRange: 'any', tag: 'any' });
  const inputRef = useRef();
  const debounceRef = useRef();

  useEffect(() => { inputRef.current?.focus(); }, []);

  const searchLocal = useCallback((q) => {
    if (!q?.trim()) { setResults(null); return; }
    const ql = q.toLowerCase();
    const contacts = getContacts();
    const tasks = getTasks();

    const emailResults = threads.filter(t =>
      t.subject?.toLowerCase().includes(ql) ||
      t.from?.toLowerCase().includes(ql) ||
      t.fromEmail?.toLowerCase().includes(ql) ||
      t.snippet?.toLowerCase().includes(ql) ||
      t.body?.toLowerCase().includes(ql)
    ).slice(0, 20);

    const contactResults = contacts.filter(c =>
      c.name?.toLowerCase().includes(ql) ||
      c.email?.toLowerCase().includes(ql) ||
      c.company?.toLowerCase().includes(ql) ||
      c.phone?.includes(q) ||
      c.policy?.Type?.toLowerCase().includes(ql) ||
      c.policy?.Carrier?.toLowerCase().includes(ql)
    ).slice(0, 10);

    const taskResults = tasks.filter(t =>
      t.text?.toLowerCase().includes(ql) ||
      t.meta?.toLowerCase().includes(ql)
    ).slice(0, 10);

    setResults({ emails: emailResults, contacts: contactResults, tasks: taskResults, query: q });
  }, [threads]);

  const handleSearch = useCallback((q) => {
    setQuery(q);
    clearTimeout(debounceRef.current);
    if (!q?.trim()) { setResults(null); return; }
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      searchLocal(q);
      setLoading(false);
    }, 200);
  }, [searchLocal]);

  const handleSubmit = (q) => {
    if (!q?.trim()) return;
    addHistory(q);
    setHistory(getHistory());
    searchLocal(q);
  };

  const applyFilter = (result) => {
    if (!result) return result;
    let emails = result.emails;
    if (filters.tag !== 'any') {
      emails = emails.filter(e => {
        const s = (e.subject + e.snippet).toLowerCase();
        if (filters.tag === 'urgent') return s.includes('urgent') || s.includes('asap');
        if (filters.tag === 'followup') return s.includes('follow') || s.includes('checking');
        if (filters.tag === 'unread') return e.isUnread;
        if (filters.tag === 'starred') return e.isStarred;
        return true;
      });
    }
    if (filters.dateRange !== 'any') {
      const cutoff = new Date();
      if (filters.dateRange === 'today') cutoff.setHours(0,0,0,0);
      else if (filters.dateRange === 'week') cutoff.setDate(cutoff.getDate()-7);
      else if (filters.dateRange === 'month') cutoff.setMonth(cutoff.getMonth()-1);
      emails = emails.filter(e => new Date(e.date) >= cutoff);
    }
    return { ...result, emails };
  };

  const filtered = applyFilter(results);
  const total = filtered ? filtered.emails.length + filtered.contacts.length + filtered.tasks.length : 0;

  return (
    <div className="search-panel">
      {/* Search input */}
      <div className="search-input-wrap">
        <div className="search-input-box">
          <i className="ti ti-search search-icon" aria-hidden="true"/>
          <input
            ref={inputRef}
            className="search-main-input"
            placeholder="Search emails, contacts, tasks, notes... (try: 'Whitney Cigna', 'Frederick paperwork', 'unpaid bonus')"
            value={query}
            onChange={e => handleSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit(query)}
          />
          {query && <button className="search-clear" onClick={() => { setQuery(''); setResults(null); inputRef.current?.focus(); }}>
            <i className="ti ti-x" aria-hidden="true"/>
          </button>}
        </div>

        {/* Filters */}
        <div className="search-filters">
          <div className="sf-group">
            <span className="sf-label">Type:</span>
            {['all','emails','contacts','tasks'].map(t => (
              <button key={t} className={`sf-pill ${filters.type===t?'active':''}`} onClick={() => setFilters(f=>({...f,type:t}))}>
                {t.charAt(0).toUpperCase()+t.slice(1)}
              </button>
            ))}
          </div>
          <div className="sf-group">
            <span className="sf-label">Date:</span>
            {[['any','Any time'],['today','Today'],['week','This week'],['month','This month']].map(([v,l]) => (
              <button key={v} className={`sf-pill ${filters.dateRange===v?'active':''}`} onClick={() => setFilters(f=>({...f,dateRange:v}))}>
                {l}
              </button>
            ))}
          </div>
          <div className="sf-group">
            <span className="sf-label">Tag:</span>
            {[['any','All'],['urgent','Urgent'],['followup','Follow-up'],['unread','Unread'],['starred','Starred']].map(([v,l]) => (
              <button key={v} className={`sf-pill ${filters.tag===v?'active':''}`} onClick={() => setFilters(f=>({...f,tag:v}))}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="search-body">
        {/* No query — show history and tips */}
        {!query && (
          <div className="search-home">
            {history.length > 0 && (
              <div className="search-section">
                <div className="search-section-label">Recent searches</div>
                {history.map((h,i) => (
                  <div key={i} className="search-history-item" onClick={() => { setQuery(h); handleSearch(h); }}>
                    <i className="ti ti-history" aria-hidden="true"/>
                    <span>{h}</span>
                    <button onClick={e => { e.stopPropagation(); const nh = history.filter(x=>x!==h); setHistory(nh); localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(nh)); }}>
                      <i className="ti ti-x" aria-hidden="true"/>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="search-section">
              <div className="search-section-label">Search tips</div>
              <div className="search-tips-grid">
                {[
                  ['Search by name','Try: "Whitney" or "Frederick Wright"'],
                  ['Search by topic','Try: "Cigna PPO" or "renewal"'],
                  ['Search by carrier','Try: "BCBS" or "LifeX" or "Aetna"'],
                  ['Search by status','Try: "unpaid" or "urgent" or "follow up"'],
                  ['Search by date','Use the date filter above + keyword'],
                  ['Search contacts','Finds phone, email, company, policy info'],
                ].map(([title,tip]) => (
                  <div key={title} className="search-tip-card" onClick={() => { const q=tip.split('"')[1]; if(q){setQuery(q);handleSearch(q);} }}>
                    <div className="search-tip-title">{title}</div>
                    <div className="search-tip-text">{tip}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && <div className="search-loading"><div className="search-spinner"/><span>Searching...</span></div>}

        {/* Results */}
        {filtered && !loading && (
          <div className="search-results">
            <div className="search-results-summary">
              {total > 0 ? `${total} result${total!==1?'s':''} for "${filtered.query}"` : `No results for "${filtered.query}"`}
            </div>

            {/* Email results */}
            {(filters.type==='all'||filters.type==='emails') && filtered.emails.length > 0 && (
              <div className="search-section">
                <div className="search-section-label">
                  <i className="ti ti-mail" aria-hidden="true"/> Emails ({filtered.emails.length})
                </div>
                {filtered.emails.map(t => {
                  const tag = t.tag || 'action';
                  const hl = (text) => {
                    if (!filtered.query) return text;
                    const regex = new RegExp(`(${filtered.query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
                    return text?.replace(regex, '<mark style="background:#fff3cd;border-radius:2px">$1</mark>') || text;
                  };
                  return (
                    <div key={t.id} className={`search-email-item ${t.isUnread?'unread':''}`} onClick={() => onSelectThread(t)}>
                      <Av name={t.from} size={34}/>
                      <div className="search-email-body">
                        <div className="search-email-top">
                          <span className="search-email-from" dangerouslySetInnerHTML={{__html: hl(t.from)}}/>
                          <span className="search-email-date">{formatEmailDate(t.date)}</span>
                        </div>
                        <div className="search-email-subject" dangerouslySetInnerHTML={{__html: hl(t.subject)}}/>
                        <div className="search-email-snippet" dangerouslySetInnerHTML={{__html: hl(t.snippet?.slice(0,120))}}/>
                      </div>
                      <span className="search-tag" style={{background: TAG_COLORS_MAP[tag]||'#718096'}}>{TAG_LABELS[tag]||tag}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Contact results */}
            {(filters.type==='all'||filters.type==='contacts') && filtered.contacts.length > 0 && (
              <div className="search-section">
                <div className="search-section-label">
                  <i className="ti ti-users" aria-hidden="true"/> Contacts ({filtered.contacts.length})
                </div>
                {filtered.contacts.map(c => (
                  <div key={c.id||c.email} className="search-contact-item">
                    <Av name={c.name} size={34}/>
                    <div className="search-contact-body">
                      <div className="search-contact-name">{c.name}</div>
                      <div className="search-contact-meta">{c.company}{c.phone?` · ${c.phone}`:''}</div>
                      {c.policy?.Type && <div className="search-contact-policy">📋 {c.policy.Type} · {c.policy.Carrier}</div>}
                    </div>
                    <span className="search-type-badge" style={{background: {client:'#276749',prospect:'#c05621',lead:'#0987a0',coworker:'#553c9a'}[c.type]||'#718096'}}>
                      {c.type?.charAt(0).toUpperCase()+c.type?.slice(1)||'Contact'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Task results */}
            {(filters.type==='all'||filters.type==='tasks') && filtered.tasks.length > 0 && (
              <div className="search-section">
                <div className="search-section-label">
                  <i className="ti ti-check" aria-hidden="true"/> Tasks ({filtered.tasks.length})
                </div>
                {filtered.tasks.map(t => (
                  <div key={t.id} className={`search-task-item ${t.done?'done':''}`}>
                    <div className="search-task-check" style={{background: t.done?'#276749':'transparent', borderColor: t.done?'#276749':'#cbd5e0'}}/>
                    <div>
                      <div className="search-task-text">{t.text}</div>
                      {t.meta && <div className="search-task-meta">{t.meta}</div>}
                    </div>
                    <span className="search-priority-dot" style={{background:{urgent:'#c53030',followup:'#c05621',action:'#2b6cb0',fyi:'#276749'}[t.priority]||'#718096'}}/>
                  </div>
                ))}
              </div>
            )}

            {total === 0 && (
              <div className="search-no-results">
                <i className="ti ti-search-off" aria-hidden="true" style={{fontSize:36,color:'var(--color-text-tertiary)'}}/>
                <div>No results found for "{filtered.query}"</div>
                <div style={{fontSize:12,color:'var(--color-text-tertiary)',marginTop:4}}>Try different keywords or remove filters</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
