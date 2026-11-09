(() => {
  const form = document.querySelector('[data-catalog-editor]');
  if (!form) return;
  let dirty = false, preview;
  const status = form.querySelector('[data-save-status]');
  form.addEventListener('input', () => { dirty = true; status.textContent = 'Unsaved changes. Select Save changes to update the catalog.'; });
  form.addEventListener('submit', () => { dirty = false; });
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  form.querySelector('[data-image-input]').addEventListener('change', event => {
    if (preview) URL.revokeObjectURL(preview);
    form.querySelector('[data-upload-preview]')?.remove();
    const file = event.target.files[0], info = form.querySelector('[data-image-status]');
    if (!file) { info.textContent = ''; return; }
    if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
      info.textContent = 'Choose a PNG, JPEG or WebP image up to 4 MB.'; event.target.value = ''; return;
    }
    preview = URL.createObjectURL(file);
    const image = document.createElement('img'); image.src = preview; image.alt = 'New image preview';
    image.className = 'catalog-image'; image.dataset.uploadPreview = 'true';
    form.querySelector('.catalog-upload').prepend(image); info.textContent = 'Preview only. Save to upload this image.';
  });
  document.querySelector('[data-catalog-delete]')?.addEventListener('submit', event => {
    if (dirty || !window.confirm('Delete this entry for new matches? You can restore it later.')) {
      event.preventDefault(); if (dirty) status.textContent = 'Save or reload your changes before deleting.';
    }
  });
})();
