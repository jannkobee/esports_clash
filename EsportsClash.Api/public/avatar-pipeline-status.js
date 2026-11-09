(() => {
    const start = () => {
        for (const panel of document.querySelectorAll('[data-avatar-pipeline-status]')) {
            if (panel.dataset.initialized) continue;
            panel.dataset.initialized = 'true';
            const button = panel.querySelector('[data-pipeline-refresh]');
            const message = panel.querySelector('[data-pipeline-message]');
            const body = panel.querySelector('[data-pipeline-stages]');
            let pending = false;
            const refresh = async () => {
                if (pending) return;
                pending = true;
                button.disabled = true;
                message.textContent = 'Checking cloud stages…';
                try {
                    const response = await fetch(panel.dataset.statusUrl, {headers: {Accept: 'application/json'}, credentials: 'same-origin', signal: AbortSignal.timeout(90000)});
                    if (!response.ok) throw new Error('Readiness request failed');
                    const {data} = await response.json();
                    if (data?.schema !== 'avatar-pipeline-readiness-v1' || !Array.isArray(data.stages)) throw new Error('Invalid readiness receipt');
                    const rows = data.stages.map(stage => {
                        const row = document.createElement('tr');
                        for (const value of [stage.label, stage.provider, stage.compute === 'google' ? 'Google Colab' : 'Unverified', stage.status, stage.reason]) {
                            const cell = document.createElement('td');
                            cell.textContent = value || '—';
                            row.append(cell);
                        }
                        return row;
                    });
                    body.replaceChildren(...rows);
                    message.textContent = data.message;
                    panel.querySelector('[data-pipeline-evidence]').textContent = JSON.stringify(data, null, 2);
                    const diagnostics = panel.querySelector('[data-pipeline-diagnostics]');
                    const reviews = (data.diagnostics || []).map(review => {
                        const entry = document.createElement('p');
                        entry.textContent = review.summary + ' Source ' + (review.source_sha256 || '').slice(0, 12) + ' · ' + review.status + ' · Google Colab.';
                        return entry;
                    });
                    if (!reviews.length) {
                        const empty = document.createElement('p');
                        empty.textContent = 'No completed cloud deformation diagnostics recorded yet.';
                        reviews.push(empty);
                    }
                    diagnostics.replaceChildren(...reviews);
                    panel.querySelector('[data-pipeline-checked]').textContent = 'Checked ' + new Intl.DateTimeFormat('en-PH', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila'}).format(new Date(data.checked_at)) + ' · Manila time. Status is rechecked when a job starts.';
                } catch {
                    body.replaceChildren();
                    message.textContent = 'Cloud readiness could not be verified. Refresh after the control connection responds.';
                    panel.querySelector('[data-pipeline-checked]').textContent = '';
                    panel.querySelector('[data-pipeline-evidence]').textContent = 'No current readiness receipt.';
                    panel.querySelector('[data-pipeline-diagnostics]').textContent = 'Recorded reviews could not be loaded.';
                } finally {
                    pending = false;
                    button.disabled = false;
                }
            };
            button.addEventListener('click', refresh);
            void refresh();
        }
    };
    document.addEventListener('livewire:navigated', start);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
    else start();
})();
