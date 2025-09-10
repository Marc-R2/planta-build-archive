// Enhanced Search functionality with fuzzy matching & highlighting
let searchData = [];
let searchInput;
let searchResults;
let searchLoaded = false;

// Load once DOM ready
document.addEventListener('DOMContentLoaded', function() {
    searchInput = document.getElementById('search-input');
    searchResults = document.getElementById('search-results');
    if (searchInput && searchResults) {
        loadSearchData().then(() => initializeSearch());
    }
});

function rootRelative(path) {
    // Figures out correct relative path for nested pages (plants/, environments/)
    const depth = (window.location.pathname.match(/\//g) || []).length - 1; // very rough
    // If path contains /plants/ or /environments/ assume depth 2 from root path ending with .html
    const nested = /\/(plants|environments)\//.test(window.location.pathname);
    if (nested) {
        return '../' + path;
    }
    return path;
}

async function loadSearchData() {
    if (searchLoaded) return;
    const primary = rootRelative('search-data.json');
    try {
        const resp = await fetch(primary);
        if (!resp.ok) throw new Error('Status ' + resp.status);
        searchData = await resp.json();
        searchLoaded = true;
    } catch (e) {
        console.error('Error loading search data', e);
    }
}

function initializeSearch() {
    searchInput.addEventListener('input', debounce(handleSearch, 160));
    searchInput.addEventListener('focus', handleSearchFocus);
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) hideSearchResults();
    });
    searchInput.addEventListener('keydown', handleSearchKeydown);
}

function handleSearch(e) {
    const query = e.target.value.trim();
    if (query.length < 2) { hideSearchResults(); return; }
    const results = searchItems(query);
    displaySearchResults(query, results);
}

function handleSearchFocus(e) {
    const q = e.target.value.trim();
    if (q.length >= 2) displaySearchResults(q, searchItems(q));
}

function handleSearchKeydown(e) {
    const active = searchResults.querySelector('.search-result.active');
    switch (e.key) {
        case 'ArrowDown': e.preventDefault(); selectNextResult(); break;
        case 'ArrowUp': e.preventDefault(); selectPreviousResult(); break;
        case 'Enter':
            if (active) {
                const link = active.querySelector('a');
                if (link) { window.location.href = link.href; }
                e.preventDefault();
            }
            break;
        case 'Escape': hideSearchResults(); searchInput.blur(); break;
    }
}

// ---------------- Fuzzy Matching ----------------
function normalize(str) {
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // remove diacritics
        .trim();
}

function tokenize(q) { return normalize(q).split(/\s+/).filter(Boolean); }

function levenshtein(a, b) {
    if (a === b) return 0;
    const al = a.length, bl = b.length;
    if (al === 0) return bl; if (bl === 0) return al;
    const dp = new Array(bl + 1);
    for (let j=0; j<=bl; j++) dp[j] = j;
    for (let i=1; i<=al; i++) {
        let prev = i - 1; dp[0] = i;
        for (let j=1; j<=bl; j++) {
            const tmp = dp[j];
            dp[j] = a[i-1] === b[j-1] ? prev : Math.min(prev + 1, dp[j] + 1, dp[j-1] + 1);
            prev = tmp;
        }
    }
    return dp[bl];
}

const FIELD_WEIGHTS = {
    title: 1.0,
    customName: 0.95,
    scientificName: 0.9,
    environmentName: 0.6,
    idTail: 0.55,
    id: 0.45
};

function scoreField(tokens, rawValue, field) {
    if (!rawValue) return {score:0, highlights:[]};
    const value = normalize(String(rawValue));
    let fieldScore = 0; const highlights = [];
    for (const token of tokens) {
        if (!token) continue;
        if (value === token) { fieldScore += 100; highlights.push({token, field}); continue; }
        if (value.startsWith(token)) { fieldScore += 85; highlights.push({token, field}); continue; }
        if (value.includes(token)) { fieldScore += 60; highlights.push({token, field}); continue; }
        // Fuzzy distance ratio
        const dist = levenshtein(value, token);
        const maxLen = Math.max(value.length, token.length);
        const ratio = 1 - dist / maxLen; // 1 best
        if (ratio >= 0.8) { fieldScore += 50 * ratio; highlights.push({token, field}); continue; }
        // Subsequence check
        if (isSubsequence(token, value)) { fieldScore += 35; highlights.push({token, field}); }
    }
    fieldScore *= (FIELD_WEIGHTS[field] || 0.3);
    return {score: fieldScore, highlights};
}

function isSubsequence(needle, hay) {
    let i=0; for (let c of hay) if (c===needle[i]) i++; return i===needle.length;
}

function aggregateHighlights(item, highlightMap) {
    const out = [];
    for (const [field, value] of Object.entries(highlightMap)) {
        if (!value) continue;
        const tokens = item.__tokens;
        const marked = highlightTokens(String(value), tokens);
        if (marked !== value) out.push({field, value: marked});
    }
    return out;
}

function searchItems(query) {
    const tokens = tokenize(query);
    return searchData.map(item => {
        const fields = ['title','customName','scientificName','environmentName','idTail','id'];
        let total = 0; let allHighlights = [];
        for (const f of fields) {
            const {score, highlights} = scoreField(tokens, item[f], f);
            total += score;
            allHighlights.push(...highlights);
        }
        // slight boost for plants vs environment when same score if query includes plant-y words
        if (item.type === 'plant') total += 2;
        return { ...item, score: total, __highlights: allHighlights, __tokens: tokens };
    })
        .filter(r => r.score > 5) // threshold
        .sort((a,b) => b.score - a.score)
        .slice(0, 12);
}

function highlightTokens(text, tokens) {
    if (!tokens || !tokens.length) return text;
    let result = text;
    const escaped = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const re = new RegExp('(' + escaped.join('|') + ')','ig');
    return result.replace(re, '<mark>$1</mark>');
}

function displaySearchResults(query, results) {
    if (!results.length) { hideSearchResults(); return; }
    searchResults.innerHTML = results.map((r,i) => {
        const metaBits = [];
        if (r.scientificName) metaBits.push('Sci: ' + highlightTokens(r.scientificName, r.__tokens));
        if (r.customName && r.customName !== r.title) metaBits.push('Custom: ' + highlightTokens(r.customName, r.__tokens));
        if (r.environmentName) metaBits.push('Env: ' + highlightTokens(r.environmentName, r.__tokens));
        const idPart = 'ID: ' + highlightTokens(r.idTail || r.id, r.__tokens);
        const meta = metaBits.concat(idPart).join(' • ');
        return `
      <div class="search-result ${i===0?'active':''}" data-url="${r.url}">
        <a href="${r.url}">
          <div class="search-result-type">${r.type}</div>
          <div class="search-result-title">${highlightTokens(r.title, r.__tokens)}</div>
          <div class="search-result-snippet">${meta}</div>
        </a>
      </div>`;
    }).join('');
    searchResults.style.display = 'block';
    searchResults.querySelectorAll('.search-result').forEach(el => {
        el.addEventListener('click', function() {
            const url = this.dataset.url; if (url) window.location.href = url;
        });
    });
}

function hideSearchResults() { searchResults.style.display='none'; searchResults.innerHTML=''; }

function selectNextResult() {
    const current = searchResults.querySelector('.search-result.active');
    const all = searchResults.querySelectorAll('.search-result');
    if (!all.length) return;
    if (!current) { all[0].classList.add('active'); return; }
    current.classList.remove('active');
    const next = current.nextElementSibling || all[0];
    next.classList.add('active');
}

function selectPreviousResult() {
    const current = searchResults.querySelector('.search-result.active');
    const all = searchResults.querySelectorAll('.search-result');
    if (!all.length) return;
    if (!current) { all[all.length-1].classList.add('active'); return; }
    current.classList.remove('active');
    const prev = current.previousElementSibling || all[all.length-1];
    prev.classList.add('active');
}

// Utility: debounce
function debounce(fn, wait) {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(()=>fn(...args), wait); };
}
