(() => {
    const reports = document.querySelector('#live-reports');
    if (!reports) return;
    const status = document.querySelector('#live-status');
    let refreshing = false;
    async function refresh() {
        if (refreshing || document.hidden || (reports.contains(document.activeElement) && document.activeElement.matches('input:not(.preparation-select),select,textarea'))) return;
        refreshing = true;
        try {
            const response = await fetch(reports.dataset.url, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'text/html' } });
            if (response.redirected) { location.assign(response.url); return; }
            if (!response.ok) throw new Error('Refresh unavailable');
            const markup = await response.text();
            // Capture selection/details after the response arrives so interactions
            // during the fetch are retained as well.
            const latestSelected = new Set([...reports.querySelectorAll('.preparation-select:checked')].map(input => input.value));
            const latestOpen = new Set([...reports.querySelectorAll('details[id][open]')].map(detail => detail.id));
            reports.innerHTML = markup;
            reports.querySelectorAll('.preparation-select:not(:disabled)').forEach(input => { input.checked = latestSelected.has(input.value); });
            reports.querySelectorAll('details[id]').forEach(detail => { detail.open = latestOpen.has(detail.id); });
            reports.dispatchEvent(new Event('reports:refreshed'));
            status.textContent = 'Live reports · refreshed every 10 seconds';
        } catch { status.textContent = 'Refresh interrupted · retrying automatically'; }
        finally { refreshing = false; }
    }
    window.setInterval(refresh, 10000);
})();

const generationSearch=document.getElementById('generation-search');
generationSearch?.addEventListener('input',()=>{const term=generationSearch.value.trim().toLocaleLowerCase();document.querySelectorAll('.generation-card').forEach(card=>{card.hidden=!card.dataset.search.includes(term);});});
