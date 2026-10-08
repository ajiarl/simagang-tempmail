// Simagang Mail - Frontend Client
const API_BASE = 'https://tempik-pribadi.ajiarlando12575.workers.dev';
const POLL_INTERVAL_SEC = 4;

// State
let currentAddress = '';
let recentInboxes = [];
let currentMessages = [];
let selectedIndex = -1;
let countdown = POLL_INTERVAL_SEC;
let pollTimer = null;
let countdownTimer = null;

// DOM Elements
const currentAddressDisplay = document.getElementById('currentAddressDisplay');
const copyBtn = document.getElementById('copyBtn');
const copyBtnText = document.getElementById('copyBtnText');
const randomBtn = document.getElementById('randomBtn');
const refreshBtn = document.getElementById('refreshBtn');
const refreshTimer = document.getElementById('refreshTimer');
const customNameInput = document.getElementById('customNameInput');
const domainSelect = document.getElementById('domainSelect');
const setCustomBtn = document.getElementById('setCustomBtn');
const historyTags = document.getElementById('historyTags');
const messagesList = document.getElementById('messagesList');
const messageCountBadge = document.getElementById('messageCountBadge');

const readerPlaceholder = document.getElementById('readerPlaceholder');
const readerContent = document.getElementById('readerContent');
const msgSubject = document.getElementById('msgSubject');
const msgFrom = document.getElementById('msgFrom');
const msgTo = document.getElementById('msgTo');
const msgDate = document.getElementById('msgDate');

const smartCard = document.getElementById('smartCard');
const otpSection = document.getElementById('otpSection');
const otpCode = document.getElementById('otpCode');
const copyOtpBtn = document.getElementById('copyOtpBtn');
const linkSection = document.getElementById('linkSection');
const smartLink = document.getElementById('smartLink');

const tabBtns = document.querySelectorAll('.tab-btn');
const htmlFrame = document.getElementById('htmlFrame');
const textFrame = document.getElementById('textFrame');
const rawFrame = document.getElementById('rawFrame');
const themeToggle = document.getElementById('themeToggle');

// --- Initialization ---
function init() {
  loadTheme();
  loadInboxes();

  if (!currentAddress) {
    generateRandomAddress();
  } else {
    updateAddressUI();
  }

  setupEventListeners();
  startPolling();
}

// --- Theme Management ---
function loadTheme() {
  const theme = localStorage.getItem('simagang_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.textContent = theme === 'dark' ? '🌙' : '☀️';
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('simagang_theme', next);
  themeToggle.textContent = next === 'dark' ? '🌙' : '☀️';
}

// --- Address Management ---
function loadInboxes() {
  try {
    const saved = localStorage.getItem('simagang_inboxes');
    if (saved) recentInboxes = JSON.parse(saved);
    currentAddress = localStorage.getItem('simagang_current_address') || '';
  } catch (e) {
    recentInboxes = [];
  }
}

function saveInboxes() {
  localStorage.setItem('simagang_inboxes', JSON.stringify(recentInboxes));
  localStorage.setItem('simagang_current_address', currentAddress);
  renderHistoryTags();
}

function setAddress(addr) {
  currentAddress = addr.toLowerCase().trim();
  if (!recentInboxes.includes(currentAddress)) {
    recentInboxes.unshift(currentAddress);
    if (recentInboxes.length > 8) recentInboxes.pop();
  } else {
    // move to front
    recentInboxes = [currentAddress, ...recentInboxes.filter(x => x !== currentAddress)];
  }
  saveInboxes();
  updateAddressUI();
  selectedIndex = -1;
  fetchMessages(true);
}

function generateRandomAddress() {
  const prefixes = ['alpha', 'bravo', 'delta', 'fox', 'ghost', 'titan', 'volt', 'neo', 'zen', 'hyper'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const randNum = Math.floor(1000 + Math.random() * 9000);
  const domain = domainSelect.value || 'simagangapp.my.id';
  setAddress(`${prefix}_${randNum}@${domain}`);
}

function updateAddressUI() {
  currentAddressDisplay.textContent = currentAddress;
  renderHistoryTags();
}

function renderHistoryTags() {
  historyTags.innerHTML = '';
  recentInboxes.forEach(addr => {
    const tag = document.createElement('span');
    tag.className = `history-tag ${addr === currentAddress ? 'active' : ''}`;
    const namePart = addr.split('@')[0];
    tag.textContent = namePart;
    tag.title = addr;
    tag.onclick = () => setAddress(addr);
    historyTags.appendChild(tag);
  });
}

// --- Polling & Fetching ---
async function fetchMessages(resetLoading = false) {
  if (!currentAddress) return;

  if (resetLoading && currentMessages.length === 0) {
    messagesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-radar"></div>
        <p class="empty-title">Fetching inbox...</p>
        <p class="empty-desc">Checking for emails on Cloudflare Worker...</p>
      </div>`;
  }

  try {
    const res = await fetch(`${API_BASE}/inbox/${currentAddress}/messages`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error('Worker response ' + res.status);
    const data = await res.json();
    const msgs = Array.isArray(data.messages) ? data.messages : [];
    handleMessagesUpdate(msgs);
  } catch (err) {
    console.warn('Polling error:', err);
  }
}

function handleMessagesUpdate(msgs) {
  currentMessages = msgs;
  messageCountBadge.textContent = msgs.length;

  if (msgs.length === 0) {
    messagesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-radar"></div>
        <p class="empty-title">Waiting for emails...</p>
        <p class="empty-desc">Your temporary inbox is active and listening for incoming messages.</p>
      </div>`;
    readerPlaceholder.classList.remove('hidden');
    readerContent.classList.add('hidden');
    selectedIndex = -1;
    return;
  }

  // Render list
  messagesList.innerHTML = '';
  msgs.forEach((msg, idx) => {
    const card = document.createElement('div');
    card.className = `message-card ${idx === selectedIndex ? 'active' : ''}`;
    
    // Time formatted
    const dateStr = msg.ts ? formatRelativeTime(msg.ts) : 'Recently';

    card.innerHTML = `
      <div class="card-top">
        <span class="card-from" title="${escapeHtml(msg.from || 'Unknown')}">${escapeHtml(cleanSender(msg.from))}</span>
        <span class="card-time">${dateStr}</span>
      </div>
      <div class="card-subject" title="${escapeHtml(msg.subject || '(No Subject)')}">
        ${escapeHtml(msg.subject || '(No Subject)')}
      </div>
    `;

    card.onclick = () => selectMessage(idx);
    messagesList.appendChild(card);
  });

  // Auto-select first if none selected
  if (selectedIndex === -1 && msgs.length > 0) {
    selectMessage(0);
  }
}

function startPolling() {
  fetchMessages(true);

  if (countdownTimer) clearInterval(countdownTimer);
  countdown = POLL_INTERVAL_SEC;

  countdownTimer = setInterval(() => {
    countdown--;
    if (countdown <= 0) {
      countdown = POLL_INTERVAL_SEC;
      fetchMessages(false);
    }
    refreshTimer.textContent = `${countdown}s`;
  }, 1000);
}

// --- Message Selection & Parsing ---
function selectMessage(idx) {
  selectedIndex = idx;
  const msg = currentMessages[idx];
  if (!msg) return;

  // Highlight active in list
  document.querySelectorAll('.message-card').forEach((card, i) => {
    card.classList.toggle('active', i === idx);
  });

  readerPlaceholder.classList.add('hidden');
  readerContent.classList.remove('hidden');

  // Populate header
  msgSubject.textContent = msg.subject || '(No Subject)';
  msgFrom.textContent = msg.from || 'Unknown';
  msgTo.textContent = currentAddress;
  msgDate.textContent = msg.ts ? new Date(msg.ts).toLocaleString() : 'Unknown';

  // Parse MIME Body
  const parsed = parseMimeBody(msg.body || '');

  // Smart extraction: OTP & Verification links
  extractSmartInfo(msg.subject, parsed.plainText, parsed.html);

  // Set viewers
  htmlFrame.srcdoc = parsed.html || `<div style="font-family:sans-serif;padding:20px;color:#333;">${escapeHtml(parsed.plainText)}</div>`;
  textFrame.textContent = parsed.plainText || '(No plain text available)';
  rawFrame.textContent = msg.body || '(Empty body)';

  // Default to HTML tab
  switchTab('html');
}

// --- Smart Extractor ---
function extractSmartInfo(subject, text, html) {
  const combined = `${subject}\n${text}`;
  
  // 1. Find OTP (4-8 digits near verification keywords)
  let foundOtp = null;
  const otpPatterns = [
    /(?:code|otp|verification|pin|passcode|token)[^\d\n\r]{1,30}\b(\d{4,8})\b/i,
    /\b(\d{6})\b/,
    /\b(\d{4})\b/
  ];

  for (const regex of otpPatterns) {
    const match = combined.match(regex);
    if (match && match[1]) {
      foundOtp = match[1];
      break;
    }
  }

  // 2. Find Action / Verification Link
  let foundLink = null;
  const linkMatches = (html || text).match(/https?:\/\/[^\s"'<>\\]+/g) || [];
  for (const url of linkMatches) {
    const cleanUrl = url.replace(/[.,;)]+$/, '');
    if (/verify|confirm|activate|auth|token|signup/i.test(cleanUrl) && !/policy|css|js|png|jpg/i.test(cleanUrl)) {
      foundLink = cleanUrl;
      break;
    }
  }

  if (foundOtp || foundLink) {
    smartCard.classList.remove('hidden');
  } else {
    smartCard.classList.add('hidden');
  }

  if (foundOtp) {
    otpSection.classList.remove('hidden');
    otpCode.textContent = foundOtp;
    copyOtpBtn.onclick = () => {
      navigator.clipboard.writeText(foundOtp);
      copyOtpBtn.textContent = 'Copied!';
      setTimeout(() => copyOtpBtn.textContent = 'Copy Code', 2000);
    };
  } else {
    otpSection.classList.add('hidden');
  }

  if (foundLink) {
    linkSection.classList.remove('hidden');
    smartLink.href = foundLink;
  } else {
    linkSection.classList.add('hidden');
  }
}

// --- MIME Parser ---
function parseMimeBody(raw) {
  let html = '';
  let plainText = '';

  // Quoted printable unquote
  function decodeQP(input) {
    return input
      .replace(/=\r?\n/g, '')
      .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => {
        try {
          return decodeURIComponent('%' + hex);
        } catch (e) {
          return String.fromCharCode(parseInt(hex, 16));
        }
      });
  }

  // Check multipart boundary
  const boundaryMatch = raw.match(/boundary=["']?([^"'\r\n;]+)["']?/i);
  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = raw.split('--' + boundary);

    for (const part of parts) {
      if (/Content-Type:\s*text\/html/i.test(part)) {
        const bodyContent = part.split(/\r?\n\r?\n/)[1] || '';
        html = decodeQP(bodyContent);
      } else if (/Content-Type:\s*text\/plain/i.test(part)) {
        const bodyContent = part.split(/\r?\n\r?\n/)[1] || '';
        plainText = decodeQP(bodyContent);
      }
    }
  }

  // Fallback: search for <html ... </html>
  if (!html) {
    const htmlMatch = raw.match(/<html[\s\S]*?<\/html>/i);
    if (htmlMatch) {
      html = decodeQP(htmlMatch[0]);
    }
  }

  // Fallback plainText if still empty
  if (!plainText) {
    // Strip headers if any
    const splitIndex = raw.indexOf('\r\n\r\n');
    plainText = splitIndex !== -1 ? decodeQP(raw.slice(splitIndex + 4)) : decodeQP(raw);
  }

  return { html, plainText };
}

// --- Tab Switching ---
function switchTab(mode) {
  tabBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === mode));
  htmlFrame.classList.toggle('hidden', mode !== 'html');
  textFrame.classList.toggle('hidden', mode !== 'text');
  rawFrame.classList.toggle('hidden', mode !== 'raw');
}

// --- Event Listeners ---
function setupEventListeners() {
  themeToggle.onclick = toggleTheme;

  copyBtn.onclick = () => {
    navigator.clipboard.writeText(currentAddress);
    copyBtnText.textContent = 'Copied!';
    copyBtn.classList.replace('btn-primary', 'btn-success');
    setTimeout(() => {
      copyBtnText.textContent = 'Copy';
      copyBtn.classList.replace('btn-success', 'btn-primary');
    }, 2000);
  };

  randomBtn.onclick = generateRandomAddress;

  refreshBtn.onclick = () => {
    countdown = POLL_INTERVAL_SEC;
    refreshTimer.textContent = `${countdown}s`;
    fetchMessages(true);
  };

  setCustomBtn.onclick = () => {
    const name = customNameInput.value.replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase();
    if (!name) return;
    const domain = domainSelect.value;
    setAddress(`${name}@${domain}`);
    customNameInput.value = '';
  };

  customNameInput.onkeydown = (e) => {
    if (e.key === 'Enter') setCustomBtn.click();
  };

  tabBtns.forEach(btn => {
    btn.onclick = () => switchTab(btn.dataset.tab);
  });
}

// --- Helper Functions ---
function cleanSender(fromStr) {
  if (!fromStr) return 'Unknown';
  const match = fromStr.match(/^"?([^"<]+)"?\s*<.*>$/);
  return match ? match[1].trim() : fromStr;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[m]);
}

function formatRelativeTime(ts) {
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return new Date(ts).toLocaleDateString();
}

// Start app
document.addEventListener('DOMContentLoaded', init);
