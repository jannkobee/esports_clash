(() => {
    const editor = document.querySelector('[data-content-editor]');
    if (!editor) return;
    editor.dataset.ready = 'true';
    // The server retains rejected input. A stale-version error must stay blocked
    // until the owner compares it with the latest saved revision.
    let dirty = Boolean(document.querySelector('.notice.error'));
    editor.addEventListener('input', () => {
        dirty = true;
        const status = document.querySelector('[data-save-status]');
        if (status) { status.textContent = 'Unsaved changes - select Save draft to keep your work.'; status.setAttribute('role','status'); }
    });
    let saving = false;
    editor.addEventListener('submit', event => {
        if (saving) { event.preventDefault(); return; }
        saving = true;
        dirty = false;
        const button = editor.querySelector('button[type=submit]');
        if (button) { button.disabled = true; button.textContent = 'Saving draft...'; }
    });
    window.addEventListener('beforeunload', event => {
        if (!dirty) return;
        event.preventDefault(); event.returnValue = '';
    });
    document.querySelectorAll('[data-saved-action]').forEach(element => {
        element.addEventListener(element.tagName === 'FORM' ? 'submit' : 'click', event => {
            if (!dirty) return;
            event.preventDefault();
            const status = document.querySelector('[data-save-status]');
            if (status) { status.textContent = 'Save your changes first. Review and export use the saved version.'; status.setAttribute('role','alert'); status.scrollIntoView({block:'center',behavior:'smooth'}); }
        });
    });
})();
