/**
 * Esports Clash — Evolution Lab Reactive SPA & Live Engine
 * Provides seamless no-reload forms, Livewire-style DOM morphing,
 * toast notifications, live telemetry polling, and instant micro-interactions.
 */
(() => {
    // -------------------------------------------------------------
    // Toast Notification System
    // -------------------------------------------------------------
    function ensureToastContainer() {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.setAttribute('aria-live', 'polite');
            document.body.appendChild(container);
        }
        return container;
    }

    function showToast(message, type = 'info', duration = 4200) {
        if (!message) return;
        const container = ensureToastContainer();
        const toast = document.createElement('div');
        toast.className = `toast toast-${type} toast-enter`;
        
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        const iconSpan = document.createElement('span');
        iconSpan.className = 'toast-icon';
        iconSpan.textContent = icons[type] || 'ℹ';

        const bodyDiv = document.createElement('div');
        bodyDiv.className = 'toast-body';
        bodyDiv.textContent = message;

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'toast-close';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.textContent = '×';
        closeBtn.onclick = () => dismissToast(toast);

        const progress = document.createElement('div');
        progress.className = 'toast-progress';
        progress.style.animationDuration = `${duration}ms`;

        toast.appendChild(iconSpan);
        toast.appendChild(bodyDiv);
        toast.appendChild(closeBtn);
        toast.appendChild(progress);
        container.appendChild(toast);

        let remaining = duration, started = performance.now();
        let timer = setTimeout(() => dismissToast(toast), remaining);
        toast.addEventListener('mouseenter', () => {
            clearTimeout(timer);
            remaining = Math.max(0, remaining - (performance.now() - started));
            progress.style.animationPlayState = 'paused';
        });
        toast.addEventListener('mouseleave', () => {
            started = performance.now();
            timer = setTimeout(() => dismissToast(toast), remaining);
            progress.style.animationPlayState = 'running';
        });

        function dismissToast(el) {
            if (el.dataset.dismissing) return;
            el.dataset.dismissing = 'true';
            clearTimeout(timer);
            el.classList.remove('toast-enter');
            el.classList.add('toast-exit');
            // Removal also works with reduced motion or interrupted animations.
            setTimeout(() => el.remove(), 200);
        }
    }

    // Auto-echo page status / errors as toasts on fresh load or after soft update
    function checkPageNotices(root = document) {
        const success = root.querySelector('.notice.success');
        if (success && !success.dataset.toasted) {
            success.dataset.toasted = 'true';
            showToast(success.textContent.trim(), 'success');
        }
        const error = root.querySelector('.notice.error');
        if (error && !error.dataset.toasted) {
            error.dataset.toasted = 'true';
            showToast(error.textContent.trim(), 'error', 6000);
        }
    }

    // -------------------------------------------------------------
    // Live Telemetry / Reports Poller
    // -------------------------------------------------------------
    let liveReportsInterval = null;

    function initLiveReports() {
        if (liveReportsInterval) {
            clearInterval(liveReportsInterval);
            liveReportsInterval = null;
        }

        const reports = document.querySelector('#live-reports');
        if (!reports || !reports.dataset.url) return;
        const status = document.querySelector('#live-status');
        let refreshing = false;

        async function refresh() {
            if (refreshing || document.hidden || (reports.contains(document.activeElement) && document.activeElement.matches('input:not(.preparation-select),select,textarea'))) return;
            refreshing = true;
            try {
                const response = await fetch(reports.dataset.url, {
                    credentials: 'same-origin',
                    cache: 'no-store',
                    headers: { 'Accept': 'text/html', 'X-Requested-With': 'XMLHttpRequest' }
                });
                if (response.redirected) {
                    softNavigate(response.url);
                    return;
                }
                if (!response.ok) throw new Error('Refresh unavailable');
                const markup = await response.text();
                if (!reports.isConnected) return;
                const latestSelected = new Set([...reports.querySelectorAll('.preparation-select:checked')].map(input => input.value));
                const latestOpen = new Set([...reports.querySelectorAll('details[id][open]')].map(detail => detail.id));
                const latestCategories = new Map([...reports.querySelectorAll('.category-filter-bar')].map(bar =>
                    [bar.dataset.target, bar.querySelector('.category-pill.active')?.dataset.category ?? 'all']));
                
                reports.innerHTML = markup;
                reports.querySelectorAll('.preparation-select:not(:disabled)').forEach(input => { input.checked = latestSelected.has(input.value); });
                reports.querySelectorAll('details[id]').forEach(detail => { detail.open = latestOpen.has(detail.id); });
                reports.querySelectorAll('.category-filter-bar').forEach(bar => {
                    const category = latestCategories.get(bar.dataset.target) ?? 'all';
                    bar.querySelectorAll('.category-pill').forEach(pill => pill.classList.toggle('active', pill.dataset.category === category));
                });
                initCategoryFilters();
                reports.dispatchEvent(new Event('reports:refreshed'));
                if (status) status.textContent = 'Live reports · refreshed every 10 seconds';
            } catch {
                if (status) status.textContent = 'Refresh interrupted · retrying automatically';
            } finally {
                refreshing = false;
            }
        }

        liveReportsInterval = window.setInterval(refresh, 10000);
    }

    // -------------------------------------------------------------
    // Generation Search Filter
    // -------------------------------------------------------------
    function initGenerationSearch() {
        const generationSearch = document.getElementById('generation-search');
        if (!generationSearch || generationSearch.dataset.bound) return;
        generationSearch.dataset.bound = 'true';

        generationSearch.addEventListener('input', applyFilters);
        applyFilters();
    }

    function applyFilters() {
        document.querySelectorAll('.category-filter-bar').forEach(bar => {
            const target = document.querySelector(bar.dataset.target || '#live-reports');
            if (!target) return;
            const category = bar.querySelector('.category-pill.active')?.dataset.category ?? 'all';
            bar.querySelectorAll('.category-pill').forEach(pill => pill.setAttribute('aria-pressed', String(pill.dataset.category === category)));
            const term = (document.getElementById('generation-search')?.value ?? '').trim().toLocaleLowerCase();
            const items = [...target.querySelectorAll('[data-status-category]')];
            items.forEach(item => {
                const matchesSearch = !item.matches('.generation-card') || !term || (item.dataset.search ?? '').includes(term);
                item.hidden = !matchesSearch || category !== 'all' && item.dataset.statusCategory !== category;
            });
            if (target.id === 'generation-roster') {
                const status = document.getElementById('generation-filter-status');
                const visible = items.filter(item => !item.hidden).length;
                if (status) status.textContent = visible ? `${visible} of ${items.length} avatars shown` : 'No avatars match. Try another name, role or category.';
            }
        });
    }

    // -------------------------------------------------------------
    // Status Category Filters (Failed vs Succeeded vs Running)
    // -------------------------------------------------------------
    function initCategoryFilters() {
        document.querySelectorAll('.category-filter-bar').forEach(bar => {
            if (bar.dataset.bound) return;
            bar.dataset.bound = 'true';
            const targetSelector = bar.dataset.target || '#live-reports, .run-list, .generation-roster';
            const targetContainer = document.querySelector(targetSelector);
            if (!targetContainer) return;
            const pills = bar.querySelectorAll('.category-pill');
            pills.forEach(pill => {
                pill.addEventListener('click', (e) => {
                    e.preventDefault();
                    pills.forEach(p => p.classList.remove('active'));
                    pill.classList.add('active');
                    applyFilters();
                });
            });
        });
        applyFilters();
    }

    // -------------------------------------------------------------
    // Seamless No-Reload Form Submissions (DOM Morphing & Ajax)
    // -------------------------------------------------------------
    function setupFormInterception() {
        document.addEventListener('submit', async (e) => {
            const form = e.target;
            if (e.defaultPrevented || !form || form.tagName !== 'FORM') return;

            // Page-specific scripts own editor/confirmation state and must run
            // on each document load. Native submission preserves their guards,
            // Laravel's validation redirects and authentication/CSRF lifecycle.
            if (form.hasAttribute('data-no-ajax') || form.target || form.matches('.login-form') || document.querySelector('main script')) return;
            const action = form.getAttribute('action') || window.location.href;
            const actionUrl = new URL(action, window.location.origin);
            if (actionUrl.origin !== window.location.origin) return;
            if (actionUrl.pathname.includes('/download') || actionUrl.pathname.includes('/asset') || actionUrl.pathname.endsWith('/logout')) return;

            e.preventDefault();
            if (form.dataset.submitting) return;
            form.dataset.submitting = 'true';

            // Find submitter button
            const submitter = e.submitter || form.querySelector('button[type="submit"]') || form.querySelector('button:not([type])');
            const formData = new FormData(form, e.submitter ?? undefined);
            let originalButtonHtml = '';
            if (submitter) {
                originalButtonHtml = submitter.innerHTML;
                submitter.disabled = true;
                submitter.classList.add('is-loading');
                submitter.innerHTML = `<span class="btn-spinner" aria-hidden="true"></span> ${submitter.textContent.trim()}`;
            }

            try {
                const method = (form.getAttribute('method') || 'GET').toUpperCase();
                const fetchOptions = {
                    method: method === 'GET' ? 'GET' : 'POST',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Accept': 'text/html'
                    },
                    credentials: 'same-origin'
                };

                let targetUrl = actionUrl.href;
                if (method === 'GET') {
                    const searchParams = new URLSearchParams(formData);
                    targetUrl = `${actionUrl.pathname}?${searchParams.toString()}`;
                } else {
                    fetchOptions.body = formData;
                }

                const response = await fetch(targetUrl, fetchOptions);
                const responseHtml = await response.text();

                if (!response.ok && response.status !== 422) {
                    showToast(`Action failed (HTTP ${response.status})`, 'error');
                    return;
                }

                // If redirected or URL changed
                const finalUrl = response.url || targetUrl;
                if (finalUrl && finalUrl !== window.location.href) {
                    window.history.pushState({ path: finalUrl }, '', finalUrl);
                }

                // Apply updated HTML
                applyPageUpdate(responseHtml);

            } catch (err) {
                console.error('Form submission error:', err);
                showToast('Network error while processing action. Please retry.', 'error');
            } finally {
                delete form.dataset.submitting;
                if (submitter) {
                    submitter.disabled = false;
                    submitter.classList.remove('is-loading');
                    submitter.innerHTML = originalButtonHtml;
                }
            }
        });
    }

    // -------------------------------------------------------------
    // Soft Navigation (wire:navigate and nav pills without reload)
    // -------------------------------------------------------------
    async function softNavigate(url, push = true) {
        if (document.querySelector('main script')) {
            window.location.assign(url);
            return;
        }
        try {
            document.body.classList.add('page-transitioning');
            const response = await fetch(url, {
                credentials: 'same-origin',
                headers: { 'Accept': 'text/html', 'X-Requested-With': 'XMLHttpRequest' }
            });
            if (response.redirected && response.url) {
                url = response.url;
            }
            if (!response.ok) {
                window.location.href = url;
                return;
            }
            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            if (doc.querySelector('main script')) {
                window.location.assign(url);
                return;
            }
            if (push) {
                window.history.pushState({ path: url }, '', url);
            }
            applyPageUpdate(html);
        } catch (err) {
            console.warn('Soft navigation fallback to hard navigation:', err);
            window.location.href = url;
        } finally {
            document.body.classList.remove('page-transitioning');
        }
    }

    function setupLinkInterception() {
        document.addEventListener('click', (e) => {
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !(e.target instanceof Element)) return;
            const anchor = e.target.closest('a');
            if (!anchor || anchor.hasAttribute('data-no-ajax') || anchor.hasAttribute('download') || anchor.target || document.querySelector('main script')) return;
            const href = anchor.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

            const url = new URL(href, window.location.origin);
            if (url.origin !== window.location.origin) return;
            if (url.pathname.includes('/download') || url.pathname.includes('/asset') || url.pathname.endsWith('/logout')) return;

            // Intercept if wire:navigate is present, or inside navigation bar, or explicit .soft-nav
            const isNavigate = anchor.hasAttribute('wire:navigate') || 
                               anchor.closest('.report-nav') || 
                               anchor.classList.contains('brand') || 
                               anchor.classList.contains('soft-nav');

            if (isNavigate) {
                e.preventDefault();
                softNavigate(url.href);
            }
        });

        window.addEventListener('popstate', (e) => {
            softNavigate(window.location.href, false);
        });
    }

    // -------------------------------------------------------------
    // DOM Morphing & Page Update Rehydration
    // -------------------------------------------------------------
    function applyPageUpdate(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        if (doc.querySelector('main script')) {
            window.location.reload();
            return;
        }
        const csrf = doc.querySelector('meta[name="csrf-token"]');
        if (csrf) document.querySelector('meta[name="csrf-token"]').content = csrf.content;
        const header = doc.querySelector('.topbar');
        if (header) document.querySelector('.topbar')?.replaceWith(header);

        // Update document title
        if (doc.title) {
            document.title = doc.title;
        }

        const currentMain = document.querySelector('main');
        const newMain = doc.querySelector('main');

        if (currentMain && newMain) {
            // Preserve active open details and checkboxes
            const openDetails = new Set([...currentMain.querySelectorAll('details[id][open]')].map(d => d.id));
            const checkedBoxes = new Set([...currentMain.querySelectorAll('.preparation-select:checked')].map(b => b.value));

            // Morph innerHTML
            currentMain.innerHTML = newMain.innerHTML;

            // Restore preserved state
            currentMain.querySelectorAll('details[id]').forEach(d => {
                if (openDetails.has(d.id)) d.open = true;
            });
            currentMain.querySelectorAll('.preparation-select').forEach(b => {
                if (checkedBoxes.has(b.value)) b.checked = true;
            });

            // Smooth scroll if URL had a hash
            if (window.location.hash) {
                const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
                if (target) target.scrollIntoView({ behavior: 'smooth' });
            }
        }

        // Update navigation active states
        const currentNav = document.querySelector('.report-nav');
        const newNav = doc.querySelector('.report-nav');
        if (currentNav && newNav) {
            currentNav.innerHTML = newNav.innerHTML;
        }

        // Rehydrate components
        initLiveReports();
        initGenerationSearch();
        initCategoryFilters();
        checkPageNotices();

        // Dispatch page refreshed hook
        document.dispatchEvent(new CustomEvent('evolution:page-updated', { detail: { url: window.location.href } }));
    }

    function initModals() {
        document.addEventListener('click', (e) => {
            if (e.target && e.target.nodeName === 'DIALOG' && e.target.classList.contains('evolution-modal')) {
                const rect = e.target.getBoundingClientRect();
                const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height
                  && rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
                if (!isInDialog) {
                    e.target.close();
                }
            }
        });
    }

    // -------------------------------------------------------------
    // Boot Lifecycle
    // -------------------------------------------------------------
    function boot() {
        ensureToastContainer();
        initLiveReports();
        initGenerationSearch();
        initCategoryFilters();
        initModals();
        setupFormInterception();
        setupLinkInterception();
        checkPageNotices();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

    // Expose helpers globally on window.Evolution
    window.Evolution = {
        showToast,
        softNavigate,
        applyPageUpdate,
        refreshReports: initLiveReports
    };
})();
