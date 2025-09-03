// Planta Dashboard JavaScript
document.addEventListener('DOMContentLoaded', function() {
    console.log('Planta Dashboard loaded');

    // Initialize URL routing
    initializeRouting();

    // Initialize mobile navigation if needed
    initializeMobileNav();

    // Initialize persona cards (AI summaries)
    initializePersonaCards();
});

// URL routing for ID-based redirection
function initializeRouting() {
    const hash = window.location.hash.substring(1);
    const searchParams = new URLSearchParams(window.location.search);
    const id = searchParams.get('id') || hash;

    if (id && id.length >= 3) {
        // Try to find matching plant or environment by ID or partial ID
        redirectToItem(id);
    }
}

function redirectToItem(searchId) {
    // Load search data and find matches
    fetch('search-data.json')
        .then(response => response.json())
        .then(data => {
            const matches = findMatches(data, searchId);

            if (matches.length === 1) {
                // Exact match, redirect immediately
                window.location.href = matches[0].url;
            } else if (matches.length > 1) {
                // Multiple matches, show selection
                showMultipleMatches(matches);
            } else {
                // No matches, show error
                showNoMatchesError(searchId);
            }
        })
        .catch(error => {
            console.error('Error loading search data:', error);
        });
}

function findMatches(data, searchId) {
    const searchLower = searchId.toLowerCase();

    return data.filter(item => {
        // Exact ID match
        if (item.id && item.id.toLowerCase() === searchLower) return true;

        // ID tail match
        if (item.idTail && item.idTail.toLowerCase() === searchLower) return true;

        // Partial ID match (at least 6 characters)
        if (searchId.length >= 6 && item.id && item.id.toLowerCase().includes(searchLower)) return true;

        // Slug match
        if (item.slug && item.slug.toLowerCase() === searchLower) return true;

        return false;
    });
}

function showMultipleMatches(matches) {
    const content = document.querySelector('.main-content');
    if (!content) return;

    content.innerHTML = `
        <div class="multiple-matches">
            <h1>Multiple matches found</h1>
            <p>Multiple items match your search. Please select one:</p>
            <div class="matches-list">
                \${matches.map(match => "<div class="match-item">
        <a href="\\${match.url}">
        <h3>\\${match.title}</h3>
    <p>Type: \\${match.type}</p>
    <p>ID: \\${match.id}</p>
</a>
</div>").join('')}
            </div>
        </div>
    `;
}

function showNoMatchesError(searchId) {
    const content = document.querySelector('.main-content');
    if (!content) return;

    content.innerHTML = `
        <div class="no-matches">
            <h1>No matches found</h1>
            <p>No plants or environments found matching "<strong>\${searchId}</strong>".</p>
            <p><a href="index.html">Return to dashboard</a></p>
        </div>
    `;
}

function initializeMobileNav() {
    // Add mobile navigation toggle if needed
    // This is a placeholder for future mobile menu functionality
}

// Language switching
(function(){
  function initLanguageSwitcher(){
    const select = document.getElementById('language-select');
    if(!select) return;
    select.addEventListener('change', () => {
      const newLang = select.value;
      const langsAttr = document.body.getAttribute('data-languages') || 'en';
      const langs = langsAttr.split(',');
      const path = window.location.pathname;
      // Build regex to replace current language segment
      const regex = new RegExp('/(' + langs.join('|') + ')(/|$)');
      let target;
      if(regex.test(path)) {
        target = path.replace(regex, '/' + newLang + '$2');
      } else {
        // fallback to root + newLang
        const base = path.endsWith('/') ? path : path.substring(0, path.lastIndexOf('/')+1);
        target = base + newLang + '/';
      }
      // If we switched to a different language and file likely does not exist (heuristic), fallback to index
      if(target.endsWith('/')) {
        window.location.href = target;
      } else {
        // Try same page; if it 404s user can navigate back manually
        window.location.href = target;
      }
    });
  }
  document.addEventListener('DOMContentLoaded', initLanguageSwitcher);
})();

// Relative time handling
(function() {
    // Use explicit page language
    function pageLang(){
      return document.body.getAttribute('data-current-lang') || (navigator.language || 'en');
    }

    function pad(n){ return n < 10 ? '0'+n : ''+n; }
    function formatAbsolute(date, locale) {
        const y = date.getFullYear();
        const M = pad(date.getMonth()+1);
        const d = pad(date.getDate());
        const H = pad(date.getHours());
        const m = pad(date.getMinutes());
        if (locale.startsWith('de')) {
            return `${d}.${M}.${y} ${H}:${m}`;
        }
        return `${y}-${M}-${d} ${H}:${m}`;
    }

    function formatElapsedParts(ms) {
        const minutes = Math.floor(Math.abs(ms) / 60000);
        const days = Math.floor(minutes / (60*24));
        const hours = Math.floor((minutes - days*24*60)/60);
        const mins = minutes - days*24*60 - hours*60;
        const parts = [];
        if (days) parts.push(days + 'd');
        if (hours) parts.push(hours + 'h');
        parts.push(mins + 'm');
        return parts.join(' ');
    }

    function formatRelative(ts, now, locale) {
        const date = new Date(ts);
        const diffMs = now - date; // positive if past
        const isFuture = diffMs < 0;
        const absMs = Math.abs(diffMs);
        const absHours = Math.floor(absMs / 3600000);
        const absDays = Math.floor(absHours / 24);
        function buckets(lang) {
            if (!isFuture) { // past
                if (absHours < 1) return lang === 'de' ? 'in der letzten Stunde' : 'in the last hour';
                if (absHours < 24) return lang === 'de' ? 'in den letzten 24h' : 'in the last 24h';
                if (absDays === 1) return lang === 'de' ? 'gestern' : 'yesterday';
                if (absDays < 7) return lang === 'de' ? `vor etwa ${absDays} Tagen` : `about ${absDays} days ago`;
                if (absDays < 14) return lang === 'de' ? 'vor etwa einer Woche' : 'about a week ago';
                if (absDays < 21) return lang === 'de' ? 'vor etwa 2 Wochen' : 'about 2 weeks ago';
                if (absDays < 28) return lang === 'de' ? 'vor etwa 3 Wochen' : 'about 3 weeks ago';
                if (absDays < 45) return lang === 'de' ? 'vor etwa einem Monat' : 'about a month ago';
                if (absDays < 365) {
                    const months = Math.floor((absDays + 15) / 30);
                    if (months <= 1) return lang === 'de' ? 'vor etwa einem Monat' : 'about a month ago';
                    return lang === 'de' ? `vor etwa ${months} Monaten` : `about ${months} months ago`;
                }
                const years = Math.floor((absDays + 182) / 365);
                if (years <= 1) return lang === 'de' ? 'vor etwa einem Jahr' : 'about a year ago';
                return lang === 'de' ? `vor etwa ${years} Jahren` : `about ${years} years ago`;
            } else { // future
                if (absHours < 1) return locale.startsWith('de') ? 'innerhalb der nächsten Stunde' : 'within the next hour';
                if (absHours < 24) return locale.startsWith('de') ? 'innerhalb der nächsten 24h' : 'within the next 24h';
                if (absDays === 1) return locale.startsWith('de') ? 'morgen' : 'tomorrow';
                if (absDays < 7) return locale.startsWith('de') ? `in etwa ${absDays} Tagen` : `in about ${absDays} days`;
                if (absDays < 14) return locale.startsWith('de') ? 'in etwa einer Woche' : 'in about a week';
                if (absDays < 21) return locale.startsWith('de') ? 'in etwa 2 Wochen' : 'in about 2 weeks';
                if (absDays < 28) return locale.startsWith('de') ? 'in etwa 3 Wochen' : 'in about 3 weeks';
                if (absDays < 45) return locale.startsWith('de') ? 'in etwa einem Monat' : 'in about a month';
                if (absDays < 365) {
                    const months = Math.floor((absDays + 15) / 30);
                    if (months <= 1) return locale.startsWith('de') ? 'in etwa einem Monat' : 'in about a month';
                    return locale.startsWith('de') ? `in etwa ${months} Monaten` : `in about ${months} months`;
                }
                const years = Math.floor((absDays + 182) / 365);
                if (years <= 1) return locale.startsWith('de') ? 'in etwa einem Jahr' : 'in about a year';
                return locale.startsWith('de') ? `in etwa ${years} Jahren` : `in about ${years} years`;
            }
        }
        return buckets(locale.startsWith('de') ? 'de' : 'en');
    }

    function buildTooltipText(ts, now, locale) {
        const date = new Date(ts);
        const abs = formatAbsolute(date, locale);
        const diff = now - date; // + past, - future
        const elapsed = formatElapsedParts(diff);
        if (locale.startsWith('de')) {
            if (diff >= 0) {
                // past
                // Replace 'd' with 'T' for German days label in elapsed part copy
                const german = elapsed.replace(/(\d+)d/g, '$1T');
                return `${abs} • vor ${german}`;
            } else {
                const german = elapsed.replace(/(\d+)d/g, '$1T');
                return `${abs} • in ${german}`;
            }
        } else {
            if (diff >= 0) {
                return `${abs} • ${elapsed} ago`;
            } else {
                return `${abs} • in ${elapsed}`;
            }
        }
    }

    function updateRelativeTimes() {
        const now = Date.now();
        const locale = pageLang();
        document.querySelectorAll('time.relative-time[data-timestamp]').forEach(el => {
            const raw = el.getAttribute('data-timestamp');
            if (!raw) return;
            let ts = Number(raw);
            if (ts < 1e12) ts *= 1000; // seconds -> ms safeguard
            el.textContent = formatRelative(ts, now, locale);
            // store tooltip text for quick access
            el.dataset.tooltip = buildTooltipText(ts, now, locale);
        });
        // refresh visible tooltip if any
        if (currentTooltip && currentTooltipAnchor) {
            const tsRaw = currentTooltipAnchor.getAttribute('data-timestamp');
            if (tsRaw) {
                let tsv = Number(tsRaw); if (tsv < 1e12) tsv *= 1000;
                currentTooltip.textContent = buildTooltipText(tsv, now, locale);
                positionTooltip(currentTooltipAnchor);
            }
        }
    }

    // Custom tooltip implementation
    let currentTooltip = null;
    let currentTooltipAnchor = null;

    function positionTooltip(anchor) {
        if (!currentTooltip) return;
        const rect = anchor.getBoundingClientRect();
        const tt = currentTooltip;
        tt.style.visibility = 'hidden';
        tt.style.left = '0px';
        tt.style.top = '0px';
        tt.style.maxWidth = Math.min(window.innerWidth - 16, 360) + 'px';
        // allow layout to measure
        tt.style.display = 'block';
        const ttRect = tt.getBoundingClientRect();
        let top = rect.top + window.scrollY - ttRect.height - 8;
        let left = rect.left + window.scrollX + rect.width/2 - ttRect.width/2;
        // adjust within viewport
        if (top < window.scrollY + 4) top = rect.bottom + window.scrollY + 8;
        if (left < 4) left = 4;
        const maxLeft = window.scrollX + window.innerWidth - ttRect.width - 4;
        if (left > maxLeft) left = maxLeft;
        tt.style.left = left + 'px';
        tt.style.top = top + 'px';
        tt.style.visibility = 'visible';
    }

    function showTooltip(el) {
        const text = el.dataset.tooltip;
        if (!text) return;
        if (!currentTooltip) {
            currentTooltip = document.createElement('div');
            currentTooltip.className = 'rt-tooltip';
            currentTooltip.setAttribute('role', 'tooltip');
            document.body.appendChild(currentTooltip);
        }
        currentTooltip.textContent = text;
        currentTooltipAnchor = el;
        currentTooltipAnchor.setAttribute('aria-describedby', 'rt-tooltip-active');
        currentTooltip.id = 'rt-tooltip-active';
        positionTooltip(el);
        currentTooltip.classList.add('visible');
    }

    function hideTooltip() {
        if (currentTooltip) currentTooltip.classList.remove('visible');
        if (currentTooltipAnchor) currentTooltipAnchor.removeAttribute('aria-describedby');
        currentTooltipAnchor = null;
    }

    function bindTooltipEvents() {
        document.addEventListener('mouseenter', e => {
            const t = e.target;
            if (t && t.matches && t.matches('time.relative-time')) {
                showTooltip(t);
            }
        }, true);
        document.addEventListener('mouseleave', e => {
            const t = e.target;
            if (t && t.matches && t.matches('time.relative-time')) {
                hideTooltip();
            }
        }, true);
        document.addEventListener('focusin', e => {
            const t = e.target;
            if (t && t.matches && t.matches('time.relative-time')) {
                showTooltip(t);
            }
        });
        document.addEventListener('focusout', e => {
            const t = e.target;
            if (t && t.matches && t.matches('time.relative-time')) {
                hideTooltip();
            }
        });
        window.addEventListener('scroll', () => { if (currentTooltipAnchor) positionTooltip(currentTooltipAnchor); }, { passive: true });
        window.addEventListener('resize', () => { if (currentTooltipAnchor) positionTooltip(currentTooltipAnchor); });
    }

    document.addEventListener('DOMContentLoaded', () => {
        updateRelativeTimes();
        bindTooltipEvents();
        setInterval(updateRelativeTimes, 60 * 1000); // refresh every minute
    });
})();

// Persona card expand/collapse logic
function initializePersonaCards() {
    const cards = document.querySelectorAll('.ai-summary');
    if(!cards.length) return;
    cards.forEach(card => {
        const desc = card.querySelector('.persona-desc');
        if(!desc) return; // skip error cards
        // Toggle on click (mobile friendly)
        card.addEventListener('click', (e) => {
            // Avoid selecting text triggering toggle repeatedly
            if(window.getSelection && window.getSelection().toString().length > 0) return;
            toggleCard(card);
        });
        // Keyboard accessibility
        card.addEventListener('keydown', (e) => {
            if(e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleCard(card);
            }
        });
    });
    // Collapse when clicking outside
    document.addEventListener('click', (e) => {
        const target = e.target;
        if(!(target instanceof Element)) return;
        if(!target.closest('.ai-summary')) {
            document.querySelectorAll('.ai-summary.expanded').forEach(exp => {
                exp.classList.remove('expanded');
                exp.setAttribute('aria-expanded','false');
            });
        }
    });
}

function toggleCard(card){
    const expanded = card.classList.toggle('expanded');
    card.setAttribute('aria-expanded', expanded ? 'true' : 'false');
}
