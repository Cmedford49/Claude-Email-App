// Signature & Template Manager
// Stored in localStorage, persists across sessions

export function getSignatures() {
  try { return JSON.parse(localStorage.getItem('mhg_signatures') || '[]'); }
  catch { return []; }
}

export function saveSignature(sig) {
  const all = getSignatures();
  const i = all.findIndex(s => s.id === sig.id);
  if (i >= 0) all[i] = sig;
  else all.push({ ...sig, id: Date.now().toString() });
  localStorage.setItem('mhg_signatures', JSON.stringify(all));
  return all;
}

export function deleteSignature(id) {
  const all = getSignatures().filter(s => s.id !== id);
  localStorage.setItem('mhg_signatures', JSON.stringify(all));
  return all;
}

export function getDefaultSignature() {
  const all = getSignatures();
  return all.find(s => s.isDefault) || all[0] || null;
}

export function setDefaultSignature(id) {
  const all = getSignatures().map(s => ({ ...s, isDefault: s.id === id }));
  localStorage.setItem('mhg_signatures', JSON.stringify(all));
  return all;
}

export function getTemplates() {
  try { return JSON.parse(localStorage.getItem('mhg_templates') || '[]'); }
  catch { return []; }
}

export function saveTemplate(tmpl) {
  const all = getTemplates();
  const i = all.findIndex(t => t.id === tmpl.id);
  if (i >= 0) all[i] = tmpl;
  else all.push({ ...tmpl, id: Date.now().toString(), createdAt: new Date().toISOString() });
  localStorage.setItem('mhg_templates', JSON.stringify(all));
  return all;
}

export function deleteTemplate(id) {
  const all = getTemplates().filter(t => t.id !== id);
  localStorage.setItem('mhg_templates', JSON.stringify(all));
  return all;
}

// Default starter templates
export function initDefaultTemplates() {
  if (getTemplates().length > 0) return;
  const defaults = [
    {
      id: 'tmpl_1', name: 'Health Coverage Follow-up',
      subject: 'Health Coverage Follow Up with Christian',
      body: `Hi [NAME],<br><br>Thanks for filling out my form about your health insurance. Here is some of the information I found based off of my search. Please take a look at the below table with the basics. After you take a look, I expect plenty of good questions. So let me know when you would like to chat next to go over details and other pieces that are important to you!<br><br>I hope that you find this helpful and if you would like to learn more or ask any specific questions, lets schedule an appointment with me, Click here: <a href="https://calendly.com/medfordmadeinsurance">https://calendly.com/medfordmadeinsurance</a><br><br>[INSERT PLAN COMPARISON TABLE]`,
    },
    {
      id: 'tmpl_2', name: 'Payment Update',
      subject: 'Important: Payment Update Required',
      body: `Hi [NAME],<br><br>I wanted to reach out regarding a payment update needed for your current health insurance policy. To avoid any lapse in coverage, please update your payment information as soon as possible.<br><br>If you have any questions or need assistance, please don't hesitate to reach out.<br><br>`,
    },
    {
      id: 'tmpl_3', name: 'Medicare Introduction',
      subject: 'Medicare Options — Medford Health Group',
      body: `Hi [NAME],<br><br>As you approach Medicare eligibility, I wanted to reach out to help you navigate your options. There are several Medicare plans available that could provide excellent coverage at a great value.<br><br>I would love to schedule a time to go over your options and find the best plan for your needs. Click here to book a time: <a href="https://calendly.com/medfordmadeinsurance">https://calendly.com/medfordmadeinsurance</a><br><br>`,
    },
    {
      id: 'tmpl_4', name: 'Welcome LifeX / Cigna',
      subject: 'Welcome — Your New LifeX/Cigna Coverage',
      body: `Hi [NAME],<br><br>Welcome! I'm excited to confirm that your new health coverage is set up and ready to go. Here are your next steps:<br><br><ol><li>Download the Cigna app to access your benefits</li><li>Your ID cards will arrive within 7-10 business days</li><li>Your coverage begins on [START DATE]</li></ol><br>Please don't hesitate to reach out with any questions!<br><br>`,
    },
    {
      id: 'tmpl_5', name: 'Network Change to PHCS',
      subject: 'Important: Network Change to PHCS',
      body: `Hi [NAME],<br><br>I wanted to make you aware of an important network change. Your plan is transitioning to the PHCS network. Here's what you need to know:<br><br><ul><li>The PHCS network has thousands of providers nationwide</li><li>Please verify your doctors are in-network at <a href="https://www.multiplan.com">www.multiplan.com</a></li><li>Your benefits remain the same</li></ul><br>Please reach out if you have any questions about this change.<br><br>`,
    },
    {
      id: 'tmpl_6', name: 'IH Re-enrollment',
      subject: 'Time to Re-enroll — Your Health Coverage',
      body: `Hi [NAME],<br><br>It's time to review and renew your health insurance coverage. I want to make sure you have the best plan for your needs going into the new year.<br><br>Let's schedule a quick call to review your options. Click here: <a href="https://calendly.com/medfordmadeinsurance">https://calendly.com/medfordmadeinsurance</a><br><br>`,
    },
  ];
  localStorage.setItem('mhg_templates', JSON.stringify(defaults));
}
