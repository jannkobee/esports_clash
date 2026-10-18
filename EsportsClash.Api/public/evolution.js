(() => {
    const reports = document.querySelector('#live-reports');
    if (!reports) return;
    const status = document.querySelector('#live-status');
    let refreshing = false;
    async function refresh() {
        if (refreshing || document.hidden || reports.contains(document.activeElement)) return;
        refreshing = true;
        try {
            const response = await fetch(reports.dataset.url, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'text/html' } });
            if (response.redirected) { location.assign(response.url); return; }
            if (!response.ok) throw new Error('Refresh unavailable');
            reports.innerHTML = await response.text();
            status.textContent = 'Live reports · refreshed every 10 seconds';
        } catch { status.textContent = 'Refresh interrupted · retrying automatically'; }
        finally { refreshing = false; }
    }
    window.setInterval(refresh, 10000);
})();
