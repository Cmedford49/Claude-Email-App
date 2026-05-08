const COLORS = ['#0078d4','#107c10','#c05621','#553c9a','#0987a0','#9b2c2c','#744210','#1a365d','#2c7a7b','#6b46c1','#276749','#c53030'];
export function avatarColor(name=''){let h=0;for(const c of name)h=(h*31+c.charCodeAt(0))%COLORS.length;return COLORS[h];}
export function initials(name=''){return name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();}

export function formatEmailDate(dateStr) {
  if (!dateStr) return '';
  const dt = new Date(dateStr);
  const now = new Date();
  const diff = now - dt;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today - 86400000);
  const dtDay = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  if (dtDay.getTime() === today.getTime()) return dt.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true});
  if (dtDay.getTime() === yesterday.getTime()) return 'Yesterday';
  if (diff < 604800000) return dt.toLocaleDateString('en-US',{weekday:'short'});
  return dt.toLocaleDateString('en-US',{month:'short',day:'numeric'});
}

export function groupThreadsByDate(threads) {
  const today = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today - 86400000);
  const weekAgo = new Date(today - 7*86400000);
  const groups = { Today:[], Yesterday:[], 'This Week':[], Older:[] };
  for (const t of threads) {
    const dt = new Date(t.date); dt.setHours(0,0,0,0);
    if (dt >= today) groups.Today.push(t);
    else if (dt >= yesterday) groups.Yesterday.push(t);
    else if (dt >= weekAgo) groups['This Week'].push(t);
    else groups.Older.push(t);
  }
  return groups;
}

export function classifyEmail(thread) {
  const s = (thread.subject||'').toLowerCase();
  const b = (thread.snippet||'').toLowerCase();
  const c = s+' '+b;
  if (c.includes('urgent')||c.includes('asap')||c.includes('immediately')||c.includes('lapse')||c.includes('deadline')||c.includes('not filled')) return 'urgent';
  if (c.includes('accepted')||c.includes('confirmed')||c.includes('follow-up')||c.includes('follow up')||c.includes('checking in')) return 'followup';
  if (c.includes('invoice')||c.includes('payment')||c.includes('declined')) return 'urgent';
  if (c.includes('linkedin')||c.includes('remind.com')||c.includes('newsletter')||c.includes('unsubscribe')||c.includes('notification')) return 'fyi';
  return 'action';
}

export const TAG_LABELS = { urgent:'Urgent', action:'Action', followup:'Follow-Up', fyi:'FYI' };
export const TAG_COLORS_MAP = { urgent:'#c53030', action:'#0078d4', followup:'#c05621', fyi:'#276749' };

// CRM helpers
export function getContacts(){try{return JSON.parse(localStorage.getItem('mhg_contacts')||'[]');}catch{return[];}}
export function saveContact(c){const all=getContacts();const i=all.findIndex(x=>x.email===c.email);if(i>=0)all[i]={...all[i],...c,updatedAt:new Date().toISOString()};else all.unshift({...c,id:Date.now().toString(),createdAt:new Date().toISOString()});localStorage.setItem('mhg_contacts',JSON.stringify(all));return all;}
export function getTasks(){try{return JSON.parse(localStorage.getItem('mhg_tasks')||'[]');}catch{return[];}}
export function saveTasks(tasks){localStorage.setItem('mhg_tasks',JSON.stringify(tasks));}
