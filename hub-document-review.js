(() => {
  const $ = selector => document.querySelector(selector);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
  const formatBytes = value => {
    const bytes = Math.max(0, Number(value) || 0);
    if (bytes < 1024) return `${Math.round(bytes)} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  const fieldDefinitions = [
    { key: 'campground', label: 'Campground', type: 'text', group: 'Bill details' },
    { key: 'site_number', label: 'Site number', type: 'text', group: 'Bill details', automatic: true },
    { key: 'bill_date', label: 'Bill date', type: 'date', group: 'Bill details' },
    { key: 'previous_meter_reading', label: 'Previous meter', type: 'number', step: 'any', group: 'Readings', automatic: true },
    { key: 'current_meter_reading', label: 'Current meter', type: 'number', step: 'any', group: 'Readings' },
    { key: 'electricity_usage', label: 'Usage (kWh)', type: 'number', step: 'any', group: 'Readings', automatic: true },
    { key: 'rate', label: 'Rate / kWh', type: 'number', step: '0.001', group: 'Amounts' },
    { key: 'amount_due', label: 'Amount due', type: 'number', step: '0.01', group: 'Amounts' },
    { key: 'payment_date', label: 'Handwritten paid date', type: 'date', group: 'Payment notes' },
    { key: 'check_number', label: 'Handwritten check number', type: 'text', group: 'Payment notes' },
    { key: 'amount_paid', label: 'Handwritten amount paid', type: 'number', step: '0.01', group: 'Payment notes' }
  ];
  let active = null;
  let activeFileIndex = 0;

  function statusLabel(value) {
    return ({
      not_requested: 'Not read yet',
      queued: 'Waiting',
      processing: 'Reading document',
      review: 'Needs your review',
      complete: 'Reviewed',
      failed: 'Needs attention'
    })[value] || 'Saved';
  }

  function currentData() {
    const defaults = active?.defaultFields || {};
    const corrections = active?.record?.documentUserCorrections || {};
    const extracted = active?.record?.documentExtractedData || {};
    const keepValues = values => Object.fromEntries(
      Object.entries(values || {}).filter(([, value]) => value !== null && value !== undefined && value !== '')
    );
    const data = {
      ...defaults,
      ...keepValues(extracted.fields || extracted || {}),
      ...keepValues(corrections.fields || corrections || {})
    };
    const previous = Number(data.previous_meter_reading);
    const current = Number(data.current_meter_reading);
    if (Number.isFinite(previous) && Number.isFinite(current) && current >= previous) {
      data.electricity_usage = current - previous;
    }
    return data;
  }

  function currentConfidence() {
    const extracted = active?.record?.documentExtractedData || {};
    return extracted.field_confidence || extracted.confidence_by_field || {};
  }

  function renderFileRail() {
    const files = active?.record?.documentFiles || [];
    const host = $('#hubDocumentFileRail');
    if (!host) return;
    host.innerHTML = files.map((file, index) => {
      const isPdf = file.mimeType === 'application/pdf' || /\.pdf$/i.test(file.originalFilename || '');
      return `<button type="button" class="hub-document-file-tab${index === activeFileIndex ? ' active' : ''}" data-hub-document-file="${index}" aria-label="Open ${isPdf ? 'PDF' : `page ${index + 1}`}">
        ${isPdf
          ? '<span class="hub-document-file-pdf">PDF</span>'
          : `<img src="${escapeHtml(file.url)}" alt="" loading="lazy">`}
        <span>${isPdf ? escapeHtml(file.originalFilename || 'PDF document') : `Page ${index + 1}`}</span>
      </button>`;
    }).join('');
    host.querySelectorAll('[data-hub-document-file]').forEach(button => {
      button.onclick = () => {
        activeFileIndex = Number(button.dataset.hubDocumentFile) || 0;
        renderPreview();
        renderFileRail();
      };
    });
  }

  function renderPreview() {
    const files = active?.record?.documentFiles || [];
    const file = files[activeFileIndex] || files[0];
    const host = $('#hubDocumentPreview');
    if (!host) return;
    if (!file?.url) {
      host.innerHTML = '<div class="hub-document-preview-empty">This file is temporarily unavailable.</div>';
      return;
    }
    const isPdf = file.mimeType === 'application/pdf' || /\.pdf$/i.test(file.originalFilename || '');
    host.innerHTML = isPdf
      ? `<iframe src="${escapeHtml(file.url)}" title="${escapeHtml(file.originalFilename || 'Document PDF')}"></iframe>`
      : `<img src="${escapeHtml(file.url)}" alt="${escapeHtml(`Document page ${activeFileIndex + 1}`)}">`;
    const meta = $('#hubDocumentFileMeta');
    if (meta) meta.textContent = `${file.originalFilename || (isPdf ? 'PDF document' : `Page ${activeFileIndex + 1}`)}${file.fileSizeBytes ? ` · ${formatBytes(file.fileSizeBytes)}` : ''}`;
  }

  function renderReview() {
    const record = active?.record;
    const panel = $('#hubDocumentAiPanel');
    if (!record || !panel) return;
    const aiStatus = record.documentAiStatus || 'not_requested';
    const hasResults = ['review', 'complete'].includes(aiStatus) && Object.keys(currentData()).length > 0;
    const reviewFields = new Set(record.documentReviewFields || []);
    const confidence = currentConfidence();
    const status = $('#hubDocumentAiStatus');
    if (status) {
      status.className = `hub-document-status hub-document-status-${escapeHtml(aiStatus)}`;
      status.textContent = statusLabel(aiStatus);
    }
    const analyze = $('#hubDocumentAnalyze');
    if (analyze) {
      analyze.textContent = hasResults ? 'Read bill again' : 'Read this bill';
      analyze.hidden = window.ADVENTURE_HUB_CLOUD?.role === 'viewer';
    }
    const form = $('#hubDocumentReviewForm');
    const intro = $('#hubDocumentAiIntro');
    if (!hasResults) {
      form.hidden = true;
      form.innerHTML = '';
      intro.textContent = aiStatus === 'failed'
        ? 'The last reading attempt did not finish. Your saved document was not changed.'
        : 'AI can suggest the printed bill values. You will review every field before anything is added to the electric record.';
      return;
    }
    intro.textContent = 'Check the suggested values below. Fields marked “Check this” were uncertain or need your attention.';
    const data = currentData();
    const grouped = fieldDefinitions.reduce((groups, field) => {
      (groups[field.group] ||= []).push(field);
      return groups;
    }, {});
    form.innerHTML = Object.entries(grouped).map(([group, fields]) => `<fieldset>
      <legend>${escapeHtml(group)}</legend>
      <div class="hub-document-review-grid">
        ${fields.map(field => {
          const needsReview = !field.automatic && (reviewFields.has(field.key) || (confidence[field.key] != null && Number(confidence[field.key]) < .78));
          const value = data[field.key] ?? '';
          return `<label class="${needsReview ? 'needs-review' : ''}">
            <span>${escapeHtml(field.label)}${field.automatic ? '<small>Automatic</small>' : needsReview ? '<small>Check this</small>' : ''}</span>
            <input data-document-review-field="${escapeHtml(field.key)}" type="${field.type}" ${field.step ? `step="${field.step}"` : ''} value="${escapeHtml(value)}" ${field.automatic ? 'readonly' : ''}>
          </label>`;
        }).join('')}
      </div>
    </fieldset>`).join('') + `<div class="hub-document-review-actions">
      <button class="primary" id="hubDocumentUseValues" type="button">Use these values in the bill</button>
      <p>Nothing changes until the bill is saved.</p>
    </div>`;
    form.hidden = false;
    $('#hubDocumentUseValues').onclick = () => {
      const fields = {};
      form.querySelectorAll('[data-document-review-field]').forEach(input => {
        const key = input.dataset.documentReviewField;
        fields[key] = input.value === '' ? null : (input.type === 'number' ? Number(input.value) : input.value);
      });
      active?.onUse?.({
        fields,
        extractedText: record.documentExtractedText || '',
        model: record.documentExtractedData?.model || ''
      });
      $('#hubDocumentDialog').close();
    };
  }

  async function analyze() {
    const record = active?.record;
    const button = $('#hubDocumentAnalyze');
    const message = $('#hubDocumentAiMessage');
    if (!record?.documentId || !window.ADVENTURE_HUB_STORE?.extractHubDocument) {
      message.textContent = 'Save the document first, then try again.';
      return;
    }
    if (!window.confirm('Read this bill with AI?\n\nThis makes one small paid OpenAI request. The suggested values will not be saved until you review and approve them.')) return;
    button.disabled = true;
    button.textContent = 'Reading bill…';
    message.textContent = 'Securely reading the saved document. This can take a few moments.';
    try {
      const result = await window.ADVENTURE_HUB_STORE.extractHubDocument(record.documentId);
      Object.assign(record, result.document || {});
      message.textContent = 'The suggestions are ready. Please check them before using them.';
      renderReview();
      active?.onExtracted?.(record);
    } catch (error) {
      console.error(error);
      const text = String(error?.message || error || '');
      message.textContent = /not found|404/i.test(text)
        ? 'The secure reader still needs its one-time Supabase setup. Your document is saved and unchanged.'
        : /OPENAI_API_KEY|configuration|secret/i.test(text)
          ? 'The secure OpenAI key still needs to be added in Supabase. Your document is saved and unchanged.'
          : `The bill could not be read: ${text || 'Please try again.'}`;
      record.documentAiStatus = 'failed';
      renderReview();
    } finally {
      button.disabled = false;
    }
  }

  function open(options = {}) {
    const files = options.record?.documentFiles || [];
    if (!files.length) return;
    active = options;
    activeFileIndex = 0;
    $('#hubDocumentTitle').textContent = options.record.documentTitle || 'Saved document';
    $('#hubDocumentMeta').textContent = `${files.length} ${files.length === 1 ? 'file' : 'files'}${options.record.date ? ` · ${new Date(`${options.record.date}T12:00:00`).toLocaleDateString()}` : ''}`;
    $('#hubDocumentAiMessage').textContent = '';
    renderPreview();
    renderFileRail();
    renderReview();
    $('#hubDocumentDialog').showModal();
  }

  $('#hubDocumentAnalyze')?.addEventListener('click', analyze);
  window.HIGGINS_DOCUMENT_REVIEW = { open };
})();
