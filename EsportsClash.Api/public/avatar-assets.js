(() => {
    const boot = () => {
        const editor = document.querySelector('.asset-workspace');
        if (!editor || editor.dataset.bound) return;
        editor.dataset.bound = 'true';
        const promptForm = editor.querySelector('[data-prompt-form]');
        const saveStatus = editor.querySelector('[data-prompt-save-status]');
        let dirty = false;
        const markDirty = () => { dirty = true; saveStatus.textContent = 'Unsaved prompt changes'; };
        if (promptForm.hasAttribute('data-imported-brief')) markDirty();
        promptForm.addEventListener('input', markDirty);
        promptForm.addEventListener('submit', () => { dirty = false; });
        window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });

        const tabs = [...editor.querySelectorAll('[data-prompt-tab]')];
        function selectTab(key) {
            tabs.forEach(tab => { const selected = tab.dataset.promptTab === key; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1; });
            editor.querySelectorAll('[data-prompt-panel]').forEach(panel => { panel.hidden = panel.dataset.promptPanel !== key; });
        }
        tabs.forEach((tab, index) => {
            tab.addEventListener('click', () => selectTab(tab.dataset.promptTab));
            tab.addEventListener('keydown', event => {
                let next;
                if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
                if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
                if (event.key === 'Home') next = 0;
                if (event.key === 'End') next = tabs.length - 1;
                if (next === undefined) return;
                event.preventDefault(); selectTab(tabs[next].dataset.promptTab); tabs[next].focus();
            });
        });
        selectTab('body');
        // A validation error can be in an inactive prompt tab.
        promptForm.addEventListener('invalid', event => {
            const key = event.target.name;
            editor.querySelector('#asset-prompts').open = true;
            if (tabs.some(tab => tab.dataset.promptTab === key)) selectTab(key);
        }, true);
        editor.querySelectorAll('[data-copy-prompt]').forEach(button => button.addEventListener('click', async () => {
            const key = button.dataset.copyPrompt;
            const field = document.getElementById(`prompt-${key}`);
            const feedback = editor.querySelector(`[data-prompt-feedback="${key}"]`);
            try { await navigator.clipboard.writeText(field.value); feedback.textContent = 'Copied to clipboard'; }
            catch { field.focus(); field.select(); feedback.textContent = 'Clipboard unavailable. Press Ctrl+C or Command+C to copy.'; }
        }));
        editor.querySelectorAll('[data-reset-prompt]').forEach(button => button.addEventListener('click', () => {
            const key = button.dataset.resetPrompt;
            const field = document.getElementById(`prompt-${key}`);
            field.value = field.dataset.default;
            markDirty();
            editor.querySelector(`[data-prompt-feedback="${key}"]`).textContent = 'Suggested prompt restored. Save to keep it.';
        }));
        editor.querySelectorAll('[data-prompt-slot]').forEach(select => select.addEventListener('change', () => {
            const field = document.getElementById(`prompt-${select.dataset.promptSlot}`);
            const wasSuggested = field.value === field.dataset.default;
            field.dataset.default = field.dataset.default.replace(/Create a single isolated .*? reference image/, `Create a single isolated ${(select.value || 'equipment').replaceAll('_', ' ')} reference image`);
            if (wasSuggested) field.value = field.dataset.default;
        }));
        const objectUrls = new Map();
        editor.querySelectorAll('input[type=file]').forEach(input => input.addEventListener('change', () => {
            input.setCustomValidity('');
            const file = input.files[0], form = input.closest('form');
            const feedback = form.querySelector('.file-feedback');
            const slot = form.dataset.assetUpload;
            const preview = editor.querySelector(`[data-preview="${slot}"]`);
            if (!preview.dataset.original) preview.dataset.original = preview.innerHTML;
            if (objectUrls.has(slot)) { URL.revokeObjectURL(objectUrls.get(slot)); objectUrls.delete(slot); }
            preview.innerHTML = preview.dataset.original;
            if (!file) { feedback.textContent = 'No replacement file selected.'; return; }
            const max = Number(input.dataset.maxMib);
            const extension = file.name.split('.').pop().toLowerCase();
            if (file.size > max * 1024 * 1024) input.setCustomValidity(`Choose a file up to ${max} MiB.`);
            else if (!(slot === 'body' ? ['png'] : ['png','glb','gltf']).includes(extension)) input.setCustomValidity('Choose a supported file format.');
            feedback.textContent = input.validationMessage || `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MiB · Not uploaded yet`;
            if (!input.validity.valid) { input.reportValidity(); return; }
            if (extension === 'png') {
                const url = URL.createObjectURL(file); objectUrls.set(slot, url);
                const image = document.createElement('img'); image.src = url; image.alt = 'Selected file preview, not uploaded yet';
                preview.replaceChildren(image);
            } else {
                const placeholder = document.createElement('div'); placeholder.className = 'asset-placeholder';
                const label = document.createElement('strong'); label.textContent = file.name;
                const note = document.createElement('p'); note.textContent = '3D file selected · Not uploaded yet';
                placeholder.append(label, note); preview.replaceChildren(placeholder);
            }
        }));
        document.querySelectorAll('[data-confirm]').forEach(form => form.addEventListener('submit', event => {
            if (!confirm(form.dataset.confirm)) event.preventDefault();
        }));
        editor.querySelectorAll('[data-asset-upload]').forEach(form => form.addEventListener('submit', event => {
            if (event.defaultPrevented) return;
            if (form.dataset.assetUpload === 'body') form.querySelector('input[name=prompt]').value = document.getElementById('prompt-body').value;
            const button = form.querySelector('button[type=submit]');
            if (form.dataset.submitting) { event.preventDefault(); return; }
            form.dataset.submitting = 'true'; button.disabled = true; button.textContent = 'Saving…';
        }));
        window.addEventListener('pagehide', () => objectUrls.forEach(url => URL.revokeObjectURL(url)));
        const promptLink = editor.querySelector('a[href="#asset-prompts"]');
        promptLink.addEventListener('click', () => { editor.querySelector('#asset-prompts').open = true; });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
