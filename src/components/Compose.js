import React, { useState, useEffect, useRef, useCallback } from 'react';
import { generateDraft } from '../lib/ai';
import { getSignatures, saveSignature, deleteSignature, setDefaultSignature, getDefaultSignature, getTemplates, saveTemplate, deleteTemplate, initDefaultTemplates } from '../lib/storage';

// ── RICH TEXT TOOLBAR ─────────────────────────────────────
function RichToolbar({ editorRef }) {
  const exec = (cmd, val = null) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
  };

  const insertLink = () => {
    const url = prompt('Enter URL:', 'https://');
    if (url) exec('createLink', url);
  };

  const insertTable = () => {
    const rows = parseInt(prompt('Number of rows:', '3') || '3');
    const cols = parseInt(prompt('Number of columns:', '3') || '3');
    if (!rows || !cols) return;
    let html = '<table border="1" style="border-collapse:collapse;width:100%;margin:10px 0">';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        if (r === 0) html += '<th style="background:#f3f2f1;padding:8px;border:1px solid #ccc;font-weight:600">Header</th>';
        else html += '<td style="padding:8px;border:1px solid #ccc">Cell</td>';
      }
      html += '</tr>';
    }
    html += '</table><br>';
    exec('insertHTML', html);
  };

  const setFontSize = (size) => exec('fontSize', size);
  const setColor = (color) => exec('foreColor', color);
  const setHighlight = (color) => exec('hiliteColor', color);

  const tools = [
    { icon: 'B', cmd: 'bold', style: { fontWeight: '700' }, title: 'Bold (Ctrl+B)' },
    { icon: 'I', cmd: 'italic', style: { fontStyle: 'italic' }, title: 'Italic (Ctrl+I)' },
    { icon: 'U', cmd: 'underline', style: { textDecoration: 'underline' }, title: 'Underline (Ctrl+U)' },
    { icon: 'S̶', cmd: 'strikeThrough', style: { textDecoration: 'line-through' }, title: 'Strikethrough' },
  ];

  return (
    <div className="rich-toolbar">
      <div className="rich-toolbar-group">
        <select className="rt-select" onChange={e => exec('fontName', e.target.value)} title="Font">
          {['Arial','Georgia','Helvetica','Times New Roman','Verdana','DM Sans'].map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <select className="rt-select rt-select-sm" onChange={e => setFontSize(e.target.value)} title="Size">
          {['1','2','3','4','5','6','7'].map((s,i) => (
            <option key={s} value={s}>{[8,10,12,14,18,24,36][i]}pt</option>
          ))}
        </select>
      </div>
      <div className="rich-toolbar-sep"/>
      <div className="rich-toolbar-group">
        {tools.map(t => (
          <button key={t.cmd} className="rt-btn" onMouseDown={e=>{e.preventDefault();exec(t.cmd);}} title={t.title} style={t.style}>
            {t.icon}
          </button>
        ))}
      </div>
      <div className="rich-toolbar-sep"/>
      <div className="rich-toolbar-group">
        <button className="rt-btn" onMouseDown={e=>{e.preventDefault();exec('insertUnorderedList');}} title="Bullet list">☰</button>
        <button className="rt-btn" onMouseDown={e=>{e.preventDefault();exec('insertOrderedList');}} title="Numbered list">1.</button>
        <button className="rt-btn" onMouseDown={e=>{e.preventDefault();exec('outdent');}} title="Outdent">⇤</button>
        <button className="rt-btn" onMouseDown={e=>{e.preventDefault();exec('indent');}} title="Indent">⇥</button>
      </div>
      <div className="rich-toolbar-sep"/>
      <div className="rich-toolbar-group">
        <button className="rt-btn" onMouseDown={e=>{e.preventDefault();exec('justifyLeft');}} title="Align left">⬛</button>
        <button className="rt-btn" onMouseDown={e=>{e.preventDefault();exec('justifyCenter');}} title="Center">≡</button>
        <button className="rt-btn" onMouseDown={e=>{e.preventDefault();exec('justifyRight');}} title="Align right">▪</button>
      </div>
      <div className="rich-toolbar-sep"/>
      <div className="rich-toolbar-group">
        <label className="rt-btn rt-color-btn" title="Text color">
          A
          <input type="color" style={{opacity:0,position:'absolute',width:0,height:0}} onChange={e=>setColor(e.target.value)}/>
        </label>
        <label className="rt-btn rt-color-btn" title="Highlight">
          🖊
          <input type="color" style={{opacity:0,position:'absolute',width:0,height:0}} onChange={e=>setHighlight(e.target.value)}/>
        </label>
      </div>
      <div className="rich-toolbar-sep"/>
      <div className="rich-toolbar-group">
        <button className="rt-btn rt-link-btn" onMouseDown={e=>{e.preventDefault();insertLink();}} title="Insert link">🔗 Link</button>
        <button className="rt-btn rt-table-btn" onMouseDown={e=>{e.preventDefault();insertTable();}} title="Insert table">⊞ Table</button>
      </div>
    </div>
  );
}

// ── SIGNATURE MANAGER ─────────────────────────────────────
export function SignatureManager({ onClose }) {
  const [sigs, setSigs] = useState(getSignatures());
  const [editing, setEditing] = useState(null); // {id, name, html, isDefault}
  const [isNew, setIsNew] = useState(false);
  const editorRef = useRef();

  const handleSave = () => {
    if (!editing?.name) return;
    const html = editorRef.current?.innerHTML || '';
    const updated = saveSignature({ ...editing, html });
    setSigs(updated);
    setEditing(null);
    setIsNew(false);
  };

  const handleDelete = (id) => {
    if (!window.confirm('Delete this signature?')) return;
    setSigs(deleteSignature(id));
  };

  const handleSetDefault = (id) => {
    setSigs(setDefaultSignature(id));
  };

  const startNew = () => {
    setEditing({ id: null, name: '', html: '', isDefault: false });
    setIsNew(true);
    setTimeout(() => { if (editorRef.current) editorRef.current.innerHTML = ''; }, 50);
  };

  const startEdit = (sig) => {
    setEditing(sig);
    setIsNew(false);
    setTimeout(() => { if (editorRef.current) editorRef.current.innerHTML = sig.html || ''; }, 50);
  };

  return (
    <div className="manager-overlay" onClick={e=>e.target.className==='manager-overlay'&&onClose()}>
      <div className="manager-popup">
        <div className="manager-header">
          <span>✍️ Signature Manager</span>
          <button className="manager-close" onClick={onClose}>✕</button>
        </div>
        <div className="manager-body">
          <div className="manager-list">
            <button className="manager-new-btn" onClick={startNew}>+ New Signature</button>
            {sigs.length === 0 && <div className="manager-empty">No signatures yet. Create one!</div>}
            {sigs.map(s => (
              <div key={s.id} className={`manager-item ${editing?.id===s.id?'active':''}`}>
                <div className="manager-item-info" onClick={()=>startEdit(s)}>
                  <span className="manager-item-name">{s.name}</span>
                  {s.isDefault && <span className="manager-default-badge">Default</span>}
                </div>
                <div className="manager-item-actions">
                  <button onClick={()=>handleSetDefault(s.id)} title="Set as default">⭐</button>
                  <button onClick={()=>startEdit(s)} title="Edit">✏️</button>
                  <button onClick={()=>handleDelete(s.id)} title="Delete">🗑️</button>
                </div>
              </div>
            ))}
          </div>
          <div className="manager-editor">
            {editing ? (
              <>
                <input
                  className="manager-name-input"
                  placeholder="Signature name..."
                  value={editing.name}
                  onChange={e=>setEditing({...editing,name:e.target.value})}
                />
                <RichToolbar editorRef={editorRef}/>
                <div
                  ref={editorRef}
                  className="manager-rich-editor"
                  contentEditable
                  suppressContentEditableWarning
                />
                <div className="manager-editor-footer">
                  <button className="btn-save" onClick={handleSave}>Save Signature</button>
                  <button className="btn-cancel" onClick={()=>{setEditing(null);setIsNew(false);}}>Cancel</button>
                </div>
              </>
            ) : (
              <div className="manager-editor-empty">
                <div>Select a signature to edit or create a new one</div>
                <div style={{fontSize:12,color:'#a0aec0',marginTop:8}}>Tip: Paste your Outlook signature directly into the editor and it will preserve all formatting!</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── TEMPLATE MANAGER ──────────────────────────────────────
export function TemplateManager({ onClose, onInsert }) {
  const [templates, setTemplates] = useState(getTemplates());
  const [editing, setEditing] = useState(null);
  const editorRef = useRef();

  const handleSave = () => {
    if (!editing?.name) return;
    const html = editorRef.current?.innerHTML || '';
    const updated = saveTemplate({ ...editing, body: html });
    setTemplates(updated);
    setEditing(null);
  };

  const handleDelete = (id) => {
    if (!window.confirm('Delete this template?')) return;
    setTemplates(deleteTemplate(id));
  };

  const startEdit = (tmpl) => {
    setEditing(tmpl);
    setTimeout(() => { if (editorRef.current) editorRef.current.innerHTML = tmpl.body || ''; }, 50);
  };

  const startNew = () => {
    setEditing({ id: null, name: '', subject: '', body: '' });
    setTimeout(() => { if (editorRef.current) editorRef.current.innerHTML = ''; }, 50);
  };

  return (
    <div className="manager-overlay" onClick={e=>e.target.className==='manager-overlay'&&onClose()}>
      <div className="manager-popup">
        <div className="manager-header">
          <span>📄 Template Manager</span>
          <button className="manager-close" onClick={onClose}>✕</button>
        </div>
        <div className="manager-body">
          <div className="manager-list">
            <button className="manager-new-btn" onClick={startNew}>+ New Template</button>
            {templates.map(t => (
              <div key={t.id} className={`manager-item ${editing?.id===t.id?'active':''}`}>
                <div className="manager-item-info" onClick={()=>startEdit(t)}>
                  <span className="manager-item-name">{t.name}</span>
                </div>
                <div className="manager-item-actions">
                  {onInsert && <button onClick={()=>{onInsert(t);onClose();}} title="Insert">📋</button>}
                  <button onClick={()=>startEdit(t)} title="Edit">✏️</button>
                  <button onClick={()=>handleDelete(t.id)} title="Delete">🗑️</button>
                </div>
              </div>
            ))}
          </div>
          <div className="manager-editor">
            {editing ? (
              <>
                <input className="manager-name-input" placeholder="Template name..." value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})}/>
                <input className="manager-subject-input" placeholder="Subject line..." value={editing.subject||''} onChange={e=>setEditing({...editing,subject:e.target.value})}/>
                <RichToolbar editorRef={editorRef}/>
                <div ref={editorRef} className="manager-rich-editor" contentEditable suppressContentEditableWarning/>
                <div className="manager-editor-footer">
                  <button className="btn-save" onClick={handleSave}>Save Template</button>
                  <button className="btn-cancel" onClick={()=>setEditing(null)}>Cancel</button>
                </div>
              </>
            ) : (
              <div className="manager-editor-empty">Select a template to edit or create a new one</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AI TABLE BUILDER ──────────────────────────────────────
export function AITableBuilder({ onInsert, onClose }) {
  const [carriers, setCarriers] = useState([
    { name: '', premium_ind: '', premium_spouse: '', premium_children: '', premium_family: '', deductible: '', max_oop: '', rx: '', wellness: '', pcp: '', specialist: '', urgent: '' },
    { name: '', premium_ind: '', premium_spouse: '', premium_children: '', premium_family: '', deductible: '', max_oop: '', rx: '', wellness: '', pcp: '', specialist: '', urgent: '' },
  ]);
  const [building, setBuilding] = useState(false);

  const addCarrier = () => setCarriers([...carriers, { name:'',premium_ind:'',premium_spouse:'',premium_children:'',premium_family:'',deductible:'',max_oop:'',rx:'',wellness:'',pcp:'',specialist:'',urgent:'' }]);
  const removeCarrier = (i) => setCarriers(carriers.filter((_,idx)=>idx!==i));
  const updateCarrier = (i, field, val) => setCarriers(carriers.map((c,idx)=>idx===i?{...c,[field]:val}:c));

  const buildTable = () => {
    const filled = carriers.filter(c => c.name);
    if (!filled.length) return;
    setBuilding(true);

    const cols = filled.map(c=>`<th style="background:#0d3d6e;color:white;padding:10px;border:1px solid #ccc;text-align:center;font-weight:600;min-width:120px">${c.name}<br><br><strong>Monthly Premium:</strong><br>Individual: ${c.premium_ind||'—'}<br>Member + Spouse: ${c.premium_spouse||'—'}<br>Member + Children: ${c.premium_children||'—'}<br>Family: ${c.premium_family||'—'}</th>`).join('');

    const rows = [
      ['Deductible', 'deductible'],
      ['Max Out-of-Pocket', 'max_oop'],
      ['Prescription Plan', 'rx'],
      ['Wellness Visits', 'wellness'],
      ['Physician Office Visit', 'pcp'],
      ['Specialist Office Visit', 'specialist'],
      ['Urgent Care Visit', 'urgent'],
    ].map(([label, field]) => {
      const cells = filled.map(c=>`<td style="padding:8px;border:1px solid #ccc;text-align:right">${c[field]||'—'}</td>`).join('');
      return `<tr><td style="padding:8px;border:1px solid #ccc;font-weight:600;background:#f9f9f9">${label}</td>${cells}</tr>`;
    }).join('');

    const table = `
<table border="1" style="border-collapse:collapse;width:100%;margin:16px 0;font-size:13px">
  <thead>
    <tr>
      <th style="background:#0d3d6e;color:white;padding:10px;border:1px solid #ccc;text-align:left;min-width:140px">Plan Highlights</th>
      ${cols}
    </tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
</table>
<p style="font-size:12px">***See attachment for full plan details</p>
<p><strong>Provider Lookup (Network)</strong></p>
${filled.map(c=>`<p>Visit <a href="https://www.${(c.name||'').toLowerCase().replace(/\s+/g,'')}.com">${c.name}</a> → Find a Doctor → Enter your zip code</p>`).join('')}
<br>`;

    setBuilding(false);
    onInsert(table);
    onClose();
  };

  const fields = [
    ['name','Carrier Name'],['premium_ind','Individual Premium'],['premium_spouse','Member+Spouse'],
    ['premium_children','Member+Children'],['premium_family','Family Premium'],['deductible','Deductible'],
    ['max_oop','Max Out-of-Pocket'],['rx','Prescription Plan'],['wellness','Wellness Visits'],
    ['pcp','PCP Office Visit'],['specialist','Specialist Visit'],['urgent','Urgent Care'],
  ];

  return (
    <div className="manager-overlay" onClick={e=>e.target.className==='manager-overlay'&&onClose()}>
      <div className="manager-popup" style={{maxWidth:900}}>
        <div className="manager-header">
          <span>⊞ Plan Comparison Table Builder</span>
          <button className="manager-close" onClick={onClose}>✕</button>
        </div>
        <div style={{padding:16,overflowY:'auto',maxHeight:'70vh'}}>
          <p style={{fontSize:12,color:'#718096',marginBottom:12}}>Enter plan details for each carrier. Leave blank to show "—". Click Build Table to insert into your email.</p>
          <div style={{overflowX:'auto'}}>
            <table style={{borderCollapse:'collapse',width:'100%',fontSize:12}}>
              <thead>
                <tr>
                  <td style={{padding:'4px 8px',fontWeight:600,color:'#555',minWidth:130}}>Field</td>
                  {carriers.map((c,i)=>(
                    <td key={i} style={{padding:'4px 8px',minWidth:140}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <span style={{fontWeight:600,fontSize:11,color:'#0078d4'}}>Carrier {i+1}</span>
                        {carriers.length>1 && <button onClick={()=>removeCarrier(i)} style={{background:'none',border:'none',cursor:'pointer',color:'#c53030',fontSize:14}}>✕</button>}
                      </div>
                    </td>
                  ))}
                  <td><button className="manager-new-btn" style={{fontSize:11,padding:'3px 8px'}} onClick={addCarrier}>+ Add</button></td>
                </tr>
              </thead>
              <tbody>
                {fields.map(([field,label])=>(
                  <tr key={field} style={{borderBottom:'1px solid #f0f0f0'}}>
                    <td style={{padding:'4px 8px',fontSize:11,color:'#555',fontWeight:field==='name'?600:400}}>{label}</td>
                    {carriers.map((c,i)=>(
                      <td key={i} style={{padding:'4px'}}>
                        <input
                          value={c[field]||''}
                          onChange={e=>updateCarrier(i,field,e.target.value)}
                          style={{width:'100%',border:'1px solid #e2e8f0',borderRadius:4,padding:'4px 6px',fontSize:12,fontFamily:'inherit'}}
                          placeholder={field==='name'?'e.g. BCBS PPO':field.includes('premium')?'$000':field==='deductible'?'$000':''}
                        />
                      </td>
                    ))}
                    <td/>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{display:'flex',gap:8,marginTop:16}}>
            <button className="btn-save" onClick={buildTable} disabled={building} style={{padding:'8px 20px'}}>
              {building?'Building...':'⊞ Build & Insert Table'}
            </button>
            <button className="btn-cancel" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MAIN COMPOSE POPUP ────────────────────────────────────
export function ComposePopup({ mode='compose', thread, userEmail, onSend, onDraft, onClose }) {
  const [to, setTo] = useState(mode==='reply'?thread?.fromEmail||'':'');
  const [cc, setCc] = useState('');
  const [bccOpen, setBccOpen] = useState(false);
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState(
    mode==='reply'?`Re: ${thread?.subject||''}`:
    mode==='forward'?`Fwd: ${thread?.subject||''}`:''
  );
  const [tone, setTone] = useState('professional');
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [showSigs, setShowSigs] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showTableBuilder, setShowTableBuilder] = useState(false);
  const [showSigManager, setShowSigManager] = useState(false);
  const [showTmplManager, setShowTmplManager] = useState(false);
  const [currentSig, setCurrentSig] = useState(null);
  const [sigs, setSigs] = useState(getSignatures());
  const [templates, setTemplates] = useState(getTemplates());
  const bodyRef = useRef();

  useEffect(() => {
    initDefaultTemplates();
    setTemplates(getTemplates());
    const defSig = getDefaultSignature();
    if (defSig) {
      setCurrentSig(defSig);
      setTimeout(() => {
        if (bodyRef.current) {
          bodyRef.current.innerHTML = `<br><br>${defSig.html}`;
          // Place cursor at top
          const range = document.createRange();
          const sel = window.getSelection();
          range.setStart(bodyRef.current, 0);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }, 100);
    }
  }, []);

  const handleAIDraft = async () => {
    setDrafting(true);
    const draft = await generateDraft({ thread, userEmail, tone, type: mode });
    if (bodyRef.current) {
      const sigHtml = currentSig ? `<br><br>${currentSig.html}` : '';
      bodyRef.current.innerHTML = draft.replace(/\n/g, '<br>') + sigHtml;
    }
    setDrafting(false);
  };

  const handleInsertTemplate = (tmpl) => {
    if (tmpl.subject) setSubject(tmpl.subject);
    if (bodyRef.current) {
      const sigHtml = currentSig ? `<br><br>${currentSig.html}` : '';
      bodyRef.current.innerHTML = (tmpl.body || '') + sigHtml;
    }
  };

  const handleInsertTable = (tableHtml) => {
    if (bodyRef.current) {
      const sel = window.getSelection();
      if (sel.rangeCount) {
        const range = sel.getRangeAt(0);
        const el = document.createElement('div');
        el.innerHTML = tableHtml;
        Array.from(el.childNodes).reverse().forEach(node => range.insertNode(node));
      } else {
        bodyRef.current.innerHTML += tableHtml;
      }
    }
  };

  const handleChangeSig = (sig) => {
    setCurrentSig(sig);
    if (bodyRef.current) {
      // Remove old sig and add new
      const content = bodyRef.current.innerHTML;
      const withoutSig = content.replace(/<br><br>[\s\S]*$/, '');
      bodyRef.current.innerHTML = withoutSig + (sig ? `<br><br>${sig.html}` : '');
    }
    setShowSigs(false);
  };

  const handleSend = async () => {
    if (!to && mode !== 'forward') return;
    setSending(true);
    try {
      const body = bodyRef.current?.innerHTML || '';
      await onSend({ to, cc, bcc, subject, body, threadId: thread?.id });
      onClose();
    } catch(e) { alert('Send failed: '+e.message); }
    setSending(false);
  };

  const handleDraft = async () => {
    const body = bodyRef.current?.innerHTML || '';
    await onDraft({ to, cc, subject, body, threadId: thread?.id });
    onClose();
  };

  return (
    <>
    <div className="compose-overlay" onClick={e=>e.target.className==='compose-overlay'&&onClose()}>
      <div className="compose-popup-v2">
        {/* HEADER */}
        <div className="compose-header-v2">
          <span className="compose-title-v2">
            {mode==='reply'?'↩ Reply':mode==='forward'?'↪ Forward':'✏️ New Message'}
            {thread&&mode!=='compose'?' — '+thread.from:''}
          </span>
          <button className="compose-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* FIELDS */}
        <div className="compose-fields-v2">
          <div className="cf-row-v2"><label>To</label><input value={to} onChange={e=>setTo(e.target.value)} placeholder="recipient@email.com"/><button className="cf-bcc-btn" onClick={()=>setBccOpen(!bccOpen)}>Cc/Bcc</button></div>
          {bccOpen && <>
            <div className="cf-row-v2"><label>Cc</label><input value={cc} onChange={e=>setCc(e.target.value)} placeholder=""/></div>
            <div className="cf-row-v2"><label>Bcc</label><input value={bcc} onChange={e=>setBcc(e.target.value)} placeholder=""/></div>
          </>}
          <div className="cf-row-v2"><label>Subject</label><input value={subject} onChange={e=>setSubject(e.target.value)}/></div>
        </div>

        {/* SECONDARY TOOLBAR */}
        <div className="compose-secondary-toolbar">
          {/* AI */}
          <div className="compose-ai-section">
            <span className="compose-ai-lbl">⚡ AI</span>
            <div className="tone-pills-v2">
              {['professional','friendly','brief','assertive'].map(t=>(
                <button key={t} className={`tone-pill-v2 ${tone===t?'active':''}`} onClick={()=>setTone(t)}>
                  {t.charAt(0).toUpperCase()+t.slice(1)}
                </button>
              ))}
            </div>
            <button className="ai-draft-btn" onClick={handleAIDraft} disabled={drafting}>
              {drafting?'Writing...':'✨ Draft'}
            </button>
          </div>
          <div className="compose-toolbar-sep"/>
          {/* TEMPLATES */}
          <div style={{position:'relative'}}>
            <button className="compose-tool-btn" onClick={()=>setShowTemplates(!showTemplates)}>📄 Templates ▾</button>
            {showTemplates && (
              <div className="compose-dropdown">
                {templates.map(t=>(
                  <div key={t.id} className="compose-dropdown-item" onClick={()=>{handleInsertTemplate(t);setShowTemplates(false);}}>
                    {t.name}
                  </div>
                ))}
                <div className="compose-dropdown-divider"/>
                <div className="compose-dropdown-item" onClick={()=>{setShowTmplManager(true);setShowTemplates(false);}}>
                  ⚙️ Manage Templates
                </div>
              </div>
            )}
          </div>
          {/* TABLE */}
          <button className="compose-tool-btn" onClick={()=>setShowTableBuilder(true)}>⊞ Plan Table</button>
          {/* SIGNATURE */}
          <div style={{position:'relative'}}>
            <button className="compose-tool-btn" onClick={()=>setShowSigs(!showSigs)}>
              ✍️ {currentSig?currentSig.name:'No Signature'} ▾
            </button>
            {showSigs && (
              <div className="compose-dropdown">
                <div className="compose-dropdown-item" onClick={()=>handleChangeSig(null)}>No Signature</div>
                {sigs.map(s=>(
                  <div key={s.id} className={`compose-dropdown-item ${currentSig?.id===s.id?'active':''}`} onClick={()=>handleChangeSig(s)}>
                    {s.name} {s.isDefault?'⭐':''}
                  </div>
                ))}
                <div className="compose-dropdown-divider"/>
                <div className="compose-dropdown-item" onClick={()=>{setShowSigManager(true);setShowSigs(false);}}>
                  ⚙️ Manage Signatures
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RICH TEXT TOOLBAR */}
        <RichToolbar editorRef={bodyRef}/>

        {/* BODY */}
        <div
          ref={bodyRef}
          className="compose-body-v2"
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Write your message here, or use AI Draft / Templates above..."
        />

        {/* QUOTED */}
        {thread && mode==='reply' && (
          <div className="compose-quoted-v2">
            <div className="compose-quoted-header-v2">——— Original Message ———<br/>From: {thread.from} &lt;{thread.fromEmail}&gt; | Subject: {thread.subject}</div>
          </div>
        )}

        {/* FOOTER */}
        <div className="compose-footer-v2">
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            <button className="compose-send-btn-v2" onClick={handleSend} disabled={sending}>
              📤 {sending?'Sending...':'Send'} <span style={{fontSize:10,opacity:.7}}>Ctrl+Enter</span>
            </button>
            <button className="compose-draft-btn-v2" onClick={handleDraft}>Save Draft</button>
            <label className="compose-attach-btn" title="Attach file">
              📎 Attach
              <input type="file" style={{display:'none'}} onChange={()=>alert('File attachment coming in next update!')}/>
            </label>
          </div>
          <button className="compose-discard-btn-v2" onClick={onClose}>Discard</button>
        </div>
      </div>
    </div>

    {/* SUB-MODALS */}
    {showTableBuilder && <AITableBuilder onInsert={handleInsertTable} onClose={()=>setShowTableBuilder(false)}/>}
    {showSigManager && <SignatureManager onClose={()=>{setShowSigManager(false);setSigs(getSignatures());}}/>}
    {showTmplManager && <TemplateManager onClose={()=>{setShowTmplManager(false);setTemplates(getTemplates());}} onInsert={handleInsertTemplate}/>}
    </>
  );
}
