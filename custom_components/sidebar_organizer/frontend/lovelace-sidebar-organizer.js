/**
 * lovelace-sidebar-organizer — Frontend Module
 * ──────────────────────────────────────────────────────────────────────────
 * Config stockée CÔTÉ SERVEUR via WebSocket HA (sidebar_organizer/*)
 * Protection admin enforced côté Python (websocket_api.py)
 *
 * Rôles :
 *   Administrateur  →  is_admin:true dans HA
 *   Utilisateur     →  compte HA standard
 *   Visiteur        →  défini dans visitor_users[] de la config
 *
 * Version: 1.0.0
 */

(function () {
  'use strict';

  const VERSION    = '1.0.7';
  const CACHE_KEY  = 'lso_cache';      // localStorage cache (lecture seule pour non-admins)
  const EXP_KEY    = 'lso_exp_';       // clé expand/collapse par groupe

  const WS_GET     = 'sidebar_organizer/get_config';
  const WS_SAVE    = 'sidebar_organizer/save_config';

  const ROLE = { ADMIN: 'admin', USER: 'user', VISITOR: 'visitor' };

  const DEFAULT_CONFIG = {
    version       : 1,
    groups        : [],
    visitor_users : [],
    hidden_items  : [],
  };

  /* ═══════════════════════════════════════════════════════════════════════
     CSS SIDEBAR
  ═══════════════════════════════════════════════════════════════════════ */

  const SIDEBAR_CSS = `
    .lso-group { display:flex; flex-direction:column; }
    .lso-header {
      display:flex; align-items:center; height:48px;
      padding:0 12px 0 0; margin:1px 8px; cursor:pointer;
      user-select:none; border-radius:4px; transition:background .15s;
      color:var(--sidebar-text-color, var(--primary-text-color)); opacity:.78;
    }
    .lso-header:hover { background:rgba(0,0,0,.08); opacity:1; }
    .lso-icon-wrap {
      flex-shrink:0; width:56px;
      display:flex; align-items:center; justify-content:center;
    }
    .lso-name {
      flex:1; font-size:14px; font-weight:500;
      overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
    }
    .lso-chevron { flex-shrink:0; transition:transform .25s ease; opacity:.6; --mdc-icon-size:18px; }
    .lso-header.lso-closed .lso-chevron { transform:rotate(-90deg); }
    .lso-items {
      overflow:hidden; max-height:800px; opacity:1;
      transition:max-height .3s ease, opacity .25s ease;
    }
    .lso-items.lso-closed { max-height:0; opacity:0; }
    .lso-saving {
      position:fixed; bottom:16px; right:16px; z-index:9999;
      background:var(--primary-color,#3b82f6); color:#fff;
      padding:8px 16px; border-radius:20px; font-size:13px;
      box-shadow:0 4px 12px rgba(0,0,0,.3);
      animation:lso-fadein .2s ease;
    }
    @keyframes lso-fadein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  `;

  /* ═══════════════════════════════════════════════════════════════════════
     CSS PANEL
  ═══════════════════════════════════════════════════════════════════════ */

  const PANEL_CSS = `
    *, *::before, *::after { box-sizing:border-box; }
    :host {
      display:block; min-height:100%;
      background:var(--primary-background-color,#111827);
      font-family:var(--paper-font-body1_-_font-family,Roboto,sans-serif);
      color:var(--primary-text-color,#f1f5f9);
    }
    .lso-panel { max-width:780px; margin:0 auto; padding:24px 16px 48px; }
    .lso-topbar { display:flex; align-items:center; gap:12px; margin-bottom:28px; }
    .lso-topbar h1 { margin:0; font-size:22px; font-weight:600; flex:1; }
    .lso-ver { font-size:11px; opacity:.35; font-weight:400; }
    .lso-server-badge {
      display:inline-flex; align-items:center; gap:5px;
      background:rgba(74,222,128,.15); color:#4ade80;
      border:1px solid rgba(74,222,128,.3);
      padding:3px 10px; border-radius:12px; font-size:11px; font-weight:600;
    }
    .lso-section {
      font-size:11px; font-weight:700; letter-spacing:.7px;
      text-transform:uppercase; opacity:.4; margin:24px 0 8px;
    }
    /* Buttons */
    .btn {
      display:inline-flex; align-items:center; gap:6px;
      padding:8px 18px; border-radius:20px; border:none;
      cursor:pointer; font-size:13px; font-weight:500;
      transition:filter .15s; white-space:nowrap;
    }
    .btn:hover { filter:brightness(1.12); }
    .btn-primary { background:var(--primary-color,#3b82f6); color:#fff; }
    .btn-danger  { background:#ef4444; color:#fff; }
    .btn-ghost   { background:rgba(255,255,255,.09); color:inherit; }
    .btn-sm      { padding:5px 13px; font-size:12px; }
    .btn-row     { display:flex; gap:8px; flex-wrap:wrap; }
    /* Cards */
    .lso-card {
      background:var(--card-background-color,rgba(255,255,255,.06));
      border:1px solid var(--divider-color,rgba(255,255,255,.1));
      border-radius:14px; padding:16px 18px; margin-bottom:14px;
    }
    .lso-card-head { display:flex; align-items:center; gap:8px; margin-bottom:12px; }
    /* Inputs */
    .lso-input {
      background:transparent; border:none;
      border-bottom:1px solid var(--divider-color,rgba(255,255,255,.2));
      color:inherit; font-size:14px; padding:3px 0; outline:none;
      transition:border-color .2s;
    }
    .lso-input:focus { border-color:var(--primary-color,#3b82f6); }
    .lso-input-name { flex:1; font-weight:500; }
    .lso-input-icon { width:155px; font-size:13px; }
    .lso-select {
      background:rgba(255,255,255,.08); color:inherit;
      border:1px solid var(--divider-color,rgba(255,255,255,.15));
      border-radius:6px; padding:5px 8px; font-size:13px; outline:none;
    }
    .lso-select-users { height:90px; }
    /* Pool */
    .lso-pool {
      display:flex; flex-wrap:wrap; gap:6px; padding:10px; border-radius:10px;
      background:rgba(255,255,255,.04); min-height:42px;
    }
    /* Chips */
    .lso-chip {
      display:inline-flex; align-items:center; gap:4px;
      padding:4px 12px; border-radius:16px; font-size:12px;
      cursor:pointer; user-select:none; transition:filter .15s, opacity .15s;
    }
    .lso-chip:hover { filter:brightness(1.15); }
    .lso-chip-free   { background:rgba(255,255,255,.13); }
    .lso-chip-in     { background:var(--primary-color,#3b82f6); color:#fff; }
    .lso-chip-locked { background:rgba(255,180,0,.15); color:rgba(255,200,60,.85); cursor:default; font-style:italic; }
    /* Items box */
    .lso-items-box {
      display:flex; flex-wrap:wrap; gap:6px; padding:8px; border-radius:8px;
      border:1px dashed var(--divider-color,rgba(255,255,255,.18)); min-height:40px;
    }
    .lso-placeholder { font-size:12px; opacity:.32; align-self:center; }
    /* Access row */
    .lso-access-row { display:flex; align-items:flex-start; gap:10px; margin-top:12px; flex-wrap:wrap; }
    .lso-access-lbl { font-size:13px; font-weight:500; opacity:.65; padding-top:5px; }
    /* Role badges */
    .lso-badge {
      display:inline-flex; align-items:center; gap:4px;
      padding:3px 10px; border-radius:12px; font-size:11px; font-weight:600;
    }
    .role-admin   { background:rgba(239,68,68,.2);  color:#fca5a5; }
    .role-user    { background:rgba(59,130,246,.2); color:#93c5fd; }
    .role-visitor { background:rgba(163,163,163,.2); color:#d4d4d4; }
    /* Visitor rows */
    .lso-vrow {
      display:flex; align-items:center; gap:8px; padding:8px 0;
      border-bottom:1px solid rgba(255,255,255,.06);
    }
    .lso-vname { flex:1; font-size:13px; }
    /* Misc */
    .lso-info { font-size:12px; opacity:.45; margin:4px 0 0; line-height:1.5; }
    .lso-empty { text-align:center; opacity:.32; padding:28px 0; font-size:14px; }
    .lso-tabs  { display:flex; gap:8px; margin-bottom:4px; }
    .about-table { width:100%; border-collapse:collapse; font-size:13px; }
    .about-table th { text-align:left; padding:6px 10px; opacity:.45; font-weight:600; }
    .about-table td { padding:6px 10px; border-top:1px solid rgba(255,255,255,.06); }
    .about-table td:not(:first-child) { text-align:center; }
    .chk { color:#4ade80; } .crs { color:#f87171; }
    pre.lso-code {
      background:rgba(0,0,0,.3); padding:12px; border-radius:8px;
      font-size:12px; overflow-x:auto; line-height:1.6; color:#94a3b8;
    }
    .lso-error {
      background:rgba(239,68,68,.15); border:1px solid rgba(239,68,68,.3);
      color:#fca5a5; padding:10px 14px; border-radius:8px;
      font-size:13px; margin-bottom:12px;
    }
  `;

  /* ═══════════════════════════════════════════════════════════════════════
     MANAGER
  ═══════════════════════════════════════════════════════════════════════ */

  class SidebarOrganizerManager {

    constructor () {
      this.config      = _clone(DEFAULT_CONFIG);
      this.hass        = null;
      this.currentUser = null;
      this._userRole   = ROLE.USER;
      this._serverOk   = false;   // true = custom component détecté
      this._boot();
    }

    /* ── Boot ────────────────────────────────────────────────────────── */

    async _boot () {
      await _poll(() => !!this._ha()?.hass?.user);
      this.hass        = this._ha().hass;
      this.currentUser = this._ha().hass.user;

      // Load config from server (avec fallback localStorage)
      this.config    = await this._loadConfig();
      this._userRole = this._detectRole();

      await _poll(() => this._navItems().length > 0);
      this._injectCSS();
      this.applyGroups();
      this._watch();
    }

    /* ── Config load (server avec retry → localStorage fallback) ────── */

    async _loadConfig () {
      // Retry jusqu'à 5x avec 2s d'intervalle — l'intégration Python
      // peut charger après le frontend au démarrage de HA.
      for (let attempt = 0; attempt < 5; attempt++) {
        if (attempt > 0) await _sleep(2000);
        try {
          const cfg = await this.hass.callWS({ type: WS_GET });
          this._serverOk = true;
          try { localStorage.setItem(CACHE_KEY, JSON.stringify(cfg)); } catch (_) {}
          if (attempt > 0) console.info('[LSO] Serveur connecté après', attempt, 'tentative(s)');
          return Object.assign({}, DEFAULT_CONFIG, cfg);
        } catch (err) {
          console.warn(`[LSO] Tentative ${attempt + 1}/5 échouée:`, err?.message || err);
        }
      }
      // Toutes les tentatives ont échoué → fallback localStorage
      this._serverOk = false;
      console.warn('[LSO] Composant serveur non disponible — fallback localStorage');
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        return raw ? Object.assign({}, DEFAULT_CONFIG, JSON.parse(raw)) : _clone(DEFAULT_CONFIG);
      } catch { return _clone(DEFAULT_CONFIG); }
    }

    /* ── Config save (server → localStorage fallback) ────────────────── */

    async saveConfig (cfg) {
      this.config = cfg;

      // Mise à jour du cache immédiate
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(cfg)); } catch (_) {}

      if (this._serverOk) {
        try {
          await this.hass.callWS({ type: WS_SAVE, config: cfg });
          this._showToast('✓ Configuration sauvegardée sur le serveur');
        } catch (e) {
          console.error('[LSO] Erreur sauvegarde serveur:', e);
          this._showToast('⚠ Sauvegardé localement uniquement', '#f59e0b');
        }
      } else {
        this._showToast('⚠ Sauvegardé localement (composant serveur non installé)', '#f59e0b');
      }

      this.refresh();
    }

    _showToast (msg, color = '') {
      const el = document.createElement('div');
      el.className = 'lso-saving';
      if (color) el.style.background = color;
      el.textContent = msg;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 2500);
    }

    /* ── DOM helpers ─────────────────────────────────────────────────── */

    _ha   () { return document.querySelector('home-assistant'); }
    _main () { return this._ha()?.shadowRoot?.querySelector('home-assistant-main'); }

    _sidebar () {
      const main = this._main();
      if (!main?.shadowRoot) return null;
      const drawer = main.shadowRoot.querySelector('ha-drawer');
      return drawer ? drawer.querySelector('ha-sidebar')
                    : main.shadowRoot.querySelector('ha-sidebar');
    }
    _sidebarRoot () { return this._sidebar()?.shadowRoot; }
    _navItems    () {
      const root = this._sidebarRoot();
      return root ? Array.from(root.querySelectorAll('[data-panel]')) : [];
    }

    /* ── Role ────────────────────────────────────────────────────────── */

    _detectRole () {
      if (!this.currentUser) return ROLE.USER;
      if (this.currentUser.is_admin) return ROLE.ADMIN;
      const visitors = this.config.visitor_users || [];
      if (visitors.includes(this.currentUser.name) ||
          visitors.includes(this.currentUser.id)) return ROLE.VISITOR;
      return ROLE.USER;
    }

    _canSee (group) {
      const access = group.access || 'all';
      const role   = this._userRole;
      switch (access) {
        case 'all'    : return true;
        case 'user'   : return role === ROLE.ADMIN || role === ROLE.USER;
        case 'admin'  : return role === ROLE.ADMIN;
        case 'visitor': return role === ROLE.VISITOR;
        case 'custom' : {
          const list = group.access_users || [];
          return list.includes(this.currentUser?.name) ||
                 list.includes(this.currentUser?.id);
        }
        default: return true;
      }
    }

    /* ── CSS injection ───────────────────────────────────────────────── */

    _injectCSS () {
      const root = this._sidebarRoot();
      if (!root || root.querySelector('#lso-css')) return;
      const s = document.createElement('style');
      s.id = 'lso-css'; s.textContent = SIDEBAR_CSS;
      root.appendChild(s);
    }

    /* ── Apply groups ────────────────────────────────────────────────── */

    applyGroups () {
      const root = this._sidebarRoot();
      if (!root) return;
      this._injectCSS();

      const items        = this._navItems();
      const visible      = (this.config.groups || []).filter(g => this._canSee(g));
      const allGrouped   = new Set((this.config.groups || []).flatMap(g => g.items));
      const hidden       = new Set(this.config.hidden_items || []);

      items.forEach(el => {
        const p = el.getAttribute('data-panel');
        el.style.display = (allGrouped.has(p) || hidden.has(p)) ? 'none' : '';
      });

      visible.forEach(g => this._insertGroup(g, items));
    }

    _insertGroup (group, items) {
      const groupEls = (group.items || [])
        .map(p => items.find(el => el.getAttribute('data-panel') === p))
        .filter(Boolean);
      if (!groupEls.length) return;

      const key      = EXP_KEY + (group.id || group.name);
      const expanded = localStorage.getItem(key) !== 'false';

      const wrap = document.createElement('div');
      wrap.className = 'lso-group';

      const header = document.createElement('div');
      header.className = 'lso-header' + (expanded ? '' : ' lso-closed');
      header.innerHTML = `
        <div class="lso-icon-wrap">
          <ha-icon icon="${group.icon || 'mdi:folder'}" style="--mdc-icon-size:20px"></ha-icon>
        </div>
        <span class="lso-name">${_esc(group.name)}</span>
        <ha-icon class="lso-chevron" icon="mdi:chevron-down"></ha-icon>
      `;

      const container = document.createElement('div');
      container.className = 'lso-items' + (expanded ? '' : ' lso-closed');
      groupEls.forEach(el => {
        const clone = el.cloneNode(true);
        clone.style.display = '';
        container.appendChild(clone);
      });

      header.addEventListener('click', () => {
        const closed = header.classList.toggle('lso-closed');
        container.classList.toggle('lso-closed', closed);
        localStorage.setItem(key, String(!closed));
      });

      wrap.appendChild(header);
      wrap.appendChild(container);
      groupEls[0].parentNode.insertBefore(wrap, groupEls[0]);
    }

    /* ── Refresh ─────────────────────────────────────────────────────── */

    refresh () {
      this._userRole = this._detectRole();
      const root = this._sidebarRoot();
      if (!root) return;
      root.querySelectorAll('.lso-group').forEach(el => el.remove());
      this._navItems().forEach(el => { el.style.display = ''; });
      this.applyGroups();
    }

    /* ── Watch ───────────────────────────────────────────────────────── */

    _watch () {
      window.addEventListener('location-changed', () => {
        setTimeout(() => {
          if (!this._sidebarRoot()?.querySelector('.lso-group')) this.refresh();
        }, 200);
      });
      const ha = this._ha();
      if (ha) new MutationObserver(() => {
        if (!this._sidebarRoot()?.querySelector('#lso-css')) this.refresh();
      }).observe(ha, { childList: true, subtree: true });
    }

    /* ── Panel helpers ───────────────────────────────────────────────── */

    getAllPanels (hassObj) {
      const h = hassObj || this.hass;
      const hapanels = h?.panels;

      if (hapanels && Object.keys(hapanels).length > 0) {
        // Enrichir avec les titres du DOM si disponibles
        const domTitles = {};
        this._navItems().forEach(el => {
          const p = el.getAttribute('data-panel');
          if (!p) return;
          const txt = el.querySelector(
            '.item-text, .title, .item-name, span:not(.notification-badge)'
          )?.textContent?.trim();
          if (txt) domTitles[p] = txt;
        });

        return Object.values(hapanels)
          .filter(p => p.url_path && p.url_path !== 'sidebar-organizer')
          .map(p => {
            // Localisation HA : hass.localize('panel.history') → 'Historique'
            const _l = k => { const t = h.localize?.(k); return (t && t !== k) ? t : null; };
            const isDefault = p.url_path === h.defaultPanel;
            return {
              panel : p.url_path,
              title : domTitles[p.url_path]                          // titre DOM (déjà localisé)
                     || _l(isDefault ? 'panel.states' : `panel.${p.url_path}`)
                     || _l(`panel.${p.component_name}`)              // fallback component_name
                     || p.title                                       // titre brut du panel
                     || p.url_path,                                   // dernier recours
            };
          })
          .sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      }

      // Fallback DOM
      return this._navItems()
        .map(el => ({
          panel : el.getAttribute('data-panel'),
          title : el.querySelector('.item-text, .title, .item-name, span:not(.notification-badge)')
                      ?.textContent?.trim() || el.getAttribute('data-panel'),
        }))
        .filter(p => p.panel);
    }

    async getHAUsers () {
      if (!this.hass) return [];
      try {
        return (await this.hass.callWS({ type: 'config/auth/list' }))
          .map(u => ({ id: u.id, name: u.name, is_admin: u.is_admin }));
      } catch { return []; }
    }

    isServerMode () { return this._serverOk; }
    getUserRole  () { return this._userRole; }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     PANEL
  ═══════════════════════════════════════════════════════════════════════ */

  class LovelaceSidebarOrganizerPanel extends HTMLElement {

    constructor () {
      super();
      this.attachShadow({ mode: 'open' });
      this._hass   = null;
      this._cfg    = null;
      this._panels = [];
      this._users  = [];
      this._tab    = 'groups';
    }

    set hass (h) {
      this._hass = h;
      if (!this._cfg) {
        this._init();
      } else if (this._panels && this._panels.length === 0) {
        // Retry si les panneaux n'étaient pas encore disponibles au premier init
        this._panels = window._lsoManager?.getAllPanels(h) || [];
        if (this._panels.length > 0 && this._tab === 'groups') this._render();
      }
    }
    set narrow (v) {}
    set route  (v) {}
    set panel  (v) {}

    async _init () {
      const mgr    = window._lsoManager;
      this._cfg    = _clone(mgr.config);
      this._panels = mgr.getAllPanels(this._hass);   // passe hass pour hass.panels
      this._users  = await mgr.getHAUsers();
      this._render();
    }

    /* ── Render ──────────────────────────────────────────────────────── */

    _render () {
      this.shadowRoot.innerHTML = `<style>${PANEL_CSS}</style>` + this._html();
      this._bind();
    }

    _html () {
      const serverOk = window._lsoManager?.isServerMode();
      return `
        <div class="lso-panel">
          <div class="lso-topbar">
            <ha-icon icon="mdi:layers-edit" style="--mdc-icon-size:26px;opacity:.7"></ha-icon>
            <h1>Sidebar Organizer <span class="lso-ver">v${VERSION}</span></h1>
            <span class="lso-server-badge" title="Config stockée sur le serveur HA">
              ${serverOk ? '🟢 Serveur' : '🟡 Local'}
            </span>
          </div>
          ${!serverOk ? `<div class="lso-error">
            ⚠ Le composant serveur n'est pas détecté. La configuration est sauvegardée
            localement uniquement (par navigateur). Installez le custom_component pour
            une config partagée et sécurisée.
          </div>` : ''}
          <div class="lso-tabs">
            <button class="btn ${this._tab==='groups'   ? 'btn-primary' : 'btn-ghost'}" data-tab="groups">Groupes</button>
            <button class="btn ${this._tab==='visitors' ? 'btn-primary' : 'btn-ghost'}" data-tab="visitors">Visiteurs</button>
            <button class="btn ${this._tab==='about'    ? 'btn-primary' : 'btn-ghost'}" data-tab="about">À propos</button>
          </div>
          ${this._tab === 'groups'   ? this._htmlGroups()   : ''}
          ${this._tab === 'visitors' ? this._htmlVisitors() : ''}
          ${this._tab === 'about'    ? this._htmlAbout()    : ''}
        </div>
      `;
    }

    /* ── Tab Groupes ─────────────────────────────────────────────────── */

    _htmlGroups () {
      const groups     = this._cfg.groups || [];
      const allGrouped = new Set(groups.flatMap(g => g.items));
      const free       = this._panels.filter(p => !allGrouped.has(p.panel));
      return `
        <div class="lso-section">Éléments disponibles (non groupés)</div>
        <div class="lso-pool">
          ${free.length
            ? free.map(p => `<span class="lso-chip lso-chip-free" data-panel="${p.panel}">${_esc(p.title)}</span>`).join('')
            : '<span class="lso-placeholder">Tous les éléments sont dans des groupes</span>'}
        </div>
        <p class="lso-info">Cliquez ＋ pour ajouter à un groupe · ✕ pour retirer (l'élément réapparaît dans le menu)</p>
        <div class="lso-section">Groupes</div>
        <div id="lso-glist">
          ${groups.length
            ? groups.map((g, i) => this._htmlGroupCard(g, i)).join('')
            : '<div class="lso-empty">Aucun groupe.<br>Cliquez sur <b>＋ Nouveau groupe</b>.</div>'}
        </div>
        <div class="btn-row" style="margin-top:16px">
          <button class="btn btn-primary" id="lso-add">＋ Nouveau groupe</button>
          <button class="btn btn-ghost"   id="lso-export">↑ Exporter JSON</button>
          <button class="btn btn-ghost"   id="lso-import">↓ Importer JSON</button>
        </div>
      `;
    }

    _htmlGroupCard (group, i) {
      const groups     = this._cfg.groups || [];
      const otherItems = new Set(groups.flatMap((g, j) => j !== i ? g.items : []));
      const inGroup    = new Set(group.items || []);
      const access     = group.access || 'all';

      const chips = this._panels.map(p => {
        if (inGroup.has(p.panel))    return `<span class="lso-chip lso-chip-in"     data-panel="${p.panel}" data-remove="${i}">✕ ${_esc(p.title)}</span>`;
        if (otherItems.has(p.panel)) return `<span class="lso-chip lso-chip-locked" title="Dans un autre groupe">${_esc(p.title)}</span>`;
        return `<span class="lso-chip lso-chip-free" data-panel="${p.panel}" data-add="${i}">＋ ${_esc(p.title)}</span>`;
      }).join('');

      const usersOpts = this._users.map(u =>
        `<option value="${_esc(u.name)}" ${(group.access_users||[]).includes(u.name)?'selected':''}>
          ${_esc(u.name)}${u.is_admin?' ★':''}
        </option>`
      ).join('');

      return `
        <div class="lso-card" data-gi="${i}">
          <div class="lso-card-head">
            <ha-icon icon="${_esc(group.icon||'mdi:folder')}" style="--mdc-icon-size:20px;opacity:.65"></ha-icon>
            <input class="lso-input lso-input-name" type="text" placeholder="Nom du groupe"
              value="${_esc(group.name||'')}" data-gi="${i}" data-field="name">
            <input class="lso-input lso-input-icon" type="text" placeholder="mdi:folder"
              value="${_esc(group.icon||'')}" data-gi="${i}" data-field="icon">
            <button class="btn btn-danger btn-sm lso-del" data-gi="${i}">Supprimer</button>
          </div>
          <div class="lso-info" style="margin-bottom:6px">Éléments du groupe</div>
          <div class="lso-items-box">
            ${chips || '<span class="lso-placeholder">Aucun élément</span>'}
          </div>
          <div class="lso-access-row">
            <span class="lso-access-lbl">Visible par :</span>
            <select class="lso-select lso-access-sel" data-gi="${i}">
              <option value="all"     ${access==='all'     ?'selected':''}>Tous  (Admin + Utilisateur + Visiteur)</option>
              <option value="user"    ${access==='user'    ?'selected':''}>Admin + Utilisateur  (pas Visiteur)</option>
              <option value="admin"   ${access==='admin'   ?'selected':''}>Administrateurs uniquement</option>
              <option value="visitor" ${access==='visitor' ?'selected':''}>Visiteurs uniquement</option>
              <option value="custom"  ${access==='custom'  ?'selected':''}>Utilisateurs personnalisés…</option>
            </select>
            <div data-cw="${i}" style="${access==='custom'?'':'display:none'}">
              <select class="lso-select lso-select-users" multiple data-gi="${i}">${usersOpts}</select>
              <div class="lso-info">Ctrl+clic pour sélection multiple</div>
            </div>
          </div>
        </div>
      `;
    }

    /* ── Tab Visiteurs ───────────────────────────────────────────────── */

    _htmlVisitors () {
      const visitors = this._cfg.visitor_users || [];
      return `
        <div class="lso-card" style="margin-top:8px">
          <p style="font-size:13px;line-height:1.7;opacity:.65;margin-bottom:14px">
            HA propose deux rôles natifs : <b>Admin</b> et <b>Utilisateur</b>.<br>
            Ce plugin ajoute le rôle <b>Visiteur</b> — accès restreint aux groupes configurés pour eux.
          </p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">
            <span class="lso-badge role-admin">★ Administrateur — is_admin:true</span>
            <span class="lso-badge role-user">● Utilisateur — compte standard</span>
            <span class="lso-badge role-visitor">◌ Visiteur — défini ici</span>
          </div>
          <div class="lso-section" style="margin-top:0">Utilisateurs HA</div>
          ${this._users.length === 0
            ? '<p class="lso-info">Aucun utilisateur chargé.</p>'
            : this._users.map(u => {
                const isV = visitors.includes(u.name)||visitors.includes(u.id);
                const badge = u.is_admin
                  ? `<span class="lso-badge role-admin">Admin</span>`
                  : isV
                    ? `<span class="lso-badge role-visitor">Visiteur</span>`
                    : `<span class="lso-badge role-user">Utilisateur</span>`;
                return `
                  <div class="lso-vrow">
                    <span class="lso-vname">${_esc(u.name)}</span>
                    ${badge}
                    ${!u.is_admin ? `
                      <button class="btn btn-ghost btn-sm lso-toggle-v"
                        data-uname="${_esc(u.name)}" data-cur="${isV?'visitor':'user'}">
                        ${isV ? '→ Utilisateur' : '→ Visiteur'}
                      </button>` : ''}
                  </div>`;
              }).join('')
          }
        </div>
      `;
    }

    /* ── Tab À propos ────────────────────────────────────────────────── */

    _htmlAbout () {
      return `
        <div class="lso-card" style="margin-top:8px">
          <h3 style="font-size:16px;margin-bottom:10px">Lovelace Sidebar Organizer</h3>
          <p style="font-size:13px;line-height:1.7;opacity:.65">
            Version : <b>${VERSION}</b> · HACS Custom Component + Frontend<br>
            Config stockée dans <code>.storage/sidebar_organizer</code> côté serveur HA.<br>
            Protection admin enforced côté Python — aucun utilisateur non-admin ne peut modifier la config via l'API.
          </p>
          <div class="lso-section">Matrice des accès</div>
          <table class="about-table">
            <tr><th>Accès du groupe</th><th>Admin</th><th>Utilisateur</th><th>Visiteur</th></tr>
            ${[
              ['Tous',                       '✓','✓','✓'],
              ['Admin + Utilisateur',        '✓','✓','✗'],
              ['Administrateurs uniquement', '✓','✗','✗'],
              ['Visiteurs uniquement',       '✗','✗','✓'],
              ['Personnalisé',               '?','?','?'],
            ].map(([l,...c])=>`<tr><td>${l}</td>${c.map(v=>`<td><span class="${v==='✓'?'chk':v==='✗'?'crs':''}">${v}</span></td>`).join('')}</tr>`).join('')}
          </table>
          <div class="lso-section">WebSocket API</div>
          <pre class="lso-code">sidebar_organizer/get_config   → tous les utilisateurs authentifiés
sidebar_organizer/save_config  → admins uniquement (enforced Python)</pre>
          <div class="lso-section">Stockage</div>
          <pre class="lso-code">/config/.storage/sidebar_organizer   ← fichier JSON serveur
localStorage["lso_cache"]            ← cache lecture seule (fallback)</pre>
        </div>
      `;
    }

    /* ── Events ──────────────────────────────────────────────────────── */

    _bind () {
      const R = this.shadowRoot;
      const q  = s => R.querySelector(s);
      const qa = s => R.querySelectorAll(s);

      /* Tabs */
      qa('[data-tab]').forEach(b => b.addEventListener('click', e => {
        this._tab = e.currentTarget.dataset.tab; this._render();
      }));

      if (this._tab === 'groups') {
        q('#lso-add')?.addEventListener('click', () => {
          (this._cfg.groups = this._cfg.groups||[]).push({
            id:'grp_'+Date.now(), name:'Nouveau groupe',
            icon:'mdi:folder', items:[], access:'all'
          });
          this._save(); this._render();
        });

        q('#lso-export')?.addEventListener('click', () => {
          const blob = new Blob([JSON.stringify(this._cfg,null,2)],{type:'application/json'});
          Object.assign(document.createElement('a'),{
            href:URL.createObjectURL(blob),download:'sidebar-organizer-config.json'
          }).click();
        });

        q('#lso-import')?.addEventListener('click', () => {
          const inp = Object.assign(document.createElement('input'),{type:'file',accept:'.json'});
          inp.onchange = e => {
            const f=e.target.files[0]; if(!f) return;
            const r=new FileReader();
            r.onload = ev => {
              try { this._cfg=JSON.parse(ev.target.result); this._save(); this._render(); }
              catch { alert('JSON invalide'); }
            };
            r.readAsText(f);
          };
          inp.click();
        });

        qa('.lso-del').forEach(b => b.addEventListener('click', e => {
          this._cfg.groups.splice(+e.currentTarget.dataset.gi,1);
          this._save(); this._render();
        }));

        qa('.lso-input[data-field]').forEach(inp => inp.addEventListener('input', e => {
          const i=+e.target.dataset.gi, f=e.target.dataset.field;
          this._cfg.groups[i][f]=e.target.value; this._save();
          if(f==='icon'){
            R.querySelector(`.lso-card[data-gi="${i}"] ha-icon`)?.setAttribute('icon',e.target.value||'mdi:folder');
          }
        }));

        qa('[data-add]').forEach(c => c.addEventListener('click', e => {
          const i=+e.currentTarget.dataset.add, p=e.currentTarget.dataset.panel;
          if(!this._cfg.groups[i].items.includes(p)){
            this._cfg.groups[i].items.push(p); this._save(); this._render();
          }
        }));

        qa('[data-remove]').forEach(c => c.addEventListener('click', e => {
          const i=+e.currentTarget.dataset.remove, p=e.currentTarget.dataset.panel;
          this._cfg.groups[i].items=this._cfg.groups[i].items.filter(x=>x!==p);
          this._save(); this._render();
        }));

        qa('.lso-access-sel').forEach(s => s.addEventListener('change', e => {
          const i=+e.target.dataset.gi, t=e.target.value;
          this._cfg.groups[i].access=t;
          if(t!=='custom') delete this._cfg.groups[i].access_users;
          const w=R.querySelector(`[data-cw="${i}"]`);
          if(w) w.style.display=t==='custom'?'':'none';
          this._save();
        }));

        qa('.lso-select-users').forEach(s => s.addEventListener('change', e => {
          const i=+e.target.dataset.gi;
          this._cfg.groups[i].access_users=Array.from(e.target.selectedOptions).map(o=>o.value);
          this._save();
        }));
      }

      if (this._tab === 'visitors') {
        qa('.lso-toggle-v').forEach(b => b.addEventListener('click', e => {
          const name=e.currentTarget.dataset.uname, cur=e.currentTarget.dataset.cur;
          const v=this._cfg.visitor_users=this._cfg.visitor_users||[];
          if(cur==='visitor') this._cfg.visitor_users=v.filter(x=>x!==name);
          else if(!v.includes(name)) v.push(name);
          this._save(); this._render();
        }));
      }
    }

    _save () { window._lsoManager.saveConfig(this._cfg); }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     UTILS & BOOTSTRAP
  ═══════════════════════════════════════════════════════════════════════ */

  function _sleep (ms) { return new Promise(r => setTimeout(r, ms)); }
  function _clone (o) { return JSON.parse(JSON.stringify(o)); }
  function _esc   (s) {
    return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
                        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function _poll (fn, ms=10000) {
    return new Promise(r => {
      const t=Date.now(), id=setInterval(()=>{
        if(fn()){clearInterval(id);r(true);}
        else if(Date.now()-t>ms){clearInterval(id);r(false);}
      },250);
    });
  }

  customElements.define('lovelace-sidebar-organizer', LovelaceSidebarOrganizerPanel);

  window._lsoManager = new SidebarOrganizerManager();

  window.SidebarOrganizerAPI = {
    version     : VERSION,
    getConfig   : ()    => window._lsoManager.config,
    saveConfig  : (cfg) => window._lsoManager.saveConfig(cfg),
    refresh     : ()    => window._lsoManager.refresh(),
    getUserRole : ()    => window._lsoManager.getUserRole(),
    isServerMode: ()    => window._lsoManager.isServerMode(),
  };

  console.info(
    '%c LOVELACE-SIDEBAR-ORGANIZER %c v'+VERSION+' ',
    'background:#3b82f6;color:#fff;padding:2px 5px;border-radius:3px 0 0 3px;font-weight:700',
    'background:#1d4ed8;color:#fff;padding:2px 5px;border-radius:0 3px 3px 0'
  );

})();
