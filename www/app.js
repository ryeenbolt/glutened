/* glutened. v0.1 — standalone prototype */
(function () {
  "use strict";

  const MAUMELLE = { lat: 34.8689, lng: -92.4024, label: "Maumelle, AR" };

  const FACT_LABELS = {
    gfMenu: "GF menu",
    dedicatedFryer: "Dedicated fryer",
    dedicatedFacility: "Dedicated GF facility",
    separatePrep: "Separate prep area",
    gfBuns: "GF bread / buns",
    gfCrust: "GF pizza crust",
    gfBeer: "GF beer / cider",
    staffProtocol: "Staff allergy protocol"
  };
  const FACT_ORDER = ["gfMenu", "dedicatedFryer", "dedicatedFacility", "separatePrep", "gfBuns", "gfCrust", "gfBeer", "staffProtocol"];

  const $ = (sel) => document.querySelector(sel);
  const content = $("#content");
  const filtersBar = $("#filters");

  let DB = { places: [], chains: [], drinks: null };
  let tab = "local";
  let activeFilters = new Set();
  let searchQuery = "";
  let detailTarget = null; // {kind, id}

  const store = {
    get saved() { try { return JSON.parse(localStorage.getItem("glutened_saved") || "{}"); } catch { return {}; } },
    set saved(v) { localStorage.setItem("glutened_saved", JSON.stringify(v)); },
    get reports() { try { return JSON.parse(localStorage.getItem("glutened_reports") || "{}"); } catch { return {}; } },
    set reports(v) { localStorage.setItem("glutened_reports", JSON.stringify(v)); }
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function haversine(lat1, lon1, lat2, lon2) {
    const R = 3958.8, toRad = (d) => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  function distOf(p) {
    if (p.lat == null || p.lng == null) return null;
    return haversine(MAUMELLE.lat, MAUMELLE.lng, p.lat, p.lng);
  }

  // fact state: true/false -> yes/no; null or "unverified" -> unknown
  function factState(v) {
    if (v === true || v === "yes") return "yes";
    if (v === false || v === "no") return "no";
    return "unk";
  }
  function factWord(st) {
    return st === "yes" ? "Yes" : st === "no" ? "No" : "Not confirmed";
  }

  function placeFacts(p) {
    const f = p.facts || {};
    return FACT_ORDER.map((k) => {
      const st = factState(f[k]);
      return `<li class="${st}"><b>${FACT_LABELS[k]}</b><span class="fact-state">${factWord(st)}</span></li>`;
    }).join("");
  }

  function chainFacts(c) {
    const rows = [
      ["gfMenu", c.gfMenu], ["gfBuns", c.gfBuns], ["gfCrust", c.gfCrust],
      ["dedicatedFryer", c.dedicatedFryer], ["gfBeer", c.gfBeer]
    ];
    return rows.map(([k, v]) => {
      const st = factState(v);
      return `<li class="${st}"><b>${FACT_LABELS[k]}</b><span class="fact-state">${factWord(st)}${st === "unk" ? " by the chain" : ""}</span></li>`;
    }).join("");
  }

  function badgesForPlace(p) {
    const f = p.facts || {};
    const out = [];
    if (factState(f.dedicatedFacility) === "yes") out.push('<span class="badge yes">Dedicated GF facility</span>');
    if (factState(f.dedicatedFryer) === "yes") out.push('<span class="badge yes">Dedicated fryer</span>');
    if (factState(f.gfMenu) === "yes") out.push('<span class="badge sky">GF menu</span>');
    if (factState(f.gfBeer) === "yes") out.push('<span class="badge coral">GF beer / cider</span>');
    return out.join("");
  }

  function matchesFilters(p) {
    if (!activeFilters.size) return true;
    const f = p.facts || {};
    for (const fl of activeFilters) {
      if (factState(f[fl]) !== "yes") return false;
    }
    return true;
  }

  /* ---------------- renderers ---------------- */

  function renderLocal() {
    const sorted = DB.places
      .filter(matchesFilters)
      .map((p) => ({ p, d: distOf(p) }))
      .sort((a, b) => (a.d == null ? 1 : b.d == null ? -1 : a.d - b.d));
    let html = `<h2 class="section-title">Near ${esc(MAUMELLE.label)}</h2>
      <p class="section-sub">${sorted.length} places in the local database, closest first. Unknown facts show as “Not confirmed” — never guessed.</p>
      <div class="cards">`;
    for (const { p, d } of sorted) {
      html += `
      <article class="card" data-kind="place" data-id="${esc(p.id)}" tabindex="0">
        <h3>${esc(p.name)}</h3>
        <div class="meta">${esc(p.address)} &middot; ${esc(p.cuisine || "")}${p.price ? " &middot; " + esc(p.price) : ""}${p.rating ? " &middot; ★ " + esc(p.rating) : ""}</div>
        <div class="badges">${badgesForPlace(p)}</div>
        ${d != null ? `<div class="dist">~${d.toFixed(1)} mi from Maumelle</div>` : ""}
        ${p.gfItems && p.gfItems.length ? `<div class="items"><strong>GF items</strong>${esc(p.gfItems.join(", "))}</div>` : ""}
      </article>`;
    }
    html += `</div>`;
    content.innerHTML = html || `<div class="empty">No places match those filters.</div>`;
    bindCards();
  }

  function renderChains() {
    let list = DB.chains;
    if (activeFilters.size) {
      list = list.filter((c) => {
        for (const fl of activeFilters) {
          const v = fl === "gfBeer" ? c.gfBeer : fl === "gfMenu" ? c.gfMenu : fl === "dedicatedFryer" ? c.dedicatedFryer : null;
          if (v == null || factState(v) !== "yes") return false;
        }
        return true;
      });
    }
    let html = `<h2 class="section-title">Chain Guide</h2>
      <p class="section-sub">${DB.chains.length} chains, from official allergen guides only (Oct 2026). “Not confirmed by the chain” means we couldn't verify it — we didn't guess.</p>
      <div class="cards">`;
    for (const c of list) {
      const st = factState(c.dedicatedFryer);
      html += `
      <article class="card" data-kind="chain" data-id="${esc(c.name)}" tabindex="0">
        <h3>${esc(c.name)}</h3>
        <div class="badges">
          ${factState(c.gfMenu) === "yes" ? '<span class="badge sky">GF menu</span>' : ""}
          ${st === "yes" ? '<span class="badge yes">Dedicated fryer</span>' : st === "no" ? '<span class="badge no">No dedicated fryer</span>' : ""}
          ${c.celiacWarning ? '<span class="badge coral">Celiac warning</span>' : ""}
        </div>
        <div class="note">${esc(c.note || "")}</div>
      </article>`;
    }
    html += `</div>`;
    content.innerHTML = html || `<div class="empty">No chains match those filters.</div>`;
    bindCards();
  }

  function renderDrinks() {
    const d = DB.drinks;
    if (!d) { content.innerHTML = `<div class="empty">Drinks data not loaded.</div>`; return; }
    const item = (x) => `<div class="drink"><strong>${esc(x.name)}</strong>${x.type ? `<div class="dmeta">${esc(x.type)}</div>` : ""}${x.availability ? `<div class="dmeta">${esc(x.availability)}</div>` : ""}<p>${esc(x.note || "")}</p></div>`;
    content.innerHTML = `
      <h2 class="section-title">GF Drinks</h2>
      <p class="section-sub">The split that matters: truly gluten-free beer is brewed from GF grains. “Gluten-removed” beer starts as barley and is enzyme-treated — not considered celiac-safe.</p>
      <div class="drinkcat"><h3>Truly gluten-free beer</h3><div class="drink-grid">${d.trulyGF.map(item).join("")}</div></div>
      <div class="drinkcat"><h3>Gluten-removed — not celiac-safe</h3>
        <div class="warnbox"><strong>Important</strong>Celiac Canada and several brands themselves say these are not safe for people with celiac disease.</div>
        <div class="drink-grid">${d.glutenRemoved.map(item).join("")}</div></div>
      <div class="drinkcat"><h3>Ciders (naturally gluten-free)</h3><div class="drink-grid">${d.ciders.map(item).join("")}</div></div>
      <div class="drinkcat"><h3>Discontinued — do not expect to find</h3><div class="drink-grid">${d.discontinued.map(item).join("")}</div></div>`;
  }

  function renderSaved() {
    const saved = store.saved;
    const ids = Object.keys(saved);
    if (!ids.length) { content.innerHTML = `<div class="empty">Nothing saved yet.<br>Tap any place or chain and hit <strong>Save</strong>.</div>`; return; }
    let html = `<h2 class="section-title">Saved</h2><p class="section-sub">${ids.length} saved.</p><div class="cards">`;
    for (const id of ids) {
      const s = saved[id];
      html += `
      <article class="card" data-kind="${esc(s.kind)}" data-id="${esc(s.id)}" tabindex="0">
        <h3>${esc(s.name)}</h3>
        <div class="meta">${esc(s.sub || "")}</div>
      </article>`;
    }
    html += `</div>`;
    content.innerHTML = html;
    bindCards();
  }

  function renderAbout() {
    content.innerHTML = `
    <div class="about">
      <h2 class="section-title">About glutened.</h2>
      <p><strong>glutened.</strong> is a gluten-free food &amp; drink finder built on safety <em>facts</em> — dedicated fryers, real GF menus, GF beer and cider — instead of vague "gluten-friendly" labels.</p>
      <h3>Where the data comes from</h3>
      <ul>
        <li><strong>Chain Guide:</strong> 32 national chains, each fact checked against the chain's own official allergen guide (Oct 2026). Unknown items show as "Not confirmed by the chain" — never guessed.</li>
        <li><strong>Local listings:</strong> community listings plus reported diner notes. "Not confirmed" means nobody has verified it yet.</li>
        <li><strong>Safety reports:</strong> structured reports from diners, saved on this device. Reports from reviewers who have celiac disease are badged first.</li>
      </ul>
      <h3>How this prototype searches</h3>
      <p>v0.1 searches the built-in database and applies the Chain Guide to any US city you type. Live nationwide place listings arrive in a later version via a Google Places key — that's the piece that turns this prototype into a launch.</p>
      <h3>The promise</h3>
      <ul>
        <li>No ads. Ever.</li>
        <li>No place can pay for a safety rating.</li>
        <li>Evidence shown; the diner decides.</li>
      </ul>
    </div>`;
  }

  function renderNationwide(q) {
    content.innerHTML = `
      <h2 class="section-title">Results for “${esc(q)}”</h2>
      <p class="section-sub">v0.1 nationwide mode: the Chain Guide applies anywhere in the US. Live local listings for this city plug in via Google Places in a later version.</p>
      <div class="warnbox"><strong>Prototype mode</strong>Chain data below is verified and nationwide. Local spots in ${esc(q)} aren't loaded yet — search again or file reports as you visit.</div>
      <div class="cards">
      ${DB.chains.map((c) => `
        <article class="card" data-kind="chain" data-id="${esc(c.name)}" tabindex="0">
          <h3>${esc(c.name)}</h3>
          <div class="meta">Nationwide chain &middot; info for ${esc(q)}</div>
          <div class="badges">
            ${factState(c.gfMenu) === "yes" ? '<span class="badge sky">GF menu</span>' : ""}
            ${factState(c.dedicatedFryer) === "yes" ? '<span class="badge yes">Dedicated fryer</span>' : ""}
          </div>
        </article>`).join("")}
      </div>`;
    bindCards();
  }

  /* ---------------- detail ---------------- */

  function findPlace(id) { return DB.places.find((p) => p.id === id); }
  function findChain(name) { return DB.chains.find((c) => c.name === name); }

  function renderDetail(kind, id) {
    let html = `<button class="backlink" id="backBtn">← Back</button>`;
    if (kind === "place") {
      const p = findPlace(id);
      if (!p) return;
      const saved = store.saved[p.id];
      const reports = (store.reports[p.id] || []);
      html += `
      <div class="detail">
        <h2>${esc(p.name)}</h2>
        <div class="meta">${esc(p.address)}${p.phone ? " &middot; " + esc(p.phone) : ""}${p.hours ? " &middot; " + esc(p.hours) : ""}${p.rating ? " &middot; ★ " + esc(p.rating) : ""}</div>
        ${p.note ? `<p class="note">${esc(p.note)}</p>` : ""}
        ${p.gfItems && p.gfItems.length ? `<div class="items"><strong>GF items</strong>${esc(p.gfItems.join(", "))}</div>` : ""}
        <h3 style="margin-top:14px;font-size:18px">Safety facts</h3>
        <ul class="facts">${placeFacts(p)}</ul>
        <button class="savebtn" id="saveBtn">${saved ? "★ Saved — tap to remove" : "Save this place"}</button>
        <div class="reportbox">
          <h4>File a safety report</h4>
          <label>Do you have celiac disease?
            <select id="rCeliac"><option value="unknown">Prefer not to say</option><option value="yes">Yes</option><option value="no">No</option></select>
          </label>
          <label>Did you have a reaction?
            <select id="rReact"><option value="unknown">Unknown / prefer not to say</option><option value="yes">Yes</option><option value="no">No</option></select>
          </label>
          <label>Note<textarea id="rNote" rows="3" placeholder="What did you see? Fryer? Prep? Staff knowledge?"></textarea></label>
          <button class="savebtn" id="rSave">Save report</button>
        </div>
        <div class="reportlist" id="reportList">${reportsHtml(reports)}</div>
      </div>`;
      content.innerHTML = html;
      $("#backBtn").onclick = goBack;
      $("#saveBtn").onclick = () => {
        const s = store.saved;
        if (s[p.id]) delete s[p.id];
        else s[p.id] = { kind: "place", id: p.id, name: p.name, sub: p.address };
        store.saved = s;
        renderDetail(kind, id);
      };
      $("#rSave").onclick = () => {
        const r = store.reports;
        (r[p.id] = r[p.id] || []).unshift({
          celiac: $("#rCeliac").value,
          reaction: $("#rReact").value,
          note: $("#rNote").value.trim(),
          when: new Date().toISOString().slice(0, 10)
        });
        store.reports = r;
        renderDetail(kind, id);
      };
    } else {
      const c = findChain(id);
      if (!c) return;
      const saved = store.saved["chain:" + c.name];
      html += `
      <div class="detail">
        <h2>${esc(c.name)}</h2>
        <div class="meta">Nationwide chain &middot; per official allergen guides (Oct 2026)</div>
        ${c.note ? `<p class="note">${esc(c.note)}</p>` : ""}
        ${c.celiacWarning ? `<div class="warnbox"><strong>Celiac warning (official)</strong>${esc(c.celiacWarning)}</div>` : ""}
        <h3 style="margin-top:14px;font-size:18px">Safety facts</h3>
        <ul class="facts">${chainFacts(c)}</ul>
        ${c.alwaysGF ? `<div class="items"><strong>GF options (official)</strong>${esc(c.alwaysGF)}</div>` : ""}
        ${c.crossContact ? `<p class="note"><strong>On cross-contact:</strong> ${esc(c.crossContact)}</p>` : ""}
        ${c.source ? `<p class="note"><a href="${esc(c.source)}" target="_blank" rel="noopener">Official source</a></p>` : `<p class="note">Official source not retrievable — unverified.</p>`}
        <button class="savebtn" id="saveBtn">${saved ? "★ Saved — tap to remove" : "Save this chain"}</button>
      </div>`;
      content.innerHTML = html;
      $("#backBtn").onclick = goBack;
      $("#saveBtn").onclick = () => {
        const s = store.saved;
        if (s["chain:" + c.name]) delete s["chain:" + c.name];
        else s["chain:" + c.name] = { kind: "chain", id: c.name, name: c.name, sub: "Nationwide chain" };
        store.saved = s;
        renderDetail(kind, id);
      };
    }
  }

  function reportsHtml(reports) {
    if (!reports.length) return "";
    return reports.map((r) => `
      <div class="report">
        <div class="who">Diner report — ${esc(r.when)}${r.celiac === "yes" ? '<span class="celiac-badge">HAS CELIAC</span>' : ""}</div>
        <div>Reaction: ${esc(r.reaction)} &middot; Celiac: ${esc(r.celiac)}</div>
        ${r.note ? `<div>${esc(r.note)}</div>` : ""}
      </div>`).join("");
  }

  function bindCards() {
    content.querySelectorAll(".card").forEach((el) => {
      const go = () => { detailTarget = { kind: el.dataset.kind, id: el.dataset.id }; renderDetail(el.dataset.kind, el.dataset.id); window.scrollTo(0, 0); };
      el.addEventListener("click", go);
      el.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    });
  }

  function goBack() { detailTarget = null; render(); window.scrollTo(0, 0); }

  /* ---------------- tabs / filters / search ---------------- */

  function render() {
    if (detailTarget) { renderDetail(detailTarget.kind, detailTarget.id); return; }
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
    filtersBar.hidden = !(tab === "local" || tab === "chains");
    if (searchQuery) return renderNationwide(searchQuery);
    if (tab === "local") renderLocal();
    else if (tab === "chains") renderChains();
    else if (tab === "drinks") renderDrinks();
    else if (tab === "saved") renderSaved();
    else renderAbout();
  }

  document.querySelectorAll(".tab").forEach((t) => {
    t.addEventListener("click", () => { tab = t.dataset.tab; detailTarget = null; searchQuery = ""; $("#citySearch").value = ""; render(); });
  });

  document.querySelectorAll(".chip[data-filter]").forEach((ch) => {
    ch.addEventListener("click", () => {
      const f = ch.dataset.filter;
      if (activeFilters.has(f)) { activeFilters.delete(f); ch.classList.remove("active"); }
      else { activeFilters.add(f); ch.classList.add("active"); }
      render();
    });
  });
  $("#clearFilters").addEventListener("click", () => {
    activeFilters.clear();
    document.querySelectorAll(".chip[data-filter]").forEach((c) => c.classList.remove("active"));
    render();
  });

  function doSearch() {
    const q = $("#citySearch").value.trim();
    searchQuery = "";
    detailTarget = null;
    if (!q) {
      tab = "local";
      $("#locationLabel").textContent = MAUMELLE.label;
      render();
      return;
    }
    const local = /maumelle|little\s*rock|north little rock|sherwood|cabot|benton|conway/i.test(q);
    if (local) {
      tab = "local";
      $("#locationLabel").textContent = MAUMELLE.label;
    } else {
      $("#locationLabel").textContent = q;
      searchQuery = q;
    }
    render();
    window.scrollTo(0, 0);
  }
  $("#searchBtn").addEventListener("click", doSearch);
  $("#citySearch").addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });

  /* ---------------- boot ---------------- */
  Promise.all([
    fetch("data/places.json").then((r) => r.json()),
    fetch("data/chains.json").then((r) => r.json()),
    fetch("data/drinks.json").then((r) => r.json())
  ]).then(([places, chains, drinks]) => {
    DB = { places, chains, drinks };
    render();
  }).catch(() => {
    content.innerHTML = `<div class="empty">Couldn't load the data files.<br>Open this page over HTTP (or inside the app) — file:// blocks data loading.</div>`;
  });
})();
