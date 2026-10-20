(() => {
    const form = document.getElementById('preparation-bulk-delete');
    const reports = document.getElementById('live-reports');
    if (!form || !reports) return;
    const all = document.getElementById('preparation-select-all');
    const confirm = document.getElementById('preparation-delete-confirm');
    const button = document.getElementById('preparation-delete-selected');
    const count = document.getElementById('preparation-selected-count');
    const eligible = () => [...reports.querySelectorAll('.preparation-select:not(:disabled)')].filter(input => !input.closest('[hidden]'));
    const update = () => {
        reports.querySelectorAll('[hidden] .preparation-select').forEach(input => { input.checked = false; });
        const choices = eligible(), selected = choices.filter(input => input.checked).length;
        all.disabled = !choices.length;
        all.checked = choices.length > 0 && selected === choices.length;
        all.indeterminate = selected > 0 && selected < choices.length;
        count.textContent = `${selected} selected`;
        button.disabled = !selected || !confirm.checked;
        button.textContent = selected ? `Delete ${selected} selected report${selected === 1 ? '' : 's'}` : 'Delete selected reports';
    };
    reports.addEventListener('change', event => { if (event.target.matches('.preparation-select')) update(); });
    all.addEventListener('change', () => { eligible().forEach(input => { input.checked = all.checked; }); update(); });
    confirm.addEventListener('change', update);
    document.getElementById('preparation-clear-selection').addEventListener('click', () => { eligible().forEach(input => { input.checked = false; }); confirm.checked = false; update(); });
    reports.addEventListener('reports:refreshed', update);
    reports.addEventListener('collection:filtered', update);
    form.addEventListener('submit', event => {
        if (!eligible().some(input => input.checked) || !confirm.checked) { event.preventDefault(); update(); return; }
        button.disabled = true; button.textContent = 'Deleting selected reports...';
    });
    update();
})();
