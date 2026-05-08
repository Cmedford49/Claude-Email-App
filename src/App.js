import React, { useState, useEffect, useCallback } from 'react';
import { SearchPanel } from './components/Search';
import { ComposePopup } from './components/Compose';
import { useGoogleAuth } from './hooks/useGoogleAuth';
import { fetchThreads, fetchLabels, deleteThread, archiveThread, markRead, markUnread, starThread, sendEmail, saveDraft } from './lib/gmail';
import { generateDraft, summarizeThread } from './lib/ai';
import { avatarColor, initials, formatEmailDate, groupThreadsByDate, classifyEmail, TAG_COLORS_MAP, TAG_LABELS } from './lib/utils';

// ── LOGIN ─────────────────────────────────────────────────
function Login({ onSignIn }) {
  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo-row">
          <span className="login-plus">+</span>
          <div><div className="login-brand-main">MEDFORD HEALTH GROUP</div><div className="login-brand-sub">Command Center</div></div>
        </div>
        <p className="login-tagline">Your AI-powered business hub</p>
        <button className="login-google-btn" onClick={onSignIn}>
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Sign in with Google
        </button>
        <p className="login-note">Connects to christian@medfordhealthgroup.com</p>
      </div>
    </div>
  );
}

// ── AVATAR ────────────────────────────────────────────────
function Av({ name, size=36 }) {
  return <div className="av" style={{background:avatarColor(name),width:size,height:size,fontSize:size*0.38}}>{initials(name)}</div>;
}

// ── KEYBOARD SHORTCUTS HELP ───────────────────────────────
function ShortcutsHelp({ onClose }) {
  const shortcuts = [
    ['D','Delete email'],['E','Archive email'],['R','Reply'],['F','Forward'],
    ['C','Compose new'],['Tab','AI draft reply'],['S','Star/flag'],['M','Mark read/unread'],
    ['J','Next email'],['K','Previous email'],['Ctrl+Enter','Send'],['Esc','Close/back'],
    ['Ctrl+K','Command palette'],['?','Show this help'],
  ];
  return (
    <div className="overlay" onClick={onClose}>
      <div className="shortcuts-popup" onClick={e=>e.stopPropagation()}>
        <div className="shortcuts-header">Keyboard Shortcuts <button onClick={onClose}>✕</button></div>
        <div className="shortcuts-grid">
          {shortcuts.map(([k,v])=>(
            <div key={k} className="shortcut-row">
              <kbd className="shortcut-key">{k}</kbd>
              <span className="shortcut-desc">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── COMMAND PALETTE ───────────────────────────────────────
function CommandPalette({ onClose, onCommand }) {
  const [query, setQuery] = useState('');
  const commands = [
    { label:'Compose new email', action:'compose', icon:'✏️' },
    { label:'Reply to selected', action:'reply', icon:'↩' },
    { label:'Delete selected email', action:'delete', icon:'🗑️' },
    { label:'Archive selected email', action:'archive', icon:'📦' },
    { label:'Mark as unread', action:'unread', icon:'📬' },
    { label:'Star email', action:'star', icon:'⭐' },
    { label:'Go to Inbox', action:'inbox', icon:'📥' },
    { label:'Go to Sent', action:'sent', icon:'📤' },
    { label:'AI draft reply', action:'ai-draft', icon:'⚡' },
    { label:'Show keyboard shortcuts', action:'shortcuts', icon:'⌨️' },
  ];
  const filtered = commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="overlay" onClick={onClose}>
      <div className="command-palette" onClick={e=>e.stopPropagation()}>
        <input autoFocus className="command-input" placeholder="Type a command..." value={query} onChange={e=>setQuery(e.target.value)}
          onKeyDown={e=>{ if(e.key==='Escape') onClose(); if(e.key==='Enter' && filtered.length) { onCommand(filtered[0].action); onClose(); }}}/>
        <div className="command-list">
          {filtered.map(c=>(
            <div key={c.action} className="command-item" onClick={()=>{ onCommand(c.action); onClose(); }}>
              <span className="command-icon">{c.icon}</span>
              <span>{c.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────
export default function App() {
  const { isSignedIn, accessToken, userInfo, loading, signIn, signOut } = useGoogleAuth();

  // Data
  const [threads, setThreads] = useState([]);
  const [labels, setLabels] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  // UI state
  const [selectedThread, setSelectedThread] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeLabel, setActiveLabel] = useState('INBOX');
  const [activeLabelName, setActiveLabelName] = useState('Inbox');
  const [compose, setCompose] = useState(null); // {mode, thread}
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showCommand, setShowCommand] = useState(false);
  const [notification, setNotification] = useState(null);
  const [aiSummary, setAiSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  

  const notify = useCallback((msg, type='success') => {
    setNotification({msg,type});
    setTimeout(()=>setNotification(null), 3000);
  }, []);

  // Load data
  const loadThreads = useCallback(async (labelId='INBOX') => {
    if (!accessToken) return;
    setDataLoading(true);
    setThreads([]);
    try {
      const query = labelId === 'INBOX' ? 'in:inbox' : labelId === 'SENT' ? 'in:sent' : labelId === 'STARRED' ? 'is:starred' : labelId === 'DRAFT' ? 'in:drafts' : `label:${labelId}`;
      const data = await fetchThreads(accessToken, query, 50);
      setThreads(data);
      if (data.length) { setSelectedThread(data[0]); setSelectedIndex(0); }
    } catch(e) { notify('Failed to load emails: '+e.message, 'error'); }
    setDataLoading(false);
  }, [accessToken, notify]);

  const loadLabels = useCallback(async () => {
    if (!accessToken) return;
    try { const data = await fetchLabels(accessToken); setLabels(data); }
    catch(e) { console.error(e); }
  }, [accessToken]);

  useEffect(() => {
    if (isSignedIn && accessToken) { loadThreads('INBOX'); loadLabels(); }
  }, [isSignedIn, accessToken, loadThreads, loadLabels]);

  // Load AI summary when thread changes
  useEffect(() => {
    if (!selectedThread) return;
    setAiSummary('');
    const hasKey = process.env.REACT_APP_ANTHROPIC_KEY;
    if (!hasKey) return;
    setSummaryLoading(true);
    summarizeThread(selectedThread).then(s => { setAiSummary(s||''); setSummaryLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThread?.id]);

  // Actions
  const handleDelete = useCallback(async (thread) => {
    if (!thread) return;
    
    setThreads(t => t.filter(x => x.id !== thread.id));
    if (selectedThread?.id === thread.id) {
      const idx = threads.findIndex(t => t.id === thread.id);
      setSelectedThread(threads[idx+1] || threads[idx-1] || null);
    }
    try { await deleteThread(accessToken, thread.id); notify('Email deleted  ↩ Undo'); }
    catch(e) { notify('Delete failed', 'error'); loadThreads(activeLabel); }
  }, [accessToken, threads, selectedThread, activeLabel, loadThreads, notify]);

  const handleArchive = useCallback(async (thread) => {
    if (!thread) return;
    setThreads(t => t.filter(x => x.id !== thread.id));
    if (selectedThread?.id === thread.id) {
      const idx = threads.findIndex(t => t.id === thread.id);
      setSelectedThread(threads[idx+1] || threads[idx-1] || null);
    }
    try { await archiveThread(accessToken, thread.id); notify('Archived'); }
    catch(e) { notify('Archive failed','error'); }
  }, [accessToken, threads, selectedThread, notify]);

  const handleStar = useCallback(async (thread) => {
    if (!thread) return;
    try { await starThread(accessToken, thread.id); notify('Starred ⭐'); setThreads(ts=>ts.map(t=>t.id===thread.id?{...t,isStarred:true}:t)); }
    catch(e) { notify('Failed to star','error'); }
  }, [accessToken, notify]);

  const handleMarkUnread = useCallback(async (thread) => {
    if (!thread) return;
    try { await markUnread(accessToken, thread.id); setThreads(ts=>ts.map(t=>t.id===thread.id?{...t,isUnread:true}:t)); notify('Marked unread'); }
    catch(e) { notify('Failed','error'); }
  }, [accessToken, notify]);

  const handleSend = useCallback(async (params) => {
    await sendEmail(accessToken, params);
    notify('Email sent! ✓');
    if (params.threadId) { await markRead(accessToken, params.threadId); }
  }, [accessToken, notify]);

  const handleDraft = useCallback(async (params) => {
    await saveDraft(accessToken, params);
    notify('Draft saved');
  }, [accessToken, notify]);

  const handleSelectThread = useCallback(async (thread, idx) => {
    setSelectedThread(thread);
    setSelectedIndex(idx);
    if (thread.isUnread) {
      try { await markRead(accessToken, thread.id); setThreads(ts=>ts.map(t=>t.id===thread.id?{...t,isUnread:false}:t)); }
      catch(e) {}
    }
  }, [accessToken]);

  const handleCommand = useCallback((action) => {
    if (action==='compose') setCompose({mode:'compose'});
    else if (action==='reply') { if(selectedThread) setCompose({mode:'reply',thread:selectedThread}); }
    else if (action==='delete') handleDelete(selectedThread);
    else if (action==='archive') handleArchive(selectedThread);
    else if (action==='star') handleStar(selectedThread);
    else if (action==='unread') handleMarkUnread(selectedThread);
    else if (action==='shortcuts') setShowShortcuts(true);
    else if (action==='ai-draft') { if(selectedThread) setCompose({mode:'reply',thread:selectedThread,autoAI:true}); }
    else if (action==='inbox') { setActiveLabel('INBOX'); setActiveLabelName('Inbox'); loadThreads('INBOX'); }
    else if (action==='sent') { setActiveLabel('SENT'); setActiveLabelName('Sent'); loadThreads('SENT'); }
  }, [selectedThread, handleDelete, handleArchive, handleStar, handleMarkUnread, loadThreads]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||compose) return;
      const k = e.key;
      if (k==='?' ) { setShowShortcuts(true); return; }
      if ((e.ctrlKey||e.metaKey) && k==='k') { e.preventDefault(); setShowCommand(true); return; }
      if (k==='c') { setCompose({mode:'compose'}); return; }
      if (k==='r') { if(selectedThread) setCompose({mode:'reply',thread:selectedThread}); return; }
      if (k==='f') { if(selectedThread) setCompose({mode:'forward',thread:selectedThread}); return; }
      if (k==='d') { handleDelete(selectedThread); return; }
      if (k==='e') { handleArchive(selectedThread); return; }
      if (k==='s') { handleStar(selectedThread); return; }
      if (k==='m') { handleMarkUnread(selectedThread); return; }
      if (k==='Escape') { setCompose(null); setShowShortcuts(false); setShowCommand(false); return; }
      if (k==='j') {
        const next = Math.min(selectedIndex+1, threads.length-1);
        setSelectedIndex(next); handleSelectThread(threads[next], next);
      }
      if (k==='k') {
        const prev = Math.max(selectedIndex-1, 0);
        setSelectedIndex(prev); handleSelectThread(threads[prev], prev);
      }
      if (k==='Tab') { e.preventDefault(); if(selectedThread) setCompose({mode:'reply',thread:selectedThread,autoAI:true}); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [compose, selectedThread, selectedIndex, threads, handleDelete, handleArchive, handleStar, handleMarkUnread, handleSelectThread]);

  if (loading) return <div className="splash"><div className="splash-spinner"/></div>;
  if (!isSignedIn) return <Login onSignIn={signIn} />;

  // Group threads
  const groups = groupThreadsByDate(threads);
  const unreadCount = threads.filter(t=>t.isUnread).length;

  // Sidebar labels
  const systemFolders = [
    { id:'INBOX', name:'Inbox', icon:'📥', count:unreadCount },
    { id:'STARRED', name:'Starred', icon:'⭐' },
    { id:'SENT', name:'Sent Items', icon:'📤' },
    { id:'DRAFT', name:'Drafts', icon:'📝' },
    { id:'TRASH', name:'Deleted Items', icon:'🗑️' },
  ];
  const userLabels = labels.filter(l => l.type === 'user').sort((a,b)=>a.name.localeCompare(b.name));

  return (
    <div className="app">
      {/* TOOLBAR */}
      <div className="toolbar">
        <div className="toolbar-brand">
          <span className="toolbar-plus">+</span>
          <span className="toolbar-name">MHG</span>
        </div>
        <div className="toolbar-sep"/>
        <button className="tb-btn primary" onClick={()=>setCompose({mode:'compose'})}>
          <span className="tb-icon">✏️</span><span>New</span>
        </button>
        <div className="tb-group">
          <button className="tb-btn" onClick={()=>handleDelete(selectedThread)} title="Delete (D)">
            <span className="tb-icon">🗑️</span><span>Delete</span>
          </button>
          <button className="tb-btn" onClick={()=>handleArchive(selectedThread)} title="Archive (E)">
            <span className="tb-icon">📦</span><span>Archive</span>
          </button>
        </div>
        <div className="tb-group">
          <button className="tb-btn" onClick={()=>selectedThread&&setCompose({mode:'reply',thread:selectedThread})} title="Reply (R)">
            <span className="tb-icon">↩</span><span>Reply</span>
          </button>
          <button className="tb-btn" onClick={()=>selectedThread&&setCompose({mode:'reply',thread:selectedThread})} title="Reply All">
            <span className="tb-icon">↩↩</span><span>Reply All</span>
          </button>
          <button className="tb-btn" onClick={()=>selectedThread&&setCompose({mode:'forward',thread:selectedThread})} title="Forward (F)">
            <span className="tb-icon">↪</span><span>Forward</span>
          </button>
        </div>
        <div className="tb-group">
          <button className="tb-btn ai-tb-btn" onClick={()=>selectedThread&&setCompose({mode:'reply',thread:selectedThread,autoAI:true})} title="AI Draft (Tab)">
            <span className="tb-icon">⚡</span><span>AI Draft</span>
          </button>
        </div>
        <div className="tb-group">
          <button className="tb-btn" onClick={()=>selectedThread&&handleMarkUnread(selectedThread)} title="Mark Unread (M)">
            <span className="tb-icon">📬</span><span>Unread</span>
          </button>
          <button className="tb-btn" onClick={()=>selectedThread&&handleStar(selectedThread)} title="Star (S)">
            <span className="tb-icon">⭐</span><span>Flag</span>
          </button>
        </div>
        <div className="tb-group">
          <button className="tb-btn" onClick={()=>loadThreads(activeLabel)} title="Refresh">
            <span className="tb-icon">🔄</span><span>Refresh</span>
          </button>
          <button className="tb-btn" onClick={()=>setShowShortcuts(true)} title="Shortcuts (?)">
            <span className="tb-icon">⌨️</span><span>Shortcuts</span>
          </button>
        </div>
        <div className="toolbar-spacer"/>
        <div className="toolbar-search">
          <input placeholder="Search..." onKeyDown={e=>{if(e.key==='Enter'){setMainView('search');}}} onFocus={()=>setMainView('search')} style={{cursor:'pointer'}}/>
        </div>
        <div className="toolbar-user" onClick={signOut} title="Sign out">
          {userInfo?.picture ? <img src={userInfo.picture} alt="" className="user-photo"/> : <Av name={userInfo?.name||'CM'} size={28}/>}
        </div>
      </div>

      {/* BODY */}
      <div className="body">
        {/* SIDEBAR */}
        <div className="sidebar">
          <div className="nav-sec">
            <div className="nav-lbl">Mail</div>
            {systemFolders.map(f=>(
              <div key={f.id} className={`ni ${activeLabel===f.id&&mainView==='inbox'?'active':''}`}
                onClick={()=>{ setActiveLabel(f.id); setActiveLabelName(f.name); setMainView('inbox'); loadThreads(f.id); }}>
                <span className="nic">{f.icon}</span>
                <span>{f.name}</span>
                {f.count>0 && <span className="nb">{f.count}</span>}
              </div>
            ))}
          </div>
          {userLabels.length > 0 && (
            <div className="nav-sec">
              <div className="nav-lbl">Folders</div>
              {userLabels.map(l=>(
                <div key={l.id} className={`ni ${activeLabel===l.id&&mainView==='inbox'?'active':''}`}
                  onClick={()=>{ setActiveLabel(l.id); setActiveLabelName(l.name); setMainView('inbox'); loadThreads(l.id); }}>
                  <span className="nic">📁</span>
                  <span className="ni-label">{l.name}</span>
                  {l.messagesUnread>0 && <span className="nb">{l.messagesUnread}</span>}
                </div>
              ))}
            </div>
          )}
          <div className="nav-sec">
            <div className="nav-lbl">Search</div>
            <div className={`ni ${mainView==='search'?'active':''}`} onClick={()=>setMainView('search')}>
              <span className="nic">🔍</span><span>Search Everything</span>
            </div>
          </div>
          <div className="nav-sec">
            <div className="nav-lbl">CRM</div>
            <div className={`ni ${mainView==='contacts'?'active':''}`} onClick={()=>setMainView('contacts')}>
              <span className="nic">👤</span><span>All Contacts</span>
            </div>
            <div className={`ni ${mainView==='referrals'?'active':''}`} onClick={()=>setMainView('referrals')}>
              <span className="nic">🤝</span><span>Referral Tracker</span>
            </div>
          </div>
          <div className="nav-sec">
            <div className="nav-lbl">Workspace</div>
            <div className="ni" onClick={()=>setActivePanel('calendar')}>
              <span className="nic">📅</span><span>Calendar</span>
            </div>
            <div className="ni" onClick={()=>setActivePanel('tasks')}>
              <span className="nic">✅</span><span>Tasks</span>
            </div>
          </div>
          <div className="sidebar-spacer"/>
          <div className="sidebar-footer">
            <div className="sidebar-user-name">{userInfo?.name||'Christian Medford'}</div>
            <div className="sidebar-user-email">{userInfo?.email||'christian@medfordhealthgroup.com'}</div>
          </div>
        </div>

        {/* EMAIL LIST */}
        <div className="email-list-panel">
          <div className="email-list-header">
            <span className="email-list-title">{activeLabelName}</span>
            <span className="email-list-count">{threads.length} messages{unreadCount>0?`, ${unreadCount} unread`:''}</span>
            <button className="email-list-filter" onClick={()=>setShowCommand(true)}>⌘K</button>
          </div>
          <div className="email-list-scroll">
            {dataLoading && <div className="email-list-loading">Loading emails...</div>}
            {!dataLoading && threads.length===0 && <div className="email-list-empty">No emails in {activeLabelName}</div>}
            {!dataLoading && Object.entries(groups).map(([group, groupThreads]) => (
              groupThreads.length > 0 && (
                <div key={group}>
                  <div className="email-group-header">{group}</div>
                  {groupThreads.map((thread, i) => {
                    const tag = classifyEmail(thread);
                    const globalIdx = threads.indexOf(thread);
                    return (
                      <div key={thread.id}
                        className={`email-row ${thread.isUnread?'unread':''} ${selectedThread?.id===thread.id?'selected':''}`}
                        onClick={()=>handleSelectThread(thread, globalIdx)}
                        onContextMenu={e=>{e.preventDefault();}}>
                        <div className="email-row-left">
                          <input type="checkbox" className="email-checkbox" onClick={e=>e.stopPropagation()}/>
                          <Av name={thread.from} size={34}/>
                        </div>
                        <div className="email-row-body">
                          <div className="email-row-top">
                            <span className={`email-row-from ${thread.isUnread?'bold':''}`}>{thread.from}</span>
                            <span className="email-row-date">{formatEmailDate(thread.date)}</span>
                          </div>
                          <div className={`email-row-subject ${thread.isUnread?'bold':''}`}>{thread.subject}</div>
                          <div className="email-row-preview">{thread.snippet}</div>
                        </div>
                        <div className="email-row-actions">
                          {thread.isStarred && <span className="email-star-badge">⭐</span>}
                          <span className="email-tag" style={{background:TAG_COLORS_MAP[tag]}}>{TAG_LABELS[tag]}</span>
                          <button className="email-action-btn" title="Delete (D)" onClick={e=>{e.stopPropagation();handleDelete(thread);}}>🗑</button>
                          <button className="email-action-btn" title="Reply (R)" onClick={e=>{e.stopPropagation();setCompose({mode:'reply',thread});}}>↩</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ))}
          </div>
        </div>

        {/* READING PANE */}
        <div className="reading-pane">
          {!selectedThread ? (
            <div className="reading-pane-empty">
              <div className="reading-empty-icon">📧</div>
              <div className="reading-empty-text">Select an email to read</div>
              <div className="reading-empty-sub">Press <kbd>C</kbd> to compose · <kbd>?</kbd> for shortcuts · <kbd>⌘K</kbd> for commands</div>
            </div>
          ) : (
            <>
              <div className="reading-header">
                <div className="reading-subject">{selectedThread.subject}</div>
                <div className="reading-actions">
                  <button className="reading-btn" onClick={()=>setCompose({mode:'reply',thread:selectedThread})}>↩ Reply</button>
                  <button className="reading-btn" onClick={()=>setCompose({mode:'reply',thread:selectedThread})}>↩↩ Reply All</button>
                  <button className="reading-btn" onClick={()=>setCompose({mode:'forward',thread:selectedThread})}>↪ Forward</button>
                  <button className="reading-btn ai-btn" onClick={()=>setCompose({mode:'reply',thread:selectedThread,autoAI:true})}>⚡ AI Draft</button>
                  <button className="reading-btn danger" onClick={()=>handleDelete(selectedThread)}>🗑 Delete</button>
                </div>
              </div>

              <div className="reading-meta">
                <Av name={selectedThread.from} size={40}/>
                <div className="reading-meta-info">
                  <div className="reading-from-name">{selectedThread.from}</div>
                  <div className="reading-from-email">&lt;{selectedThread.fromEmail}&gt;</div>
                  <div className="reading-to">To: {selectedThread.to}</div>
                </div>
                <div className="reading-date">{selectedThread.date ? new Date(selectedThread.date).toLocaleString() : ''}</div>
              </div>

              {(aiSummary || summaryLoading) && (
                <div className="reading-ai-summary">
                  <span className="ai-sum-icon">⚡</span>
                  <div>
                    <div className="ai-sum-label">AI Summary</div>
                    <div className="ai-sum-text">{summaryLoading ? 'Summarizing...' : aiSummary}</div>
                  </div>
                </div>
              )}

              <div className="reading-body"
                dangerouslySetInnerHTML={{__html: selectedThread.body || `<p>${selectedThread.snippet}</p>`}}
              />

              {selectedThread.messageCount > 1 && (
                <div className="reading-thread-count">
                  {selectedThread.messageCount} messages in this thread
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* STATUS BAR */}
      <div className="status-bar">
        <div className="status-dot green"/>
        <span>Gmail Connected</span>
        <div className="status-sep"/>
        <span>{threads.length} emails loaded</span>
        <div className="status-spacer"/>
        <span className="status-shortcuts">Press <kbd>?</kbd> for shortcuts · <kbd>⌘K</kbd> for commands</span>
      </div>

      {/* OVERLAYS */}
      {compose && (
        <ComposePopup
          mode={compose.mode}
          thread={compose.thread}
          userEmail={userInfo?.email}
          autoAI={compose.autoAI}
          onSend={handleSend}
          onDraft={handleDraft}
          onClose={()=>setCompose(null)}
        />
      )}
      {showShortcuts && <ShortcutsHelp onClose={()=>setShowShortcuts(false)}/>}
      {showCommand && <CommandPalette onClose={()=>setShowCommand(false)} onCommand={handleCommand}/>}
      {notification && <div className={`notification ${notification.type}`}>{notification.msg}</div>}
    </div>
  );
}
