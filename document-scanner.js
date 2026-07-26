(() => {
  const MAX_DOCUMENT_DIMENSION = 2400;
  const DOCUMENT_QUALITY = .86;
  const MAX_INPUT_BYTES = 25 * 1024 * 1024;
  const SUPPORTED_IMAGE_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]);

  const state = {
    file: null,
    processedFile: null,
    previewUrl: '',
    processedUrl: '',
    kind: '',
    rotation: 0,
    cleanup: null,
    onUse: null,
    allowPdfUse: false,
    busy: false
  };

  const $ = selector => document.querySelector(selector);
  const clamp = value => Math.max(0, Math.min(255, value));
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const bytes = value => {
    const amount = Number(value) || 0;
    if (amount < 1024) return `${amount} B`;
    if (amount < 1024 ** 2) return `${(amount / 1024).toFixed(1)} KB`;
    return `${(amount / 1024 ** 2).toFixed(2)} MB`;
  };

  function revokeUrls() {
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    if (state.processedUrl) URL.revokeObjectURL(state.processedUrl);
    state.previewUrl = '';
    state.processedUrl = '';
  }

  function reset() {
    revokeUrls();
    Object.assign(state, {
      file: null,
      processedFile: null,
      kind: '',
      rotation: 0,
      cleanup: null,
      busy: false
    });
    const camera = $('#scannerCameraInput');
    const picker = $('#scannerFileInput');
    if (camera) camera.value = '';
    if (picker) picker.value = '';
    render();
  }

  function setStatus(message, tone = '') {
    const status = $('#scannerStatus');
    if (!status) return;
    status.textContent = message;
    status.dataset.tone = tone;
  }

  function render() {
    const empty = $('#scannerEmpty');
    const preview = $('#scannerPreview');
    const image = $('#scannerPreviewImage');
    const pdf = $('#scannerPreviewPdf');
    const meta = $('#scannerFileMeta');
    const process = $('#scannerProcess');
    const rotateLeft = $('#scannerRotateLeft');
    const rotateRight = $('#scannerRotateRight');
    const remove = $('#scannerRemove');
    const use = $('#scannerUse');
    if (!empty || !preview) return;

    const hasFile = Boolean(state.file);
    empty.hidden = hasFile;
    preview.hidden = !hasFile;
    remove.hidden = !hasFile;
    process.hidden = state.kind !== 'image';
    rotateLeft.hidden = state.kind !== 'image';
    rotateRight.hidden = state.kind !== 'image';
    process.disabled = state.busy || !hasFile;
    rotateLeft.disabled = state.busy || !hasFile;
    rotateRight.disabled = state.busy || !hasFile;
    use.disabled = state.busy || !state.processedFile || (state.kind === 'pdf' && !state.allowPdfUse);

    if (!hasFile) {
      image.hidden = true;
      pdf.hidden = true;
      image.removeAttribute('src');
      pdf.removeAttribute('src');
      meta.innerHTML = '';
      setStatus('Choose a camera photo, an existing image, or a PDF to begin.');
      return;
    }

    const url = state.processedUrl || state.previewUrl;
    image.hidden = state.kind !== 'image';
    pdf.hidden = state.kind !== 'pdf';
    if (state.kind === 'image') image.src = url;
    if (state.kind === 'pdf') pdf.src = url;

    const details = [
      `<b>${escapeText(state.file.name || 'Document')}</b>`,
      `${bytes((state.processedFile || state.file).size)} · ${escapeText((state.processedFile || state.file).type || 'Unknown file type')}`
    ];
    if (state.cleanup) {
      details.push(
        `${state.cleanup.cropped ? 'Paper edges detected and squared' : 'Full image retained'} · ${state.cleanup.width} × ${state.cleanup.height}`
      );
    }
    meta.innerHTML = details.map(line => `<span>${line}</span>`).join('');
  }

  function escapeText(value) {
    return String(value || '').replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[character]));
  }

  async function inspectPdf(file) {
    const buffer = await file.arrayBuffer();
    const slice = buffer.slice(0, Math.min(buffer.byteLength, 8 * 1024 * 1024));
    const source = new TextDecoder('latin1').decode(slice);
    return /\/ToUnicode|\/Font\b|BT[\s\S]{0,3000}(?:Tj|TJ)\b/.test(source);
  }

  async function selectFile(file) {
    if (!file) return;
    if (file.size > MAX_INPUT_BYTES) {
      alert('That file is larger than 25 MB. Please choose a smaller document for this first scanner version.');
      return;
    }
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
    const isImage = SUPPORTED_IMAGE_TYPES.has(file.type) || file.type.startsWith('image/');
    if (!isPdf && !isImage) {
      alert('This version supports document images and PDF files. Other document types will be added later.');
      return;
    }

    revokeUrls();
    state.file = file;
    state.processedFile = isPdf ? file : null;
    state.previewUrl = URL.createObjectURL(file);
    state.kind = isPdf ? 'pdf' : 'image';
    state.rotation = 0;
    state.cleanup = null;
    render();

    if (isPdf) {
      setStatus('Checking whether this PDF already contains selectable text…');
      try {
        const hasText = await inspectPdf(file);
        setStatus(
          hasText
            ? 'This PDF appears to contain selectable text, so it will be preserved as-is.'
            : 'This PDF appears to be image-based. It is being previewed as-is; OCR comes in a later stage.',
          hasText ? 'success' : ''
        );
      } catch {
        setStatus('The PDF is being previewed as-is. Text inspection was inconclusive.');
      }
      render();
    } else {
      setStatus('Original image loaded. Review it, then choose Clean up scan.');
    }
  }

  async function loadBitmap(file) {
    if ('createImageBitmap' in window) {
      try {
        return await createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch {}
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = url;
    });
    URL.revokeObjectURL(url);
    return image;
  }

  function rotatedCanvas(bitmap, rotation) {
    const sourceWidth = bitmap.width || bitmap.naturalWidth;
    const sourceHeight = bitmap.height || bitmap.naturalHeight;
    const scale = Math.min(1, MAX_DOCUMENT_DIMENSION / Math.max(sourceWidth, sourceHeight));
    const drawWidth = Math.max(1, Math.round(sourceWidth * scale));
    const drawHeight = Math.max(1, Math.round(sourceHeight * scale));
    const sideways = Math.abs(rotation % 180) === 90;
    const canvas = document.createElement('canvas');
    canvas.width = sideways ? drawHeight : drawWidth;
    canvas.height = sideways ? drawWidth : drawHeight;
    const context = canvas.getContext('2d', { alpha: false });
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate(rotation * Math.PI / 180);
    context.drawImage(bitmap, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    return canvas;
  }

  function otsuThreshold(histogram, total) {
    let sum = 0;
    for (let index = 0; index < 256; index += 1) sum += index * histogram[index];
    let backgroundWeight = 0;
    let backgroundSum = 0;
    let bestVariance = -1;
    let threshold = 180;
    for (let index = 0; index < 256; index += 1) {
      backgroundWeight += histogram[index];
      if (!backgroundWeight) continue;
      const foregroundWeight = total - backgroundWeight;
      if (!foregroundWeight) break;
      backgroundSum += index * histogram[index];
      const backgroundMean = backgroundSum / backgroundWeight;
      const foregroundMean = (sum - backgroundSum) / foregroundWeight;
      const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;
      if (variance > bestVariance) {
        bestVariance = variance;
        threshold = index;
      }
    }
    return threshold;
  }

  function polygonArea(points) {
    return Math.abs(points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0) / 2);
  }

  function estimatePaperCorners(sourceCanvas) {
    const scale = Math.min(1, 900 / Math.max(sourceCanvas.width, sourceCanvas.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceCanvas.width * scale));
    canvas.height = Math.max(1, Math.round(sourceCanvas.height * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const histogram = new Uint32Array(256);
    const gray = new Uint8Array(canvas.width * canvas.height);
    for (let pixel = 0, offset = 0; pixel < gray.length; pixel += 1, offset += 4) {
      const value = Math.round(data[offset] * .299 + data[offset + 1] * .587 + data[offset + 2] * .114);
      gray[pixel] = value;
      histogram[value] += 1;
    }
    const threshold = Math.max(145, otsuThreshold(histogram, gray.length));
    const corners = {
      tl: { score: Infinity, x: 0, y: 0 },
      tr: { score: -Infinity, x: canvas.width - 1, y: 0 },
      br: { score: -Infinity, x: canvas.width - 1, y: canvas.height - 1 },
      bl: { score: Infinity, x: 0, y: canvas.height - 1 }
    };
    let candidates = 0;
    for (let y = 0; y < canvas.height; y += 2) {
      for (let x = 0; x < canvas.width; x += 2) {
        if (gray[y * canvas.width + x] < threshold) continue;
        candidates += 1;
        const sum = x + y;
        const difference = x - y;
        if (sum < corners.tl.score) corners.tl = { score: sum, x, y };
        if (difference > corners.tr.score) corners.tr = { score: difference, x, y };
        if (sum > corners.br.score) corners.br = { score: sum, x, y };
        if (difference < corners.bl.score) corners.bl = { score: difference, x, y };
      }
    }
    const sampledPixels = Math.ceil(canvas.width / 2) * Math.ceil(canvas.height / 2);
    const candidateRatio = candidates / sampledPixels;
    const points = [corners.tl, corners.tr, corners.br, corners.bl];
    const areaRatio = polygonArea(points) / (canvas.width * canvas.height);
    const shortestEdge = Math.min(
      distance(points[0], points[1]),
      distance(points[1], points[2]),
      distance(points[2], points[3]),
      distance(points[3], points[0])
    );
    const plausible = candidateRatio > .08
      && candidateRatio < .93
      && areaRatio > .2
      && areaRatio < .96
      && shortestEdge > Math.min(canvas.width, canvas.height) * .28;
    if (!plausible) return null;
    const confidence = Math.min(.95, .52 + areaRatio * .25 + Math.min(.18, shortestEdge / Math.max(canvas.width, canvas.height) * .25));
    if (confidence < .62) return null;
    const inverse = 1 / scale;
    return {
      points: points.map(point => ({ x: point.x * inverse, y: point.y * inverse })),
      confidence
    };
  }

  function scaledCanvas(sourceCanvas) {
    const scale = Math.min(1, MAX_DOCUMENT_DIMENSION / Math.max(sourceCanvas.width, sourceCanvas.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceCanvas.width * scale));
    canvas.height = Math.max(1, Math.round(sourceCanvas.height * scale));
    const context = canvas.getContext('2d', { alpha: false });
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function squareDocument(sourceCanvas, points) {
    const [topLeft, topRight, bottomRight, bottomLeft] = points;
    const naturalWidth = Math.max(distance(topLeft, topRight), distance(bottomLeft, bottomRight));
    const naturalHeight = Math.max(distance(topLeft, bottomLeft), distance(topRight, bottomRight));
    const scale = Math.min(1, MAX_DOCUMENT_DIMENSION / Math.max(naturalWidth, naturalHeight));
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));
    const source = sourceCanvas.getContext('2d', { willReadFrequently: true })
      .getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const output = new ImageData(width, height);
    const sourceData = source.data;
    const outputData = output.data;
    for (let y = 0; y < height; y += 1) {
      const v = height === 1 ? 0 : y / (height - 1);
      const leftX = topLeft.x + (bottomLeft.x - topLeft.x) * v;
      const leftY = topLeft.y + (bottomLeft.y - topLeft.y) * v;
      const rightX = topRight.x + (bottomRight.x - topRight.x) * v;
      const rightY = topRight.y + (bottomRight.y - topRight.y) * v;
      for (let x = 0; x < width; x += 1) {
        const u = width === 1 ? 0 : x / (width - 1);
        const sourceX = Math.max(0, Math.min(sourceCanvas.width - 1, Math.round(leftX + (rightX - leftX) * u)));
        const sourceY = Math.max(0, Math.min(sourceCanvas.height - 1, Math.round(leftY + (rightY - leftY) * u)));
        const sourceOffset = (sourceY * sourceCanvas.width + sourceX) * 4;
        const outputOffset = (y * width + x) * 4;
        outputData[outputOffset] = sourceData[sourceOffset];
        outputData[outputOffset + 1] = sourceData[sourceOffset + 1];
        outputData[outputOffset + 2] = sourceData[sourceOffset + 2];
        outputData[outputOffset + 3] = 255;
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').putImageData(output, 0, 0);
    return canvas;
  }

  function enhanceReadability(canvas) {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = image.data;
    const histogram = new Uint32Array(256);
    for (let offset = 0; offset < data.length; offset += 16) {
      const luminance = Math.round(data[offset] * .299 + data[offset + 1] * .587 + data[offset + 2] * .114);
      histogram[luminance] += 1;
    }
    const sampleCount = data.length / 16;
    const percentile = ratio => {
      const target = sampleCount * ratio;
      let total = 0;
      for (let index = 0; index < 256; index += 1) {
        total += histogram[index];
        if (total >= target) return index;
      }
      return ratio < .5 ? 0 : 255;
    };
    const low = percentile(.015);
    const high = Math.max(low + 35, percentile(.985));
    for (let offset = 0; offset < data.length; offset += 4) {
      const luminance = data[offset] * .299 + data[offset + 1] * .587 + data[offset + 2] * .114;
      const stretched = clamp((luminance - low) * 255 / (high - low));
      const target = luminance * .55 + stretched * .45;
      const factor = luminance > 1 ? target / luminance : 1;
      data[offset] = clamp(data[offset] * factor);
      data[offset + 1] = clamp(data[offset + 1] * factor);
      data[offset + 2] = clamp(data[offset + 2] * factor);
    }
    context.putImageData(image, 0, 0);
    return canvas;
  }

  function canvasBlob(canvas, quality) {
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  }

  async function processImage() {
    if (!state.file || state.kind !== 'image' || state.busy) return;
    state.busy = true;
    render();
    setStatus('Cleaning up the document locally on this device…');
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    try {
      const bitmap = await loadBitmap(state.file);
      const sourceCanvas = rotatedCanvas(bitmap, state.rotation);
      if (typeof bitmap.close === 'function') bitmap.close();
      const autoCleanup = $('#scannerAutoCleanup')?.checked !== false;
      const paper = autoCleanup ? estimatePaperCorners(sourceCanvas) : null;
      let output = paper ? squareDocument(sourceCanvas, paper.points) : scaledCanvas(sourceCanvas);
      output = enhanceReadability(output);
      let blob = await canvasBlob(output, DOCUMENT_QUALITY);
      if (!blob) throw new Error('The cleaned image could not be created.');
      if (blob.size > 4.5 * 1024 * 1024) {
        blob = await canvasBlob(output, .8) || blob;
      }
      const baseName = String(state.file.name || 'document').replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-');
      const file = new File([blob], `higgins-scan-${baseName || 'document'}.jpg`, {
        type: 'image/jpeg',
        lastModified: Date.now()
      });
      try {
        Object.defineProperty(file, 'higginsDocumentScan', { value: true });
      } catch {}
      if (state.processedUrl) URL.revokeObjectURL(state.processedUrl);
      state.processedFile = file;
      state.processedUrl = URL.createObjectURL(file);
      state.cleanup = {
        cropped: Boolean(paper),
        confidence: paper?.confidence || 0,
        width: output.width,
        height: output.height,
        originalBytes: state.file.size,
        optimizedBytes: file.size
      };
      setStatus(
        paper
          ? `Cleanup complete. Paper edges were detected and squared locally; file size is ${bytes(file.size)}.`
          : `Cleanup complete. The full image was retained because a safe paper boundary was not certain; file size is ${bytes(file.size)}.`,
        'success'
      );
    } catch (error) {
      console.error(error);
      state.processedFile = null;
      state.cleanup = null;
      setStatus(`This image could not be cleaned automatically. ${error.message}`, 'error');
    } finally {
      state.busy = false;
      render();
    }
  }

  async function rotate(amount) {
    if (!state.file || state.kind !== 'image' || state.busy) return;
    state.rotation = (state.rotation + amount + 360) % 360;
    await processImage();
  }

  function useDocument() {
    if (!state.processedFile || state.busy) return;
    if (state.kind === 'pdf' && !state.allowPdfUse) {
      setStatus('PDF cloud saving begins in the next shared-document stage. This version safely previews it without changing the database.');
      return;
    }
    const accepted = state.onUse?.({
      file: state.processedFile,
      originalFile: state.file,
      kind: state.kind,
      metadata: state.cleanup || {
        preservedOriginal: state.kind === 'pdf',
        bytes: state.processedFile.size
      }
    });
    if (accepted === false) return;
    $('#documentScannerDialog')?.close();
  }

  function bind() {
    const dialog = $('#documentScannerDialog');
    if (!dialog || dialog.dataset.bound === 'true') return;
    dialog.dataset.bound = 'true';
    $('#scannerCameraInput')?.addEventListener('change', event => selectFile(event.target.files?.[0]));
    $('#scannerFileInput')?.addEventListener('change', event => selectFile(event.target.files?.[0]));
    $('#scannerProcess')?.addEventListener('click', processImage);
    $('#scannerRotateLeft')?.addEventListener('click', () => rotate(-90));
    $('#scannerRotateRight')?.addEventListener('click', () => rotate(90));
    $('#scannerRemove')?.addEventListener('click', reset);
    $('#scannerUse')?.addEventListener('click', useDocument);
    dialog.querySelectorAll('[data-close-scanner]').forEach(button => button.addEventListener('click', () => dialog.close()));
    dialog.addEventListener('close', () => {
      state.onUse = null;
      reset();
    });
  }

  function open(options = {}) {
    bind();
    reset();
    state.onUse = typeof options.onUse === 'function' ? options.onUse : null;
    state.allowPdfUse = Boolean(options.allowPdfUse);
    const context = $('#scannerContext');
    if (context) context.textContent = options.title || 'Electric bill document';
    const use = $('#scannerUse');
    if (use) use.textContent = options.useLabel || 'Use this scan';
    $('#documentScannerDialog')?.showModal();
  }

  window.HIGGINS_DOCUMENT_SCANNER = { open };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
