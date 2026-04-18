/* ============================================================
   DESIGN FEEDBACK HUB - Full SPA JavaScript
   ============================================================ */

// =================== STATE ===================
const State = {
  user: null,
  token: null,
  page: 'home',
  designs: [], total: 0, currentPage: 1,
  filters: { category: 'All', sort: 'latest', search: '' },
  notifications: [],
  sseConnection: null,
};

// =================== API ===================
const API = {
  base: '/api',
  async req(method, url, body, isForm = false) {
    const opts = {
      method,
      headers: State.token ? { Authorization: `Bearer ${State.token}` } : {}
    };
    if (body && !isForm) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    } else if (body && isForm) {
      opts.body = body;
    }
    const res = await fetch(this.base + url, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },
  get: (url) => API.req('GET', url),
  post: (url, body, isForm) => API.req('POST', url, body, isForm),
  put: (url, body) => API.req('PUT', url, body),
  del: (url) => API.req('DELETE', url),
};

// =================== AUTH ===================
function loadAuth() {
  const saved = localStorage.getItem('dfh_token');
  const user = localStorage.getItem('dfh_user');
  if (saved && user) {
    State.token = saved;
    State.user = JSON.parse(user);
    updateNavForAuth();
    connectSSE();
  }
}
function saveAuth(token, user) {
  State.token = token;
  State.user = user;
  localStorage.setItem('dfh_token', token);
  localStorage.setItem('dfh_user', JSON.stringify(user));
  updateNavForAuth();
  connectSSE();
}
function clearAuth() {
  State.token = null;
  State.user = null;
  localStorage.removeItem('dfh_token');
  localStorage.removeItem('dfh_user');
  if (State.sseConnection) { State.sseConnection.close(); State.sseConnection = null; }
  updateNavForAuth();
  navigate('home');
}

// =================== SSE REAL-TIME ===================
function connectSSE() {
  if (!State.user || State.sseConnection) return;
  const es = new EventSource(`/api/events/${State.user.id}`);
  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.type === 'notification') {
        State.notifications.unshift(data.notification);
        updateNotifBadge();
        showToast(`🔔 ${data.notification.message}`, 'info');
        renderNotifList();
      }
    } catch {}
  };
  es.onerror = () => { es.close(); State.sseConnection = null; };
  State.sseConnection = es;
}

async function loadNotifications() {
  if (!State.user) return;
  try {
    State.notifications = await API.get('/notifications');
    updateNotifBadge();
    renderNotifList();
  } catch {}
}

function updateNotifBadge() {
  const unread = State.notifications.filter(n => !n.isRead).length;
  const badge = id('notif-badge');
  if (badge) {
    badge.textContent = unread;
    badge.style.display = unread > 0 ? 'flex' : 'none';
  }
}

function renderNotifList() {
  const list = id('notif-list');
  if (!list) return;
  if (State.notifications.length === 0) {
    list.innerHTML = '<div class="notif-empty">No notifications yet</div>';
    return;
  }
  list.innerHTML = State.notifications.map(n => `
    <div class="notif-item ${n.isRead ? '' : 'unread'}" data-id="${n.id}" data-link="${n.link || ''}">
      <div class="notif-msg">${escHtml(n.message)}</div>
      <div class="notif-time">${timeAgo(n.createdAt)}</div>
    </div>
  `).join('');
  list.querySelectorAll('.notif-item').forEach(el => {
    el.addEventListener('click', async () => {
      const nid = el.dataset.id;
      const link = el.dataset.link;
      try { await API.put(`/notifications/${nid}/read`); } catch {}
      const n = State.notifications.find(x => x.id == nid);
      if (n) n.isRead = true;
      updateNotifBadge();
      el.classList.remove('unread');
      if (link) { closeNotifPanel(); window.location.hash = link; handleHash(); }
    });
  });
}

// =================== NAV UPDATE ===================
function updateNavForAuth() {
  const authed = !!State.user;
  show('notification-btn', authed);
  show('user-menu', authed);
  show('nav-upload-btn', authed);
  show('nav-dashboard-btn', authed);
  show('auth-buttons', !authed);

  if (authed) {
    const initials = (State.user.fullName || State.user.username).split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    setText('user-initials', initials);
    setText('dropdown-name', State.user.fullName || State.user.username);
    setText('dropdown-level', State.user.level || 'Beginner');
    loadNotifications();
  }
}

// =================== NAVIGATION ===================
function navigate(page, params = {}) {
  State.page = page;
  State.params = params;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  renderPage();
  setActiveNavLink(page);
}

function setActiveNavLink(page) {
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  if (page === 'explore') id('nav-explore')?.classList.add('active');
}

function handleHash() {
  const hash = window.location.hash.replace('#', '');
  if (hash.startsWith('design/')) {
    const designId = hash.split('/')[1];
    navigate('design-detail', { designId });
  }
}

// =================== PAGE RENDERER ===================
function renderPage() {
  const app = id('app');
  switch (State.page) {
    case 'home': app.innerHTML = renderHeroPage(); bindHeroEvents(); break;
    case 'explore': app.innerHTML = renderExplorePage(); bindExploreEvents(); loadDesigns(); break;
    case 'design-detail': app.innerHTML = '<div class="page"><div class="loading-spinner"></div></div>'; loadDesignDetail(State.params.designId); break;
    case 'dashboard': app.innerHTML = '<div class="page"><div class="loading-spinner"></div></div>'; loadDashboard(); break;
    case 'profile': app.innerHTML = '<div class="page"><div class="loading-spinner"></div></div>'; loadProfile(State.params.userId); break;
    default: navigate('home');
  }
}

// =================== HOME PAGE ===================
function renderHeroPage() {
  return `
  <section class="hero">
    <div class="hero-bg"></div>
    <div class="hero-grid"></div>
    <div class="hero-content">
      <div class="hero-badge">
        <span class="badge-dot"></span>
        Structured Design Feedback
      </div>
      <h1 class="hero-title">
        Where Great Design<br>Gets <span class="gradient-text">Even Better</span>
      </h1>
      <p class="hero-subtitle">
        Upload your designs and receive structured, meaningful feedback from a community of designers.
        Rate colors, typography, layout, and UX — no more empty comments.
      </p>
      <div class="hero-actions">
        <button class="btn btn-primary btn-lg" id="hero-explore-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          Explore Designs
        </button>
        <button class="btn btn-secondary btn-lg" id="hero-join-btn">
          ${State.user ? 'Upload a Design' : 'Join for Free'}
        </button>
      </div>
      <div class="hero-stats">
        <div class="hero-stat"><div class="stat-value">500+</div><div class="stat-label">Designs Shared</div></div>
        <div class="hero-stat"><div class="stat-value">1.2K+</div><div class="stat-label">Feedbacks Given</div></div>
        <div class="hero-stat"><div class="stat-value">4.8★</div><div class="stat-label">Avg Quality Score</div></div>
        <div class="hero-stat"><div class="stat-value">300+</div><div class="stat-label">Designers</div></div>
      </div>
    </div>
  </section>`;
}
function bindHeroEvents() {
  id('hero-explore-btn')?.addEventListener('click', () => navigate('explore'));
  id('hero-join-btn')?.addEventListener('click', () => {
    if (State.user) openUploadModal();
    else openAuthModal('register');
  });
}

// =================== EXPLORE PAGE ===================
function renderExplorePage() {
  const categories = ['All','UI/UX','Logo','Poster','Branding','Web','Mobile','Illustration','Other'];
  return `
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">Explore Designs</h1>
      <p class="page-subtitle">Discover and review amazing work from the community</p>
    </div>
    <div class="filter-bar">
      <div class="search-box">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input type="text" id="search-input" placeholder="Search designs..." value="${escHtml(State.filters.search)}">
      </div>
      <select class="sort-select" id="sort-select">
        <option value="latest" ${State.filters.sort === 'latest' ? 'selected' : ''}>Latest</option>
        <option value="rating" ${State.filters.sort === 'rating' ? 'selected' : ''}>Top Rated</option>
        <option value="popular" ${State.filters.sort === 'popular' ? 'selected' : ''}>Most Reviewed</option>
      </select>
      ${State.user ? `<button class="btn btn-primary btn-sm" id="explore-upload-btn">+ Upload Design</button>` : ''}
    </div>
    <div class="filter-chips" id="category-chips">
      ${categories.map(c => `<div class="filter-chip ${State.filters.category === c ? 'active' : ''}" data-cat="${c}">${c}</div>`).join('')}
    </div>
    <div style="margin-top:32px" id="designs-container">
      <div class="loading-spinner"></div>
    </div>
    <div id="pagination-container"></div>
  </div>`;
}
function bindExploreEvents() {
  let searchTimeout;
  id('search-input')?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      State.filters.search = e.target.value;
      State.currentPage = 1;
      loadDesigns();
    }, 400);
  });
  id('sort-select')?.addEventListener('change', (e) => {
    State.filters.sort = e.target.value;
    State.currentPage = 1;
    loadDesigns();
  });
  id('category-chips')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    State.filters.category = chip.dataset.cat;
    State.currentPage = 1;
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    loadDesigns();
  });
  id('explore-upload-btn')?.addEventListener('click', openUploadModal);
}

async function loadDesigns() {
  const container = id('designs-container');
  const paginationContainer = id('pagination-container');
  if (!container) return;
  container.innerHTML = '<div class="loading-spinner"></div>';

  try {
    const { category, sort, search } = State.filters;
    const params = new URLSearchParams({ sort, page: State.currentPage, limit: 12 });
    if (category !== 'All') params.set('category', category);
    if (search) params.set('search', search);

    const data = await API.get(`/designs?${params}`);
    State.designs = data.designs;
    State.total = data.total;

    if (!data.designs.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎨</div>
          <div class="empty-title">No designs found</div>
          <div class="empty-text">Try different filters or be the first to upload in this category!</div>
          ${State.user ? `<button class="btn btn-primary" id="empty-upload-btn">Upload Your Design</button>` : ''}
        </div>`;
      id('empty-upload-btn')?.addEventListener('click', openUploadModal);
    } else {
      container.innerHTML = `<div class="designs-grid">${data.designs.map((d, index) => renderDesignCard(d, index)).join('')}</div>`;
      container.querySelectorAll('.design-card').forEach(card => {
        card.addEventListener('click', () => navigate('design-detail', { designId: card.dataset.id }));
      });
    }

    // Pagination
    if (data.pages > 1 && paginationContainer) {
      paginationContainer.innerHTML = `
        <div class="pagination">
          ${Array.from({ length: data.pages }, (_, i) => i + 1).map(p =>
            `<div class="page-btn ${p === State.currentPage ? 'active' : ''}" data-page="${p}">${p}</div>`
          ).join('')}
        </div>`;
      paginationContainer.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          State.currentPage = parseInt(btn.dataset.page);
          loadDesigns();
          window.scrollTo({ top: 0 });
        });
      });
    } else if (paginationContainer) {
      paginationContainer.innerHTML = '';
    }
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Failed to load designs</div><div class="empty-text">${escHtml(err.message)}</div></div>`;
  }
}

function renderDesignCard(d, index = 0) {
  const imgSrc = d.imageUrl || d.externalUrl;
  const hasRating = d.feedbackCount > 0;
  const stars = hasRating ? '★'.repeat(Math.round(d.avgOverall)) + '☆'.repeat(5 - Math.round(d.avgOverall)) : null;
  const authorName = d.author ? (d.author.fullName || d.author.username) : 'Unknown';
  const initials = authorName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return `
  <div class="design-card animate-card" data-id="${d.id}" style="animation-delay: ${index * 0.08}s">
    <div class="design-card-image">
      <img src="${escHtml(imgSrc)}" alt="${escHtml(d.title)}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=600&q=70'">
      <div class="design-card-category">${escHtml(d.category)}</div>
      <div class="design-card-overlay"><div class="card-view-btn">View Design</div></div>
    </div>
    <div class="design-card-body">
      <div class="design-card-title">${escHtml(d.title)}</div>
      <div class="design-card-author">
        <div class="card-avatar">${initials}</div>
        ${escHtml(authorName)}
        ${d.author?.level ? `<span style="margin-left:auto;font-size:0.7rem;padding:2px 8px;border-radius:9999px;background:rgba(124,106,255,0.1);color:#7c6aff">${d.author.level}</span>` : ''}
      </div>
      <div class="design-card-ratings">
        ${hasRating
          ? `<div class="rating-chip"><span class="star">★</span>${parseFloat(d.avgOverall).toFixed(1)}</div>
             <div class="rating-chip">🎨 ${parseFloat(d.avgColors).toFixed(1)}</div>
             <div class="rating-chip">Aa ${parseFloat(d.avgTypography).toFixed(1)}</div>
             <div class="rating-chip">📐 ${parseFloat(d.avgLayout).toFixed(1)}</div>
             <div class="rating-chip" style="margin-left:auto;color:var(--text-muted)">${d.feedbackCount} review${d.feedbackCount !== 1 ? 's' : ''}</div>`
          : `<div class="rating-chip"><span class="no-rating">No reviews yet</span></div>`
        }
      </div>
    </div>
  </div>`;
}

// =================== DESIGN DETAIL ===================
async function loadDesignDetail(designId) {
  try {
    const design = await API.get(`/designs/${designId}`);
    const app = id('app');
    app.innerHTML = renderDesignDetail(design);
    bindDetailEvents(design);
  } catch (err) {
    id('app').innerHTML = `<div class="page"><div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Design not found</div><button class="btn btn-primary mt-16" onclick="navigate('explore')">Back to Explore</button></div></div>`;
  }
}

function renderDesignDetail(d) {
  const imgSrc = d.imageUrl || d.externalUrl;
  const hasRating = d.feedbackCount > 0;
  const authorName = d.author ? (d.author.fullName || d.author.username) : 'Unknown';
  const authorInitials = authorName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const isOwner = State.user && d.userId === State.user.id;
  const hasReviewed = d.feedbacks && State.user && d.feedbacks.some(f => f.userId === State.user.id);

  return `
  <div class="page">
    <div style="margin-bottom:20px">
      <button class="btn btn-ghost btn-sm" id="back-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
        Back to Explore
      </button>
    </div>
    <div class="detail-layout">
      <div>
        <div class="design-image-wrapper">
          <img src="${escHtml(imgSrc)}" alt="${escHtml(d.title)}" onerror="this.src='https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800&q=70'">
          ${d.externalUrl ? `<a href="${escHtml(d.externalUrl)}" target="_blank" class="design-ext-link">🔗 View on Figma / Behance</a>` : ''}
        </div>

        <div class="feedback-section">
          <h2 class="section-title">Community Feedback <span style="color:var(--text-muted);font-size:1rem;font-weight:400">(${d.feedbackCount || 0})</span></h2>
          ${(!d.feedbacks || !d.feedbacks.length)
            ? `<div class="empty-state" style="padding:40px 0">
                <div class="empty-icon">💬</div>
                <div class="empty-title">No feedback yet</div>
                <div class="empty-text">Be the first to review this design and help the creator grow!</div>
               </div>`
            : (d.feedbacks || []).map(renderFeedbackCard).join('')
          }
        </div>
      </div>

      <div class="detail-sidebar">
        <div class="design-info-card">
          <div class="design-category-badge">${escHtml(d.category)}</div>
          <h1 class="design-detail-title">${escHtml(d.title)}</h1>
          ${d.description ? `<p class="design-detail-desc">${escHtml(d.description)}</p>` : ''}
          ${d.tags ? `<div class="design-tags">${d.tags.split(',').filter(Boolean).map(t => `<span class="tag">#${escHtml(t.trim())}</span>`).join('')}</div>` : ''}
          <div class="divider"></div>
          <div class="design-author-row">
            <div class="author-avatar">${authorInitials}</div>
            <div>
              <div class="author-name">${escHtml(authorName)}</div>
              <div class="author-level">${d.author?.level || 'Designer'}</div>
            </div>
            ${!isOwner ? `<button class="btn btn-secondary btn-sm" style="margin-left:auto" id="visit-profile-btn" data-uid="${d.userId}">View Profile</button>` : ''}
          </div>
          <div style="margin-top:16px; color:var(--text-muted); font-size:0.8rem">
            Uploaded ${timeAgo(d.createdAt)}
          </div>
        </div>

        <div class="ratings-summary">
          <h3>Rating Breakdown</h3>
          ${hasRating ? `
          <div class="overall-score">
            <div class="score-value gold">${parseFloat(d.avgOverall).toFixed(1)}</div>
            <div class="score-stars">${'★'.repeat(Math.round(d.avgOverall))}${'☆'.repeat(5 - Math.round(d.avgOverall))}</div>
            <div class="score-count">${d.feedbackCount} review${d.feedbackCount !== 1 ? 's' : ''}</div>
          </div>
          ${[
            { label: 'Colors', val: d.avgColors },
            { label: 'Typography', val: d.avgTypography },
            { label: 'Layout', val: d.avgLayout },
            { label: 'UX', val: d.avgUX },
          ].map(r => `
            <div class="rating-row">
              <span class="rating-label">${r.label}</span>
              <div class="rating-bar-bg"><div class="rating-bar-fill" style="width:${(r.val / 5) * 100}%"></div></div>
              <span class="rating-num">${parseFloat(r.val).toFixed(1)}</span>
            </div>
          `).join('')}
          ` : `<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:0.9rem">No ratings yet. Be the first to review!</div>`}
        </div>

        <div>
          ${!isOwner ? `
            <div style="margin-bottom:16px;">
              ${hasReviewed
                ? `<div style="text-align:center;padding:16px;color:var(--accent-green);font-weight:600;background:rgba(34,197,94,0.05);border:1px solid rgba(34,197,94,0.2);border-radius:var(--radius-md)">✅ You reviewed this design</div>`
                : State.user
                  ? `<button class="btn btn-secondary btn-full" id="write-feedback-btn">✏️ Write a Review</button>`
                  : `<div style="text-align:center">
                       <p style="color:var(--text-muted);font-size:0.875rem;margin-bottom:12px">Sign in to leave feedback</p>
                       <button class="btn btn-secondary btn-full" id="signin-to-feedback">Sign In</button>
                     </div>`
              }
            </div>
          ` : `
            <div style="text-align:center;padding:12px;margin-bottom:16px;color:var(--text-muted);font-size:0.875rem;background:var(--bg-secondary);border-radius:var(--radius-md)">
              This is your design. Share it with the community!
            </div>
          `}

          ${(d.feedbacks && d.feedbacks.some(f => f.reviewer?.username === 'ai_bot'))
            ? `<div style="text-align:center;padding:16px;color:var(--accent-primary);font-weight:600;background:rgba(252,96,54,0.05);border:1px solid rgba(252,96,54,0.2);border-radius:var(--radius-md)">✨ AI Analysis Completed</div>`
            : State.user
              ? `<button class="btn btn-primary btn-full btn-lg ai-pulse" id="ask-ai-btn" data-design-id="${d.id}">
                   <span style="font-size:1.2rem;margin-right:8px">🤖</span> Analyze Design with AI Vision
                 </button>`
              : `<div style="text-align:center">
                   <p style="color:var(--text-muted);font-size:0.875rem;margin-bottom:12px">Sign in to unlock AI Design Analysis</p>
                   <button class="btn btn-primary btn-full" id="signin-to-feedback-ai">Sign In to Analyze</button>
                 </div>`
          }
        </div>

      </div>
    </div>
  </div>`;
}

function renderFeedbackCard(f) {
  const reviewer = f.reviewer;
  const isAI = reviewer && reviewer.username === 'ai_bot';
  const name = reviewer ? (reviewer.fullName || reviewer.username) : 'Anonymous';
  const initials = isAI ? '🤖' : name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colorClass = (val) => val >= 5 ? 'r5' : val >= 4 ? 'r4' : val >= 3 ? 'r3' : val >= 2 ? 'r2' : 'r1';
  // Use markdown renderer for AI comments, escHtml for human comments
  const commentHtml = isAI ? markdownToHtml(f.comment) : `<p>${escHtml(f.comment)}</p>`;

  return `
  <div class="feedback-card ${isAI ? 'ai-style-card' : ''}">
    <div class="feedback-header">
      <div class="feedback-reviewer">
        <div class="reviewer-avatar ${isAI ? 'ai-avatar-glow' : ''}">${initials}</div>
        <div>
          <div class="reviewer-name">${isAI ? '<span class="ai-name-badge">⚡ AI Vision Critic</span>' : escHtml(name)}</div>
          <div class="reviewer-level">${isAI ? 'Powered by Gemini' : (reviewer?.level || 'Designer')}</div>
        </div>
      </div>
      <div class="feedback-date">${timeAgo(f.createdAt)}</div>
    </div>
    <div class="feedback-ratings">
      ${[
        { label: '🎨 Colors', val: f.colorsRating },
        { label: 'Aa Typography', val: f.typographyRating },
        { label: '📐 Layout', val: f.layoutRating },
        { label: '✦ UX', val: f.uxRating },
      ].map(r => `
        <div class="feedback-rating-item">
          <div class="f-label">${r.label}</div>
          <div class="f-val ${colorClass(r.val)}">${Number(r.val).toFixed(1)}/5</div>
        </div>
      `).join('')}
    </div>
    <div class="feedback-comment ${isAI ? 'ai-comment-body' : ''}">${commentHtml}</div>
    ${f.aiSuggestion ? `
    <div class="ai-suggestion">
      <div class="ai-icon">💡</div>
      <div class="ai-text"><strong>Key Recommendation:</strong> ${escHtml(f.aiSuggestion)}</div>
    </div>` : ''}
    <div class="feedback-footer">
      <button class="helpful-btn" data-fid="${f.id}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
        Helpful (${f.helpful || 0})
      </button>
      <div class="overall-chip">★ ${parseFloat(f.overallRating).toFixed(1)} overall</div>
    </div>
  </div>`;
}

function bindDetailEvents(design) {
  id('back-btn')?.addEventListener('click', () => navigate('explore'));
  id('visit-profile-btn')?.addEventListener('click', (e) => navigate('profile', { userId: e.target.dataset.uid }));
  id('signin-to-feedback')?.addEventListener('click', () => openAuthModal('login'));

  id('ask-ai-btn')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const did = btn.dataset.designId;
    btn.disabled = true;

    // Show cinematic AI analysis modal
    showAIAnalysisModal();

    try {
      await API.post(`/designs/${did}/analyze`);
      closeAIAnalysisModal(true);
      setTimeout(() => {
        showToast('⚡ AI Analysis Complete! Gemini has reviewed your design.', 'success');
        loadDesignDetail(did);
      }, 600);
    } catch(err) {
      closeAIAnalysisModal(false);
      showToast('AI Error: ' + err.message, 'error');
      btn.disabled = false;
    }
  });

  document.querySelectorAll('.helpful-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!State.user) { showToast('Sign in to mark feedback as helpful', 'error'); return; }
      try {
        const data = await API.post(`/feedback/${btn.dataset.fid}/helpful`);
        btn.innerHTML = btn.innerHTML.replace(/\d+/, data.helpful);
        btn.style.color = 'var(--accent-green)';
      } catch {}
    });
  });
}

// =================== DASHBOARD ===================
async function loadDashboard() {
  if (!State.user) { navigate('home'); return; }
  try {
    const data = await API.get('/users/dashboard/me');
    id('app').innerHTML = renderDashboard(data);
    bindDashboardEvents(data);
  } catch (err) {
    id('app').innerHTML = `<div class="page"><div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Failed to load dashboard</div></div></div>`;
  }
}

function renderDashboard(data) {
  const { user, designs, feedbackGiven, feedbackReceived, analytics } = data;
  const initials = (user.fullName || user.username).split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const skills = user.skills ? user.skills.split(',').map(s => s.trim()).filter(Boolean) : [];

  return `
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">My Dashboard</h1>
      <p class="page-subtitle">Your design journey at a glance</p>
    </div>

    <div class="profile-hero">
      <div class="profile-avatar">${initials}</div>
      <div class="profile-name">${escHtml(user.fullName || user.username)}</div>
      <div class="profile-username">@${escHtml(user.username)}</div>
      <div class="profile-level">${user.level || 'Beginner'}</div>
      ${user.bio ? `<div class="profile-bio">${escHtml(user.bio)}</div>` : ''}
      ${skills.length ? `<div class="profile-skills">${skills.map(s => `<span class="skill-tag">${escHtml(s)}</span>`).join('')}</div>` : ''}
      <div style="margin-top:16px">
        <button class="btn btn-secondary btn-sm" id="edit-profile-btn">Edit Profile</button>
      </div>
    </div>

    <div class="dashboard-grid">
      <div class="dash-stat-card">
        <div class="dash-stat-icon" style="background:rgba(124,106,255,0.15)">🎨</div>
        <div><div class="dash-stat-value">${analytics.totalDesigns}</div><div class="dash-stat-label">Designs Uploaded</div></div>
      </div>
      <div class="dash-stat-card">
        <div class="dash-stat-icon" style="background:rgba(34,197,94,0.15)">💬</div>
        <div><div class="dash-stat-value">${analytics.totalFeedbackGiven}</div><div class="dash-stat-label">Feedbacks Given</div></div>
      </div>
      <div class="dash-stat-card">
        <div class="dash-stat-icon" style="background:rgba(168,85,247,0.15)">📬</div>
        <div><div class="dash-stat-value">${analytics.totalFeedbackReceived}</div><div class="dash-stat-label">Feedbacks Received</div></div>
      </div>
      <div class="dash-stat-card">
        <div class="dash-stat-icon" style="background:rgba(234,179,8,0.15)">⭐</div>
        <div><div class="dash-stat-value">${parseFloat(analytics.avgRatingReceived || 0).toFixed(1)}</div><div class="dash-stat-label">Avg Rating Received</div></div>
      </div>
    </div>

    <div class="dash-section">
      <div class="dash-section-header">
        <h2 class="dash-section-title">My Designs</h2>
        <button class="btn btn-primary btn-sm" id="dash-upload-btn">+ Upload New</button>
      </div>
      ${!designs.length
        ? `<div class="empty-state" style="padding:40px 0"><div class="empty-icon">🖼️</div><div class="empty-title">No designs yet</div><div class="empty-text">Share your first design and get feedback!</div><button class="btn btn-primary mt-16" id="dash-first-upload">Upload Your First Design</button></div>`
        : `<div class="designs-grid">${designs.map(d => `
            <div class="design-card" data-id="${d.id}" style="cursor:pointer">
              <div class="design-card-image">
                <img src="${escHtml(d.imageUrl || d.externalUrl || '')}" alt="${escHtml(d.title)}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=600&q=70'">
                <div class="design-card-category">${escHtml(d.category)}</div>
              </div>
              <div class="design-card-body">
                <div class="design-card-title">${escHtml(d.title)}</div>
                <div class="design-card-ratings">
                  ${d.feedbackCount > 0
                    ? `<div class="rating-chip"><span class="star">★</span>${parseFloat(d.avgOverall).toFixed(1)}</div><div class="rating-chip" style="color:var(--text-muted)">${d.feedbackCount} reviews</div>`
                    : `<div class="rating-chip"><span class="no-rating">Awaiting feedback</span></div>`}
                </div>
              </div>
            </div>`).join('')}
          </div>`
      }
    </div>

    <div class="dash-section">
      <div class="dash-section-header">
        <h2 class="dash-section-title">Feedback Received</h2>
      </div>
      ${!feedbackReceived.length
        ? `<div style="text-align:center;padding:32px;color:var(--text-muted)">No feedback received yet</div>`
        : feedbackReceived.map(f => `
          <div class="feedback-card" style="cursor:pointer" data-design-id="${f.design?.id}">
            <div class="feedback-header">
              <div class="feedback-reviewer">
                <div class="reviewer-avatar">${(f.reviewer?.fullName || f.reviewer?.username || 'A').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)}</div>
                <div>
                  <div class="reviewer-name">${escHtml(f.reviewer?.fullName || f.reviewer?.username || 'Anonymous')}</div>
                  <div class="reviewer-level">on: <strong>${escHtml(f.design?.title || '')}</strong></div>
                </div>
              </div>
              <div class="overall-chip">★ ${parseFloat(f.overallRating).toFixed(1)}</div>
            </div>
            <div class="feedback-comment" style="margin-bottom:0">${escHtml(f.comment)}</div>
          </div>`).join('')
      }
    </div>
  </div>`;
}

function bindDashboardEvents(data) {
  id('dash-upload-btn')?.addEventListener('click', openUploadModal);
  id('dash-first-upload')?.addEventListener('click', openUploadModal);
  id('edit-profile-btn')?.addEventListener('click', () => openEditProfileModal(data.user));
  document.querySelectorAll('[data-design-id]').forEach(card => {
    const did = card.dataset.designId || card.dataset.id;
    if (did) card.addEventListener('click', () => navigate('design-detail', { designId: did }));
  });
  document.querySelectorAll('.design-card[data-id]').forEach(card => {
    card.addEventListener('click', () => navigate('design-detail', { designId: card.dataset.id }));
  });
}

// =================== PROFILE PAGE ===================
async function loadProfile(userId) {
  try {
    const user = await API.get(`/users/${userId}`);
    const designs = await API.get(`/designs?userId=${userId}`);
    id('app').innerHTML = renderProfilePage(user, designs.designs || []);
    document.querySelectorAll('.design-card').forEach(card => {
      card.addEventListener('click', () => navigate('design-detail', { designId: card.dataset.id }));
    });
  } catch {
    navigate('explore');
  }
}

function renderProfilePage(user, designs) {
  const initials = (user.fullName || user.username).split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const skills = user.skills ? user.skills.split(',').map(s => s.trim()).filter(Boolean) : [];

  return `
  <div class="page">
    <div style="margin-bottom:20px">
      <button class="btn btn-ghost btn-sm" id="back-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
        Back
      </button>
    </div>
    <div class="profile-hero" style="max-width:600px">
      <div class="profile-avatar">${initials}</div>
      <div class="profile-name">${escHtml(user.fullName || user.username)}</div>
      <div class="profile-username">@${escHtml(user.username)}</div>
      <div class="profile-level">${user.level}</div>
      ${user.bio ? `<div class="profile-bio">${escHtml(user.bio)}</div>` : ''}
      ${skills.length ? `<div class="profile-skills">${skills.map(s => `<span class="skill-tag">${escHtml(s)}</span>`).join('')}</div>` : ''}
      <div class="divider"></div>
      <div style="display:flex;gap:32px;">
        <div><strong>${user.totalDesignsUploaded || 0}</strong> <span style="color:var(--text-muted)">Designs</span></div>
        <div><strong>${user.totalFeedbackGiven || 0}</strong> <span style="color:var(--text-muted)">Feedbacks Given</span></div>
      </div>
    </div>

    <h2 class="section-title" style="margin-bottom:24px">Designs by ${escHtml(user.fullName || user.username)}</h2>
    ${!designs.length
      ? `<div class="empty-state"><div class="empty-icon">🖼️</div><div class="empty-title">No designs uploaded yet</div></div>`
      : `<div class="designs-grid">${designs.map(renderDesignCard).join('')}</div>`
    }
  </div>`;
}

// =================== AI ANALYSIS MODAL ===================
let _aiModalInterval = null;

function showAIAnalysisModal() {
  // Remove any existing one
  const old = id('ai-analysis-modal');
  if (old) old.remove();

  const steps = [
    { icon: '🔍', text: 'Scanning visual composition...' },
    { icon: '🎨', text: 'Analyzing color palette & harmony...' },
    { icon: 'Aa', text: 'Evaluating typography & hierarchy...' },
    { icon: '📐', text: 'Assessing layout & spacing...' },
    { icon: '✨', text: 'Generating expert recommendations...' },
    { icon: '🤖', text: 'Consulting Gemini AI Vision...' },
  ];

  const modal = document.createElement('div');
  modal.id = 'ai-analysis-modal';
  modal.className = 'ai-modal-overlay';
  modal.innerHTML = `
    <div class="ai-modal-box">
      <div class="ai-modal-orb">
        <div class="ai-orb-ring ring1"></div>
        <div class="ai-orb-ring ring2"></div>
        <div class="ai-orb-ring ring3"></div>
        <div class="ai-orb-core">🤖</div>
      </div>
      <h2 class="ai-modal-title">Gemini AI is analyzing your design</h2>
      <p class="ai-modal-subtitle">Our AI Vision model is scanning every pixel and design element...</p>
      <div class="ai-steps-list" id="ai-steps-list">
        ${steps.map((s, i) => `
          <div class="ai-step" id="ai-step-${i}" style="opacity:0;transform:translateX(-12px);transition:all 0.4s ease ${i * 0.15}s">
            <div class="ai-step-icon">${s.icon}</div>
            <div class="ai-step-text">${s.text}</div>
            <div class="ai-step-check" id="ai-check-${i}"></div>
          </div>
        `).join('')}
      </div>
      <div class="ai-progress-bar-wrap">
        <div class="ai-progress-bar" id="ai-progress-bar"></div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => modal.classList.add('visible'));

  // Animate steps appearing and completing
  let stepIndex = 0;
  let doneSteps = 0;
  const totalSteps = steps.length;

  // Show steps progressively
  steps.forEach((_, i) => {
    setTimeout(() => {
      const el = id(`ai-step-${i}`);
      if (el) { el.style.opacity = '1'; el.style.transform = 'none'; }
    }, i * 600 + 300);
  });

  // Mark steps as done progressively
  _aiModalInterval = setInterval(() => {
    if (doneSteps < totalSteps) {
      const checkEl = id(`ai-check-${doneSteps}`);
      const stepEl = id(`ai-step-${doneSteps}`);
      if (checkEl) checkEl.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';
      if (stepEl) stepEl.classList.add('done');
      doneSteps++;
      // Update progress bar
      const pct = Math.round((doneSteps / totalSteps) * 100);
      const bar = id('ai-progress-bar');
      if (bar) bar.style.width = `${pct}%`;
    }
  }, 900);
}

function closeAIAnalysisModal(success = true) {
  if (_aiModalInterval) { clearInterval(_aiModalInterval); _aiModalInterval = null; }
  const modal = id('ai-analysis-modal');
  if (!modal) return;

  if (success) {
    const box = modal.querySelector('.ai-modal-box');
    if (box) {
      box.innerHTML = `
        <div class="ai-success-icon">✅</div>
        <h2 class="ai-modal-title" style="color:var(--accent-green)">Analysis Complete!</h2>
        <p class="ai-modal-subtitle">Gemini has finished reviewing your design. Loading results...</p>
      `;
    }
    setTimeout(() => {
      modal.classList.remove('visible');
      setTimeout(() => modal.remove(), 400);
      document.body.style.overflow = '';
    }, 1200);
  } else {
    modal.classList.remove('visible');
    setTimeout(() => modal.remove(), 400);
    document.body.style.overflow = '';
  }
}

// =================== MODALS ===================
function openModal(modalId) {
  id('modal-overlay').classList.add('open');
  id(modalId).classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(modalId) {
  id('modal-overlay').classList.remove('open');
  id(modalId).classList.remove('open');
  document.body.style.overflow = '';
}
function closeAllModals() {
  ['auth-modal','upload-modal','feedback-modal'].forEach(m => id(m)?.classList.remove('open'));
  id('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

// AUTH MODAL
function openAuthModal(tab = 'login') {
  id('auth-modal-title').textContent = tab === 'login' ? 'Welcome Back' : 'Create Account';
  id('auth-modal-body').innerHTML = renderAuthForm(tab);
  openModal('auth-modal');
  bindAuthFormEvents();
}

function renderAuthForm(tab) {
  return `
  <div class="auth-tabs">
    <div class="auth-tab ${tab === 'login' ? 'active' : ''}" id="tab-login">Sign In</div>
    <div class="auth-tab ${tab === 'register' ? 'active' : ''}" id="tab-register">Register</div>
  </div>

  <div id="login-form" style="display:${tab === 'login' ? 'block' : 'none'}">
    <div class="form-group">
      <label class="form-label">Email</label>
      <input type="email" class="form-input" id="login-email" placeholder="your@email.com">
    </div>
    <div class="form-group">
      <label class="form-label">Password</label>
      <input type="password" class="form-input" id="login-password" placeholder="Enter password">
    </div>
    <div id="login-error" class="form-error" style="display:none"></div>
    <button class="btn btn-primary btn-full" id="login-submit">Sign In</button>
    <p style="text-align:center;margin-top:16px;font-size:0.85rem;color:var(--text-muted)">
      Demo: <strong>sarah@example.com</strong> / password123
    </p>
  </div>

  <div id="register-form" style="display:${tab === 'register' ? 'block' : 'none'}">
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Username</label>
        <input type="text" class="form-input" id="reg-username" placeholder="yourname">
      </div>
      <div class="form-group">
        <label class="form-label">Full Name</label>
        <input type="text" class="form-input" id="reg-fullname" placeholder="Your Name">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Email</label>
      <input type="email" class="form-input" id="reg-email" placeholder="your@email.com">
    </div>
    <div class="form-group">
      <label class="form-label">Password</label>
      <input type="password" class="form-input" id="reg-password" placeholder="Min 6 characters">
    </div>
    <div class="form-group">
      <label class="form-label">Bio</label>
      <textarea class="form-textarea" id="reg-bio" placeholder="Tell us about yourself..." style="min-height:80px"></textarea>
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Skills</label>
        <input type="text" class="form-input" id="reg-skills" placeholder="Figma, Illustrator...">
      </div>
      <div class="form-group">
        <label class="form-label">Level</label>
        <select class="form-select" id="reg-level">
          <option value="Beginner">Beginner</option>
          <option value="Intermediate">Intermediate</option>
          <option value="Advanced">Advanced</option>
          <option value="Expert">Expert</option>
        </select>
      </div>
    </div>
    <div id="reg-error" class="form-error" style="display:none"></div>
    <button class="btn btn-primary btn-full" id="register-submit">Create Account</button>
  </div>`;
}

function bindAuthFormEvents() {
  id('tab-login')?.addEventListener('click', () => {
    id('tab-login').classList.add('active'); id('tab-register').classList.remove('active');
    id('login-form').style.display = 'block'; id('register-form').style.display = 'none';
    id('auth-modal-title').textContent = 'Welcome Back';
  });
  id('tab-register')?.addEventListener('click', () => {
    id('tab-register').classList.add('active'); id('tab-login').classList.remove('active');
    id('register-form').style.display = 'block'; id('login-form').style.display = 'none';
    id('auth-modal-title').textContent = 'Create Account';
  });

  id('login-submit')?.addEventListener('click', async () => {
    const email = id('login-email').value.trim();
    const password = id('login-password').value;
    const errEl = id('login-error');
    errEl.style.display = 'none';
    const btn = id('login-submit');
    btn.disabled = true; btn.textContent = 'Signing in...';
    try {
      const data = await API.post('/auth/login', { email, password });
      saveAuth(data.token, data.user);
      closeAllModals();
      showToast(`Welcome back, ${data.user.fullName || data.user.username}! 👋`, 'success');
      navigate('explore');
    } catch (err) {
      errEl.textContent = err.message; errEl.style.display = 'block';
    } finally { btn.disabled = false; btn.textContent = 'Sign In'; }
  });

  id('register-submit')?.addEventListener('click', async () => {
    const username = id('reg-username').value.trim();
    const email = id('reg-email').value.trim();
    const password = id('reg-password').value;
    const fullName = id('reg-fullname').value.trim();
    const bio = id('reg-bio').value.trim();
    const skills = id('reg-skills').value.trim();
    const level = id('reg-level').value;
    const errEl = id('reg-error');
    errEl.style.display = 'none';
    const btn = id('register-submit');
    btn.disabled = true; btn.textContent = 'Creating account...';
    try {
      const data = await API.post('/auth/register', { username, email, password, fullName, bio, skills, level });
      saveAuth(data.token, data.user);
      closeAllModals();
      showToast(`Account created! Welcome, ${data.user.fullName || data.user.username}! 🎉`, 'success');
      navigate('explore');
    } catch (err) {
      errEl.textContent = err.message; errEl.style.display = 'block';
    } finally { btn.disabled = false; btn.textContent = 'Create Account'; }
  });
}

// UPLOAD MODAL
function openUploadModal() {
  if (!State.user) { openAuthModal('register'); return; }
  id('upload-modal-body').innerHTML = renderUploadForm();
  bindUploadFormEvents();
  openModal('upload-modal');
}

function renderUploadForm() {
  return `
  <form id="upload-form" enctype="multipart/form-data">
    <div class="form-group">
      <label class="form-label">Design Title *</label>
      <input type="text" class="form-input" id="up-title" placeholder="e.g. E-Commerce App Dashboard UI">
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">Category *</label>
        <select class="form-select" id="up-category">
          <option value="UI/UX">UI/UX</option>
          <option value="Logo">Logo</option>
          <option value="Poster">Poster</option>
          <option value="Branding">Branding</option>
          <option value="Web">Web</option>
          <option value="Mobile">Mobile</option>
          <option value="Illustration">Illustration</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Tags</label>
        <input type="text" class="form-input" id="up-tags" placeholder="mobile, dark, minimal">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <textarea class="form-textarea" id="up-desc" placeholder="Describe your design, the problem it solves, and design decisions you made..." style="min-height:100px"></textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Upload Image</label>
      <div class="dropzone" id="dropzone">
        <div class="dropzone-icon">📁</div>
        <div class="dropzone-text">Drop your design here or <span>browse files</span></div>
        <div class="dropzone-hint">PNG, JPG, WebP, SVG — Max 10MB</div>
        <div class="dropzone-preview" id="dropzone-preview"></div>
        <input type="file" id="up-image" accept="image/*" style="display:none">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Or Paste External URL</label>
      <input type="url" class="form-input" id="up-url" placeholder="https://figma.com/... or https://behance.net/...">
      <div class="form-hint">Figma, Behance, or direct image URL</div>
    </div>
    <div id="upload-error" class="form-error" style="display:none"></div>
    <div style="display:flex;gap:12px;margin-top:8px">
      <button type="button" class="btn btn-secondary" onclick="closeAllModals()">Cancel</button>
      <button type="button" class="btn btn-primary" style="flex:1" id="upload-submit">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Publish Design
      </button>
    </div>
  </form>`;
}

function bindUploadFormEvents() {
  const dz = id('dropzone');
  const fileInput = id('up-image');
  const preview = id('dropzone-preview');

  dz?.addEventListener('click', () => fileInput.click());
  dz?.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('dragover'); });
  dz?.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz?.addEventListener('drop', (e) => {
    e.preventDefault(); dz.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) { fileInput.files = e.dataTransfer.files; showPreview(file); }
  });
  fileInput?.addEventListener('change', () => {
    if (fileInput.files[0]) showPreview(fileInput.files[0]);
  });

  function showPreview(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
      dz.querySelector('.dropzone-icon').textContent = '✅';
      dz.querySelector('.dropzone-text').innerHTML = `<span>${file.name}</span>`;
    };
    reader.readAsDataURL(file);
  }

  id('upload-submit')?.addEventListener('click', async () => {
    const title = id('up-title').value.trim();
    const category = id('up-category').value;
    const description = id('up-desc').value.trim();
    const tags = id('up-tags').value.trim();
    const externalUrl = id('up-url').value.trim();
    const file = id('up-image').files[0];
    const errEl = id('upload-error');
    errEl.style.display = 'none';

    if (!title) { errEl.textContent = 'Title is required'; errEl.style.display = 'block'; return; }
    if (!file && !externalUrl) { errEl.textContent = 'Please upload an image or provide a URL'; errEl.style.display = 'block'; return; }

    const btn = id('upload-submit');
    btn.disabled = true; btn.textContent = 'Publishing...';

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('category', category);
      formData.append('description', description);
      formData.append('tags', tags);
      if (externalUrl) formData.append('externalUrl', externalUrl);
      if (file) formData.append('image', file);

      await API.post('/designs', formData, true);
      closeAllModals();
      showToast('🎨 Design published successfully!', 'success');
      State.filters.category = 'All'; State.currentPage = 1;
      navigate('explore');
    } catch (err) {
      errEl.textContent = err.message; errEl.style.display = 'block';
    } finally { btn.disabled = false; btn.textContent = 'Publish Design'; }
  });
}

// FEEDBACK MODAL
function openFeedbackModal(designId, designTitle) {
  if (!State.user) { openAuthModal('login'); return; }
  id('feedback-modal-body').innerHTML = renderFeedbackForm(designId, designTitle);
  bindFeedbackFormEvents(designId);
  openModal('feedback-modal');
}

function renderFeedbackForm(designId, designTitle) {
  const criteria = ['colors', 'typography', 'layout', 'ux'];
  const labels = { colors: '🎨 Colors', typography: 'Aa Typography', layout: '📐 Layout', ux: '⚡ UX' };
  const descriptions = {
    colors: 'Color palette, contrast, and visual harmony',
    typography: 'Font choices, hierarchy, and readability',
    layout: 'Composition, spacing, and grid structure',
    ux: 'Usability, interaction design, and user flow'
  };

  return `
  <div style="margin-bottom:20px;padding:14px;background:var(--bg-secondary);border-radius:var(--radius-md)">
    <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:4px">Reviewing</div>
    <div style="font-weight:700">${escHtml(designTitle)}</div>
  </div>
  ${criteria.map(c => `
    <div class="rating-group">
      <div class="rating-group-title">${labels[c]}</div>
      <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">${descriptions[c]}</div>
      <div class="star-rating" data-criterion="${c}">
        ${[1,2,3,4,5].map(i => `<span class="star" data-val="${i}">★</span>`).join('')}
      </div>
      <input type="hidden" id="r-${c}" value="0">
    </div>
  `).join('')}
  <div class="form-group" style="margin-top:8px">
    <label class="form-label">Detailed Comment *</label>
    <textarea class="form-textarea" id="f-comment" placeholder="Provide specific, constructive feedback. What works well? What can be improved? Please write at least 30 characters." style="min-height:140px"></textarea>
    <div class="form-hint">Minimum 30 characters required for quality feedback</div>
    <div style="text-align:right;font-size:0.75rem;color:var(--text-muted);margin-top:4px" id="char-count">0 / 30 min</div>
  </div>
  <div id="feedback-error" class="form-error" style="display:none"></div>
  <div style="display:flex;gap:12px;margin-top:8px">
    <button class="btn btn-secondary" onclick="closeAllModals()">Cancel</button>
    <button class="btn btn-primary" style="flex:1" id="feedback-submit">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2 15 22 11 13 2 9l20-7z"/></svg>
      Submit Feedback
    </button>
  </div>`;
}

function bindFeedbackFormEvents(designId) {
  // Character counter
  id('f-comment')?.addEventListener('input', () => {
    const len = id('f-comment').value.length;
    const el = id('char-count');
    el.textContent = `${len} / 30 min`;
    el.style.color = len >= 30 ? 'var(--accent-green)' : 'var(--text-muted)';
  });

  // Star ratings
  document.querySelectorAll('.star-rating').forEach(group => {
    const criterion = group.dataset.criterion;
    const stars = group.querySelectorAll('.star');
    const input = id(`r-${criterion}`);

    stars.forEach(star => {
      star.addEventListener('mouseover', () => {
        const val = parseInt(star.dataset.val);
        stars.forEach((s, i) => s.classList.toggle('active', i < val));
      });
      star.addEventListener('click', () => {
        const val = parseInt(star.dataset.val);
        input.value = val;
        stars.forEach((s, i) => s.classList.toggle('active', i < val));
      });
    });
    group.addEventListener('mouseleave', () => {
      const val = parseInt(input.value);
      stars.forEach((s, i) => s.classList.toggle('active', i < val));
    });
  });

  id('feedback-submit')?.addEventListener('click', async () => {
    const colorsRating = parseInt(id('r-colors').value);
    const typographyRating = parseInt(id('r-typography').value);
    const layoutRating = parseInt(id('r-layout').value);
    const uxRating = parseInt(id('r-ux').value);
    const comment = id('f-comment').value.trim();
    const errEl = id('feedback-error');
    errEl.style.display = 'none';

    if (!colorsRating || !typographyRating || !layoutRating || !uxRating) {
      errEl.textContent = 'Please rate all 4 criteria'; errEl.style.display = 'block'; return;
    }
    if (comment.length < 30) {
      errEl.textContent = 'Comment must be at least 30 characters'; errEl.style.display = 'block'; return;
    }

    const btn = id('feedback-submit');
    btn.disabled = true; btn.textContent = 'Submitting...';

    try {
      await API.post('/feedback', { designId: parseInt(designId), colorsRating, typographyRating, layoutRating, uxRating, comment });
      closeAllModals();
      showToast('✅ Feedback submitted! The designer has been notified.', 'success');
      loadDesignDetail(designId);
    } catch (err) {
      errEl.textContent = err.message; errEl.style.display = 'block';
    } finally { btn.disabled = false; btn.textContent = 'Submit Feedback'; }
  });
}

// EDIT PROFILE MODAL
function openEditProfileModal(user) {
  const modal = id('auth-modal');
  id('auth-modal-title').textContent = 'Edit Profile';
  const skills = user.skills || '';
  id('auth-modal-body').innerHTML = `
    <div class="form-group">
      <label class="form-label">Full Name</label>
      <input type="text" class="form-input" id="ep-name" value="${escHtml(user.fullName || '')}">
    </div>
    <div class="form-group">
      <label class="form-label">Bio</label>
      <textarea class="form-textarea" id="ep-bio">${escHtml(user.bio || '')}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Skills (comma separated)</label>
      <input type="text" class="form-input" id="ep-skills" value="${escHtml(skills)}">
    </div>
    <div class="form-group">
      <label class="form-label">Level</label>
      <select class="form-select" id="ep-level">
        ${['Beginner','Intermediate','Advanced','Expert'].map(l => `<option value="${l}" ${user.level === l ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
    </div>
    <div id="ep-error" class="form-error" style="display:none"></div>
    <button class="btn btn-primary btn-full" id="ep-save">Save Changes</button>
  `;
  openModal('auth-modal');

  id('ep-save')?.addEventListener('click', async () => {
    const btn = id('ep-save');
    btn.disabled = true; btn.textContent = 'Saving...';
    try {
      await API.put('/users/profile/update', {
        fullName: id('ep-name').value.trim(),
        bio: id('ep-bio').value.trim(),
        skills: id('ep-skills').value.trim(),
        level: id('ep-level').value
      });
      const updatedUser = await API.get('/auth/me');
      State.user = updatedUser;
      localStorage.setItem('dfh_user', JSON.stringify(updatedUser));
      updateNavForAuth();
      closeAllModals();
      showToast('✅ Profile updated!', 'success');
      navigate('dashboard');
    } catch (err) {
      id('ep-error').textContent = err.message; id('ep-error').style.display = 'block';
    } finally { btn.disabled = false; btn.textContent = 'Save Changes'; }
  });
}

// =================== NOTIFICATION PANEL ===================
function toggleNotifPanel() {
  id('notif-panel').classList.toggle('open');
}
function closeNotifPanel() {
  id('notif-panel').classList.remove('open');
}

// =================== TOAST ===================
function showToast(message, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const container = id('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <span class="toast-message">${escHtml(message)}</span>
    <span class="toast-close">✕</span>
  `;
  container.appendChild(toast);
  toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// =================== UTILS ===================
const id = (i) => document.getElementById(i);
const show = (elId, visible) => { const el = id(elId); if (el) el.style.display = visible ? 'flex' : 'none'; };
const setText = (elId, text) => { const el = id(elId); if (el) el.textContent = text; };
const escHtml = (str) => str == null ? '' : String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');

// =================== MARKDOWN RENDERER (lightweight) ===================
function markdownToHtml(text) {
  if (!text) return '';
  return text
    // Bold **text**
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic *text*
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Heading ## text
    .replace(/^##\s(.+)$/gm, '<h4 style="margin:12px 0 4px;color:var(--text-primary)">$1</h4>')
    // Bullet points starting with 👉 or - or *
    .replace(/^(👉|➡️|•|-)\s(.+)$/gm, '<div class="ai-bullet"><span class="ai-bullet-icon">$1</span><span>$2</span></div>')
    // Newlines to <br>
    .replace(/\n/g, '<br>')
    // Clean up extra <br> before/after block elements
    .replace(/<br>(<h4)/g, '$1')
    .replace(/(<\/h4>)<br>/g, '$1');
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const day = Math.floor(h / 24); if (day < 30) return `${day}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// =================== INIT ===================
function init() {
  loadAuth();
  navigate('home');

  // Navbar scroll effect
  window.addEventListener('scroll', () => {
    id('navbar')?.classList.toggle('scrolled', window.scrollY > 20);
  });

  // Nav links
  id('nav-explore')?.addEventListener('click', (e) => { e.preventDefault(); navigate('explore'); });
  id('nav-logo-btn')?.addEventListener('click', (e) => { e.preventDefault(); navigate('home'); });
  id('nav-upload-btn')?.addEventListener('click', (e) => { e.preventDefault(); openUploadModal(); });
  id('nav-dashboard-btn')?.addEventListener('click', (e) => { e.preventDefault(); navigate('dashboard'); });
  id('login-nav-btn')?.addEventListener('click', () => openAuthModal('login'));
  id('register-nav-btn')?.addEventListener('click', () => openAuthModal('register'));

  // User menu
  id('user-avatar-nav')?.addEventListener('click', () => {
    id('user-dropdown').classList.toggle('open');
    closeNotifPanel();
  });
  id('logout-btn')?.addEventListener('click', (e) => { e.preventDefault(); clearAuth(); showToast('Signed out. See you soon! 👋', 'info'); });
  id('dropdown-profile')?.addEventListener('click', (e) => { e.preventDefault(); id('user-dropdown').classList.remove('open'); if (State.user) navigate('profile', { userId: State.user.id }); });
  id('dropdown-dashboard')?.addEventListener('click', (e) => { e.preventDefault(); id('user-dropdown').classList.remove('open'); navigate('dashboard'); });

  // Notification panel
  id('notification-btn')?.addEventListener('click', () => {
    toggleNotifPanel();
    id('user-dropdown').classList.remove('open');
  });
  id('notif-read-all')?.addEventListener('click', async () => {
    try {
      await API.put('/notifications/read-all');
      State.notifications.forEach(n => n.isRead = true);
      updateNotifBadge();
      renderNotifList();
    } catch {}
  });

  // Modal closes
  id('auth-modal-close')?.addEventListener('click', () => closeModal('auth-modal'));
  id('upload-modal-close')?.addEventListener('click', () => closeModal('upload-modal'));
  id('feedback-modal-close')?.addEventListener('click', () => closeModal('feedback-modal'));
  id('modal-overlay')?.addEventListener('click', closeAllModals);

  // Click outside dropdowns
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-menu')) id('user-dropdown')?.classList.remove('open');
    if (!e.target.closest('.notif-panel') && !e.target.closest('.notification-btn')) closeNotifPanel();
  });

  // Hash routing
  window.addEventListener('hashchange', handleHash);
}

document.addEventListener('DOMContentLoaded', init);
