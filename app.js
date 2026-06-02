// ============================================
// TRIUMPH NIL — SUPABASE-CONNECTED APP
// ============================================

const SUPABASE_URL = 'https://lokizzpfuylrfeblrphh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_w1ulFSnvGJETlXhnGtL4cw_rJDnUAQp';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CUR = 'Jun';
const f = n => (!n || n === 0) ? '-' : '$' + Math.round(Math.abs(n)).toLocaleString();

let A = [];        // athletes from DB
let revShare = {}; // {athleteId: {Jan:0, ...}}
let activeSport = 'Football';

// ============================================
// BOOT — Load all data from Supabase
// ============================================
async function boot() {
  setLoad('Connecting to database...', 20);

  try {
    setLoad('Loading athletes...', 40);
    const { data: athletes, error: aErr } = await sb
      .from('athletes')
      .select('*')
      .eq('active', true)
      .order('rank_priority', { ascending: true, nullsFirst: false });

    if (aErr) throw aErr;

    setLoad('Loading payment schedules...', 60);
    const { data: schedules } = await sb
      .from('payment_schedule')
      .select('*')
      .eq('year', 2026);

    setLoad('Loading rev share...', 80);
    const { data: revShareData } = await sb
      .from('rev_share')
      .select('*')
      .eq('year', 2026);

    // Assemble A[] array
    A = athletes.map(a => {
      const sch = MO.map(mo => {
        const s = schedules?.find(x => x.athlete_id === a.id && x.month === mo);
        return {
          mo,
          a: s?.amount || 0,
          p: s?.is_paid || false,
          s: s?.sources || [],
          id: s?.id
        };
      });
      return {
        id: a.id,
        f: a.first_name,
        l: a.last_name,
        pos: a.position,
        sport: a.sport,
        rank: a.rank_priority,
        contract: a.contract,
        banked: a.banked,
        paid: a.paid_out,
        sch,
        deals: []
      };
    });

    // Assemble revShare{}
    if (revShareData) {
      revShareData.forEach(r => {
        const a = A.find(x => x.id === r.athlete_id);
        if (!a) return;
        const k = a.f + '_' + a.l;
        if (!revShare[k]) revShare[k] = {};
        revShare[k][r.month] = r.amount;
      });
    }

    setLoad('Ready!', 100);
    setTimeout(() => {
      document.getElementById('loading-screen').style.display = 'none';
      document.getElementById('app').style.display = 'flex';
      nav('dash', document.getElementById('nav-dash'));
    }, 400);

  } catch (err) {
    console.error('Boot error:', err);
    document.getElementById('load-fill').style.background = '#e34040';
    document.querySelector('.load-sub').textContent = 'Connection error: ' + err.message;
  }
}

function setLoad(msg, pct) {
  document.querySelector('.load-sub').textContent = msg;
  document.getElementById('load-fill').style.width = pct + '%';
}

// ============================================
// SYNC STATUS
// ============================================
function setSyncStatus(msg, ok = true) {
  const el = document.getElementById('sync-status');
  el.innerHTML = `<span style="width:7px;height:7px;border-radius:50%;background:${ok ? '#1d9e75' : '#e34040'};display:inline-block"></span> ${msg}`;
  if (ok) setTimeout(() => { el.innerHTML = ''; }, 3000);
}

// ============================================
// NAV
// ============================================
function nav(page, el) {
  document.querySelectorAll('.sbi').forEach(b => b.classList.remove('on'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('on'));
  if (el) el.classList.add('on');
  document.getElementById('page-' + page).classList.add('on');
  const titles = { dash: 'Dashboard', athletes: 'Athletes', gm: 'General Manager', companies: 'Companies', reports: 'Reports', settings: 'Settings' };
  document.getElementById('top-title').textContent = titles[page] || page;
  if (page === 'dash') buildDash();
  if (page === 'athletes') { aF(); document.getElementById('top-sub').textContent = getList().length + ' active athletes'; }
  if (page === 'companies') buildCompanies();
  if (page === 'settings') buildSettings();
}

// ============================================
// HELPERS
// ============================================
function getList() {
  const sMap = { Football: 'Football', MBB: 'Basketball-M', WBB: 'Basketball-W' };
  return A.filter(a => (a.sport || 'Football') === (sMap[activeSport] || activeSport) ||
    (activeSport === 'Football' && (!a.sport || a.sport === 'Football')));
}

function getMo() { return document.getElementById('sel-mo')?.value || CUR; }
function getRev(a, mo) { const k = a.f + '_' + a.l; return (revShare[k] && revShare[k][mo]) || 0; }
function getRevYTD(a) { return MO.reduce((s, m) => s + getRev(a, m), 0); }
function gma(a, mo) { const s = a.sch.find(x => x.mo === mo); return s ? s.a : 0; }
function isNF(a, mo) { const s = a.sch.find(x => x.mo === mo); return s && s.a > 0 && (a.banked - a.paid) < s.a; }

// ============================================
// ATHLETES FILTER + RENDER
// ============================================
function onSportChange() {
  const sel = document.getElementById('sel-sport');
  activeSport = sel.value;
  document.getElementById('sel-pos').style.display = activeSport === 'Football' ? '' : 'none';
  aF();
}

function aF() {
  const q = (document.getElementById('si')?.value || '').toLowerCase();
  const pos = document.getElementById('sel-pos')?.value || '';
  let list = getList();
  if (pos) list = list.filter(a => a.pos === pos);
  if (q) list = list.filter(a => (a.f + ' ' + a.l).toLowerCase().includes(q));
  document.getElementById('a-cnt').innerHTML = '<b>' + list.length + '</b> athlete' + (list.length !== 1 ? 's' : '');
  rAnnual(list);
}

function rAnnual(list) {
  const moNIL = MO.map(m => list.reduce((s, a) => { const sc = a.sch.find(x => x.mo === m); return s + (sc ? sc.a : 0); }, 0));
  const moRS = MO.map(m => list.reduce((s, a) => s + getRev(a, m), 0));
  const totalNIL = moNIL.reduce((s, v) => s + v, 0);
  const totalRS = moRS.reduce((s, v) => s + v, 0);
  const totalBanked = list.reduce((s, a) => s + (a.banked - a.paid), 0);
  const totalNILRem = list.reduce((s, a) => s + (a.contract - a.paid), 0);

  let html = '<thead><tr>'
    + '<th style="text-align:left;min-width:155px;position:sticky;left:0;z-index:3;background:#f9f9f9">Athlete</th>'
    + '<th style="text-align:right;min-width:90px;background:#e8f8f2;color:#1d9e75">Banked</th>'
    + '<th style="text-align:right;min-width:90px;background:#eef6ff;color:#2980b9">NIL Remaining</th>'
    + '<th style="text-align:right;min-width:90px;background:#fff0f3;color:#c0392b">RS Total</th>'
    + MO.map((m, i) => '<th class="' + (m === CUR ? 'cur' : '') + '" style="min-width:82px"><div>' + m + '</div>'
      + (moNIL[i] > 0 ? '<div style="font-size:8px;color:#1d9e75;font-weight:500;margin-top:1px">' + f(moNIL[i]) + '</div>' : '')
      + '</th>').join('')
    + '<th style="text-align:right;min-width:90px">NIL Total</th>'
    + '</tr></thead><tbody>';

  list.forEach(a => {
    const nilTot = a.sch.reduce((s, x) => s + x.a, 0);
    const rvTot = getRevYTD(a);
    const banked = a.banked - a.paid;
    const nilRem = a.contract - a.paid;

    html += '<tr class="athlete-nil-row" onclick="oProf(\'' + a.id + '\')" style="cursor:pointer">'
      + '<td style="position:sticky;left:0;z-index:1;border-right:1px solid #f2f2f7;background:#eef6ff">'
        + '<div style="font-weight:600;font-size:12.5px">' + a.f + ' ' + a.l + '</div>'
        + '<div style="display:flex;gap:4px;margin-top:2px">'
        + '<span style="font-size:9px;background:#f2f2f7;padding:1px 5px;border-radius:4px;color:#8e8e93">' + a.pos + '</span>'
        + (rvTot > 0 ? '<span style="font-size:9px;background:#fff0f3;padding:1px 5px;border-radius:4px;color:#c0392b">RS</span>' : '')
        + '</div></td>'
      + '<td style="text-align:right;background:#e8f8f2;font-weight:600;color:#1d9e75">' + f(banked) + '</td>'
      + '<td style="text-align:right;background:#eef6ff;font-weight:600;color:#2980b9">' + f(nilRem) + '</td>'
      + '<td style="text-align:right;background:#fff0f3;font-weight:600;color:' + (rvTot > 0 ? '#c0392b' : '#d1d1d6') + '">' + (rvTot > 0 ? f(rvTot) : '—') + '</td>'
      + MO.map(m => {
        const s = a.sch.find(x => x.mo === m), iC = m === CUR;
        if (!s || s.a === 0) return '<td class="' + (iC ? 'curbg' : '') + '"><span style="color:#e5e5ea">-</span></td>';
        return '<td class="' + (iC ? 'curbg' : '') + '">'
          + '<div style="font-size:11.5px;font-weight:500">' + f(s.a) + '</div>'
          + (s.p ? '<div class="mc-paid-badge">✓ Paid</div>' : '')
          + '</td>';
      }).join('')
      + '<td style="text-align:right;font-weight:600">' + f(nilTot) + '</td></tr>';

    if (rvTot > 0) {
      html += '<tr style="background:#fff0f3">'
        + '<td style="padding:3px 10px 6px 22px;font-size:9px;color:#c0392b;font-weight:600;text-transform:uppercase;letter-spacing:.05em;position:sticky;left:0;background:#fff0f3;border-right:1px solid #f5c6d0">↳ Rev Share</td>'
        + '<td colspan="3" style="background:#fff0f3"></td>'
        + MO.map(m => { const rv = getRev(a, m), iC = m === CUR;
          return '<td class="' + (iC ? 'curbg' : '') + '" style="text-align:center;background:#fff0f3">'
            + (rv > 0 ? '<span style="font-size:11px;font-weight:600;color:#c0392b">' + f(rv) + '</span>' : '<span style="color:#e5e5ea;font-size:10px">—</span>')
            + '</td>';
        }).join('')
        + '<td style="text-align:right;font-size:11px;font-weight:600;color:#c0392b;background:#fff0f3">' + f(rvTot) + '</td></tr>';
    }
  });

  // Totals
  html += '<tr style="background:#f2f2f7;border-top:2px solid #1d1d1f">'
    + '<td style="font-weight:700;font-size:12px;padding:10px;position:sticky;left:0;background:#f2f2f7;border-right:1px solid #e5e5ea">Totals</td>'
    + '<td style="text-align:right;font-weight:700;color:#1d9e75">' + f(totalBanked) + '</td>'
    + '<td style="text-align:right;font-weight:700;color:#2980b9">' + f(totalNILRem) + '</td>'
    + '<td style="text-align:right;font-weight:700;color:#c0392b">' + (totalRS > 0 ? f(totalRS) : '—') + '</td>'
    + MO.map((m, i) => '<td style="text-align:center;font-weight:700;font-size:12px;color:' + (moNIL[i] > 0 ? '#1d1d1f' : '#d1d1d6') + '">' + (moNIL[i] > 0 ? f(moNIL[i]) : '—') + '</td>').join('')
    + '<td style="text-align:right;font-weight:700;font-size:13px">' + f(totalNIL) + '</td></tr>';

  html += '</tbody>';
  document.getElementById('atbl').innerHTML = html;
}

// ============================================
// ATHLETE PROFILE (simplified for now)
// ============================================
function oProf(id) {
  const a = A.find(x => x.id === id);
  if (!a) return;
  alert(a.f + ' ' + a.l + '\nContract: ' + f(a.contract) + '\nBanked: ' + f(a.banked) + '\nPaid: ' + f(a.paid) + '\n\nFull profile view — coming in next update!');
}

// ============================================
// DASHBOARD
// ============================================
function buildDash() {
  const totalContract = A.reduce((s, a) => s + a.contract, 0);
  const totalBanked = A.reduce((s, a) => s + a.banked, 0);
  const totalPaid = A.reduce((s, a) => s + a.paid, 0);
  const totalRS = A.reduce((s, a) => s + getRevYTD(a), 0);
  const shortCount = A.filter(a => isNF(a, CUR)).length;

  document.getElementById('dash-body').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;padding:20px 24px">
      <div class="kpi-card"><div class="kpi-lbl">Total Contracts</div><div class="kpi-val">${f(totalContract)}</div><div class="kpi-sub">${A.length} athletes</div></div>
      <div class="kpi-card"><div class="kpi-lbl">Total Banked (NILGo)</div><div class="kpi-val" style="color:#1d9e75">${f(totalBanked)}</div><div class="kpi-sub">Cleared funds</div></div>
      <div class="kpi-card"><div class="kpi-lbl">Total Paid Out</div><div class="kpi-val" style="color:#2980b9">${f(totalPaid)}</div><div class="kpi-sub">All time</div></div>
      <div class="kpi-card"><div class="kpi-lbl">Rev Share YTD</div><div class="kpi-val" style="color:#c0392b">${f(totalRS)}</div><div class="kpi-sub">${shortCount} athletes short in ${CUR}</div></div>
    </div>
    <div style="padding:0 24px 20px">
      <div style="font-size:13px;font-weight:600;margin-bottom:12px">Quick Roster Summary — ${CUR}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
        ${A.slice(0, 6).map(a => {
          const sc = a.sch.find(x => x.mo === CUR);
          const amt = sc ? sc.a : 0;
          const banked = a.banked - a.paid;
          return `<div style="background:#fff;border:1.5px solid #e5e5ea;border-radius:10px;padding:12px 14px">
            <div style="font-weight:600;font-size:12.5px">${a.f} ${a.l}</div>
            <div style="font-size:9px;background:#f2f2f7;padding:1px 5px;border-radius:4px;color:#8e8e93;display:inline-block;margin-top:2px">${a.pos}</div>
            <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:11px">
              <span style="color:#8e8e93">${CUR} NIL</span><span style="font-weight:600">${amt > 0 ? f(amt) : '—'}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11px;margin-top:4px">
              <span style="color:#8e8e93">Banked</span><span style="font-weight:600;color:${banked < (amt || 0) ? '#e34040' : '#1d9e75'}">${f(banked)}</span>
            </div>
          </div>`;
        }).join('')}
      </div>
      ${A.length > 6 ? `<div style="margin-top:12px;text-align:center;font-size:12px;color:#8e8e93">+ ${A.length - 6} more athletes — <button onclick="nav('athletes',document.getElementById('nav-athletes'))" style="background:none;border:none;color:#2980b9;cursor:pointer;font-size:12px;font-weight:600">View all</button></div>` : ''}
    </div>
  `;
}

// ============================================
// ADD ATHLETE MODAL
// ============================================
function openAddAthlete() {
  // Build month grid
  document.getElementById('mo-grid').innerHTML = MO.map(m => `
    <div class="mo-card${m === CUR ? ' cur' : ''}">
      <div class="mo-lbl">${m}</div>
      <div style="font-size:8px;color:#2980b9;font-weight:600;margin-bottom:2px">NIL</div>
      <input class="mo-inp nil-inp" id="mn-${m}" type="number" min="0" placeholder="0">
      <label style="display:flex;align-items:center;gap:4px;font-size:9px;color:#8e8e93;margin-top:3px;cursor:pointer">
        <input type="checkbox" id="mp-${m}"> Paid
      </label>
      <div style="font-size:8px;color:#c0392b;font-weight:600;margin-top:6px;margin-bottom:2px">RS</div>
      <input class="mo-inp rs-inp" id="mr-${m}" type="number" min="0" placeholder="0">
    </div>
  `).join('');

  ['a-fn','a-ln','a-contract','a-banked'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('a-paid').value = '0';
  document.getElementById('a-pos').value = '';
  document.getElementById('a-sport').value = 'Football';
  document.getElementById('add-err').style.display = 'none';
  const ov = document.getElementById('add-overlay');
  ov.style.display = 'flex';
}

function closeAdd() {
  document.getElementById('add-overlay').style.display = 'none';
}

async function saveAthlete() {
  const btn = document.getElementById('save-btn');
  const errEl = document.getElementById('add-err');
  errEl.style.display = 'none';

  const fn = (document.getElementById('a-fn').value || '').trim();
  const ln = (document.getElementById('a-ln').value || '').trim();
  const pos = document.getElementById('a-pos').value;
  const sport = document.getElementById('a-sport').value;
  const rank = parseInt(document.getElementById('a-rank').value) || null;
  const contract = parseFloat(document.getElementById('a-contract').value) || 0;
  const banked = parseFloat(document.getElementById('a-banked').value) || 0;
  const paid = parseFloat(document.getElementById('a-paid').value) || 0;

  const errs = [];
  if (!fn) errs.push('First name required');
  if (!ln) errs.push('Last name required');
  if (!pos) errs.push('Position required');
  if (!contract) errs.push('Contract value required');

  if (errs.length) {
    errEl.textContent = errs.join(' · ');
    errEl.style.display = 'block';
    return;
  }

  btn.textContent = 'Saving...';
  btn.disabled = true;

  try {
    // Insert athlete
    const { data: newA, error: aErr } = await sb.from('athletes').insert({
      first_name: fn, last_name: ln, position: pos, sport,
      rank_priority: rank, contract, banked, paid_out: paid, active: true
    }).select().single();

    if (aErr) throw aErr;

    // Insert payment schedule
    const schedRows = MO.map(m => ({
      athlete_id: newA.id, month: m, year: 2026,
      amount: parseFloat(document.getElementById('mn-' + m)?.value) || 0,
      is_paid: document.getElementById('mp-' + m)?.checked || false,
      sources: []
    })).filter(r => r.amount > 0 || r.is_paid);

    if (schedRows.length) {
      const { error: sErr } = await sb.from('payment_schedule').insert(schedRows);
      if (sErr) throw sErr;
    }

    // Insert rev share
    const rsRows = MO.map(m => ({
      athlete_id: newA.id, month: m, year: 2026,
      amount: parseFloat(document.getElementById('mr-' + m)?.value) || 0
    })).filter(r => r.amount > 0);

    if (rsRows.length) {
      const { error: rErr } = await sb.from('rev_share').insert(rsRows);
      if (rErr) throw rErr;
    }

    closeAdd();
    setSyncStatus('Athlete saved ✓');

    // Reload data
    await boot();

  } catch (err) {
    errEl.textContent = 'Save failed: ' + err.message;
    errEl.style.display = 'block';
    btn.textContent = 'Add to Roster';
    btn.disabled = false;
  }
}

// ============================================
// COMPANIES (basic)
// ============================================
function buildCompanies() {
  document.getElementById('co-body').innerHTML = '<div style="padding:24px;color:#8e8e93;text-align:center">Companies — coming in next update</div>';
}

// ============================================
// SETTINGS
// ============================================
function buildSettings() {
  document.getElementById('settings-body').innerHTML = `
    <div style="max-width:500px;margin:24px auto">
      <div style="background:#fff;border:1.5px solid #e5e5ea;border-radius:14px;padding:20px 24px;margin-bottom:16px">
        <div style="font-size:13px;font-weight:700;margin-bottom:4px">Database Connection</div>
        <div style="font-size:11px;color:#8e8e93;margin-bottom:12px">Connected to Supabase triumph-nil project</div>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:8px;height:8px;border-radius:50%;background:#1d9e75"></div>
          <span style="font-size:12px;font-weight:500">Live — ${A.length} athletes loaded</span>
        </div>
      </div>
      <div style="background:#fff;border:1.5px solid #e5e5ea;border-radius:14px;padding:20px 24px">
        <div style="font-size:13px;font-weight:700;margin-bottom:4px">Current Month</div>
        <div style="font-size:11px;color:#8e8e93;margin-bottom:12px">The active month used for "current" highlights and calculations</div>
        <div style="font-size:14px;font-weight:700;color:#b7791f">${CUR} 2026</div>
      </div>
    </div>
  `;
}

// ============================================
// EXPORT (placeholder)
// ============================================
function exportExcel() {
  alert('Export — coming in next update!');
}

// ============================================
// START
// ============================================
boot();
