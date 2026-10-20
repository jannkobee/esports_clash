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
        bodyDiv.innerHTML = message;

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

        // Auto dismiss
        const timer = setTimeout(() => dismissToast(toast), duration);
        toast.addEventListener('mouseenter', () => progress.style.animationPlayState = 'paused');
        toast.addEventListener('mouseleave', () => progress.style.animationPlayState = 'running');

        function dismissToast(el) {
            clearTimeout(timer);
            el.classList.add('toast-exit');
            el.addEventListener('animationend', () => el.remove(), { once: true });
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
                const latestSelected = new Set([...reports.querySelectorAll('.preparation-select:checked')].map(input => input.value));
                const latestOpen = new Set([...reports.querySelectorAll('details[id][open]')].map(detail => detail.id));
                
                reports.innerHTML = markup;
                reports.querySelectorAll('.preparation-select:not(:disabled)').forEach(input => { input.checked = latestSelected.has(input.value); });
                reports.querySelectorAll('details[id]').forEach(detail => { detail.open = latestOpen.has(detail.id); });
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

        generationSearch.addEventListener('input', () => {
            const term = generationSearch.value.trim().toLocaleLowerCase();
            document.querySelectorAll('.generation-card').forEach(card => {
                const match = !term || (card.dataset.search && card.dataset.search.includes(term));
                card.hidden = !match;
            });
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
                    const category = pill.dataset.category;
                    const items = targetContainer.querySelectorAll('[data-status-category]');
                    items.forEach(item => {
                        if (category === 'all' || item.dataset.statusCategory === category) {
                            item.hidden = false;
                        } else {
                            item.hidden = true;
                        }
                    });
                });
            });
        });
    }

    // -------------------------------------------------------------
    // Seamless No-Reload Form Submissions (DOM Morphing & Ajax)
    // -------------------------------------------------------------
    function setupFormInterception() {
        document.addEventListener('submit', async (e) => {
            const form = e.target;
            if (!form || form.tagName !== 'FORM') return;

            // Skip forms with data-no-ajax, downloads, or target="_blank"
            if (form.hasAttribute('data-no-ajax') || form.target === '_blank') return;
            const action = form.getAttribute('action') || window.location.href;
            const actionUrl = new URL(action, window.location.origin);
            if (actionUrl.origin !== window.location.origin) return;
            if (actionUrl.pathname.includes('/download') || actionUrl.pathname.includes('/asset') || actionUrl.pathname.endsWith('/logout')) return;

            e.preventDefault();

            // Find submitter button
            const submitter = e.submitter || form.querySelector('button[type="submit"]') || form.querySelector('button:not([type])');
            let originalButtonHtml = '';
            if (submitter) {
                originalButtonHtml = submitter.innerHTML;
                submitter.disabled = true;
                submitter.classList.add('is-loading');
                submitter.innerHTML = `<span class="btn-spinner" aria-hidden="true"></span> ${submitter.textContent.trim()}`;
            }

            try {
                const formData = new FormData(form);
                if (e.submitter && e.submitter.name && !formData.has(e.submitter.name)) {
                    formData.append(e.submitter.name, e.submitter.value);
                }

                const method = (form.getAttribute('method') || 'POST').toUpperCase();
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
            const anchor = e.target.closest('a');
            if (!anchor || anchor.hasAttribute('data-no-ajax') || anchor.target === '_blank') return;
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
                const target = document.querySelector(window.location.hash);
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
