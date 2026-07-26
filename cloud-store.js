(() => {
  const uuid = () => crypto.randomUUID();
  const num = value => value == null ? null : Number(value);
  const time = value => value ? String(value).slice(0, 5) : '';
  const assert = result => {
    if (result.error) throw result.error;
    return result.data || [];
  };

  function createStore(cloud) {
    const { client, householdId, role } = cloud;
    let known = {};
    let syncing = Promise.resolve();
    const photoBucket = client.storage.from('stay-photos');
    const tripPhotoBucket = client.storage.from('trip-photos');
    const notePhotoBucket = client.storage.from('note-photos');
    const receiptBucket = client.storage.from('record-receipts');
    const hubDocumentBucket = client.storage.from('hub-documents');
    let storageUsageCache = null;
    const photoMaxDimension = 1400;
    const photoQuality = .78;

    async function signedPhotoUrl(bucket, path) {
      if (!path) return '';
      const result = await bucket.createSignedUrl(path, 60 * 60 * 24 * 7);
      if (result.error) {
        console.warn('A photo could not be displayed.', result.error);
        return '';
      }
      return result.data?.signedUrl || '';
    }

    async function hydrateStayPhotoUrls(stays) {
      await Promise.all(stays.flatMap(stay => [
        stay.sitePhotoPath ? signedPhotoUrl(photoBucket, stay.sitePhotoPath).then(url => { stay.sitePhotoUrl = url; }) : null,
        stay.signPhotoPath ? signedPhotoUrl(photoBucket, stay.signPhotoPath).then(url => { stay.signPhotoUrl = url; }) : null
      ].filter(Boolean)));
      return stays;
    }

    async function hydrateTripPhotoUrls(trips) {
      await Promise.all(trips.map(trip =>
        trip.onRoadPhotoPath
          ? signedPhotoUrl(tripPhotoBucket, trip.onRoadPhotoPath).then(url => { trip.onRoadPhotoUrl = url; })
          : null
      ).filter(Boolean));
      return trips;
    }

    async function hydrateNotePhotoUrls(notes) {
      await Promise.all(notes.map(async note => {
        note.photoUrls = await Promise.all((note.photoPaths || []).map(path => signedPhotoUrl(notePhotoBucket, path)));
      }));
      return notes;
    }

    async function hydrateReceiptUrls(records) {
      await Promise.all(records.map(record =>
        record.receiptPhotoPath
          ? signedPhotoUrl(receiptBucket, record.receiptPhotoPath).then(url => { record.receiptPhotoUrl = url; })
          : null
      ).filter(Boolean));
      return records;
    }

    async function hydrateMultiReceiptUrls(records) {
      await Promise.all(records.map(async record => {
        record.receiptPhotoUrls = await Promise.all(
          (record.receiptPhotoPaths || []).map(path => signedPhotoUrl(receiptBucket, path))
        );
      }));
      return records;
    }

    async function preparePhoto(file) {
      const fallback = () => {
        if (file.size > 12 * 1024 * 1024) {
          throw new Error('That photo is too large. Please choose a photo under 12 MB.');
        }
        const extension = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        return { blob: file, extension, contentType: file.type || 'image/jpeg' };
      };
      try {
        const url = URL.createObjectURL(file);
        const image = new Image();
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = reject;
          image.src = url;
        });
        URL.revokeObjectURL(url);
        const scale = Math.min(1, photoMaxDimension / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(image, 0, 0, width, height);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', photoQuality));
        if (!blob) return fallback();
        return { blob, extension: 'jpg', contentType: 'image/jpeg' };
      } catch {
        return fallback();
      }
    }

    async function listStorageFiles() {
      const bucketNames = ['stay-photos', 'trip-photos', 'note-photos', 'record-receipts', 'hub-documents'];
      const files = [];

      for (const bucketName of bucketNames) {
        const bucket = client.storage.from(bucketName);
        const folders = [householdId];
        const visited = new Set();
        while (folders.length) {
          const folder = folders.shift();
          if (!folder || visited.has(folder)) continue;
          visited.add(folder);
          const result = await bucket.list(folder, {
            limit: 1000,
            sortBy: { column: 'name', order: 'asc' }
          });
          if (result.error) throw result.error;
          for (const entry of result.data || []) {
            const path = `${folder}/${entry.name}`;
            if (entry.id || entry.metadata) {
              files.push({
                bucketName,
                path,
                name: entry.name,
                bytes: Number(entry.metadata?.size) || 0,
                contentType: entry.metadata?.mimetype || entry.metadata?.contentType || ''
              });
            } else {
              folders.push(path);
            }
          }
        }
      }

      return files;
    }

    async function getStorageUsage(force = false) {
      const cacheAge = storageUsageCache ? Date.now() - storageUsageCache.checkedAt : Infinity;
      if (!force && cacheAge < 5 * 60 * 1000) return storageUsageCache;
      const storedFiles = await listStorageFiles();
      storageUsageCache = {
        bytes: storedFiles.reduce((sum, file) => sum + file.bytes, 0),
        files: storedFiles.length,
        checkedAt: Date.now()
      };
      return storageUsageCache;
    }

    async function optimizeStoredPhotos(onProgress = () => {}) {
      if (role === 'viewer') throw new Error('Family Viewer accounts cannot optimize pictures.');
      const files = await listStorageFiles();
      const beforeBytes = files.reduce((sum, file) => sum + file.bytes, 0);
      let optimized = 0;
      let skipped = 0;
      let failed = 0;
      let savedBytes = 0;

      for (let index = 0; index < files.length; index += 1) {
        const storedFile = files[index];
        onProgress({
          current: index + 1,
          total: files.length,
          optimized,
          skipped,
          failed,
          name: storedFile.name
        });
        try {
          const bucket = client.storage.from(storedFile.bucketName);
          const download = await bucket.download(storedFile.path);
          if (download.error) throw download.error;
          const original = download.data;
          const contentType = original.type || storedFile.contentType || 'image/jpeg';
          if (!contentType.startsWith('image/')) {
            skipped += 1;
            continue;
          }
          const source = typeof File === 'function'
            ? new File([original], storedFile.name, { type: contentType })
            : original;
          if (!source.name) {
            try { Object.defineProperty(source, 'name', { value: storedFile.name }); } catch {}
          }
          const prepared = await preparePhoto(source);
          if (prepared.contentType !== 'image/jpeg' || prepared.blob.size >= original.size * .98) {
            skipped += 1;
            continue;
          }
          const update = await bucket.update(storedFile.path, prepared.blob, {
            cacheControl: '3600',
            contentType: prepared.contentType,
            upsert: true
          });
          if (update.error) throw update.error;
          optimized += 1;
          savedBytes += original.size - prepared.blob.size;
        } catch (error) {
          failed += 1;
          console.warn(`The stored picture ${storedFile.path} could not be optimized.`, error);
        }
      }

      storageUsageCache = null;
      const usage = await getStorageUsage(true);
      return {
        total: files.length,
        optimized,
        skipped,
        failed,
        beforeBytes,
        afterBytes: usage.bytes,
        savedBytes: Math.max(savedBytes, beforeBytes - usage.bytes)
      };
    }

    async function setStayPhoto(stay, kind, file) {
      if (role === 'viewer') throw new Error('Family Viewer accounts cannot change photos.');
      if (!stay?._cloudId) throw new Error('Save this stay before adding its photos.');
      const sitePhoto = kind === 'site';
      const pathKey = sitePhoto ? 'sitePhotoPath' : 'signPhotoPath';
      const urlKey = sitePhoto ? 'sitePhotoUrl' : 'signPhotoUrl';
      const column = sitePhoto ? 'site_photo_path' : 'sign_photo_path';
      const oldPath = stay[pathKey] || '';

      if (!file) {
        const update = await client.from('campground_stays').update({ [column]: null }).eq('id', stay._cloudId);
        if (update.error) throw update.error;
        if (oldPath) {
          const removed = await photoBucket.remove([oldPath]);
          if (removed.error) console.warn('The old stay photo could not be removed.', removed.error);
        }
        stay[pathKey] = '';
        stay[urlKey] = '';
        return stay;
      }

      const prepared = await preparePhoto(file);
      const path = `${householdId}/${stay._cloudId}/${kind}-${Date.now()}.${prepared.extension}`;
      const upload = await photoBucket.upload(path, prepared.blob, {
        cacheControl: '3600',
        contentType: prepared.contentType,
        upsert: false
      });
      if (upload.error) throw upload.error;

      const update = await client.from('campground_stays').update({ [column]: path }).eq('id', stay._cloudId);
      if (update.error) {
        await photoBucket.remove([path]);
        throw update.error;
      }
      if (oldPath && oldPath !== path) {
        const removed = await photoBucket.remove([oldPath]);
        if (removed.error) console.warn('The replaced stay photo could not be removed.', removed.error);
      }
      stay[pathKey] = path;
      stay[urlKey] = await signedPhotoUrl(photoBucket, path);
      return stay;
    }

    async function setTripPhoto(trip, file) {
      if (role === 'viewer') throw new Error('Family Viewer accounts cannot change photos.');
      if (!trip?._cloudId) throw new Error('Save this trip before adding its photo.');
      const oldPath = trip.onRoadPhotoPath || '';

      if (!file) {
        const update = await client.from('trips').update({ on_road_photo_path: null }).eq('id', trip._cloudId);
        if (update.error) throw update.error;
        if (oldPath) {
          const removed = await tripPhotoBucket.remove([oldPath]);
          if (removed.error) console.warn('The old trip photo could not be removed.', removed.error);
        }
        trip.onRoadPhotoPath = '';
        trip.onRoadPhotoUrl = '';
        return trip;
      }

      const prepared = await preparePhoto(file);
      const path = `${householdId}/${trip._cloudId}/on-road-${Date.now()}.${prepared.extension}`;
      const upload = await tripPhotoBucket.upload(path, prepared.blob, {
        cacheControl: '3600',
        contentType: prepared.contentType,
        upsert: false
      });
      if (upload.error) throw upload.error;

      const update = await client.from('trips').update({ on_road_photo_path: path }).eq('id', trip._cloudId);
      if (update.error) {
        await tripPhotoBucket.remove([path]);
        throw update.error;
      }
      if (oldPath && oldPath !== path) {
        const removed = await tripPhotoBucket.remove([oldPath]);
        if (removed.error) console.warn('The replaced trip photo could not be removed.', removed.error);
      }
      trip.onRoadPhotoPath = path;
      trip.onRoadPhotoUrl = await signedPhotoUrl(tripPhotoBucket, path);
      return trip;
    }

    async function setNotePhotos(note, { addFiles = [], removePaths = [] } = {}) {
      if (role === 'viewer') throw new Error('Family Viewer accounts cannot change note pictures.');
      if (!note?._cloudId) throw new Error('Save this note before adding pictures.');
      const removeSet = new Set(removePaths);
      const existingPaths = (note.photoPaths || []).filter(path => !removeSet.has(path));
      const existingUrls = (note.photoUrls || []).filter((_, index) => !removeSet.has((note.photoPaths || [])[index]));
      const allowedFiles = addFiles.slice(0, Math.max(0, 6 - existingPaths.length));
      const uploaded = [];

      try {
        for (const file of allowedFiles) {
          const prepared = await preparePhoto(file);
          const path = `${householdId}/${note._cloudId}/note-${Date.now()}-${uuid()}.${prepared.extension}`;
          const upload = await notePhotoBucket.upload(path, prepared.blob, {
            cacheControl: '3600',
            contentType: prepared.contentType,
            upsert: false
          });
          if (upload.error) throw upload.error;
          uploaded.push({
            path,
            url: await signedPhotoUrl(notePhotoBucket, path)
          });
        }

        const nextPaths = [...existingPaths, ...uploaded.map(photo => photo.path)];
        const update = await client.from('hub_notes').update({ photo_paths: nextPaths }).eq('id', note._cloudId);
        if (update.error) throw update.error;

        if (removePaths.length) {
          const removed = await notePhotoBucket.remove(removePaths);
          if (removed.error) console.warn('Some removed note pictures could not be deleted.', removed.error);
        }
        note.photoPaths = nextPaths;
        note.photoUrls = [...existingUrls, ...uploaded.map(photo => photo.url)];
        return note;
      } catch (error) {
        if (uploaded.length) await notePhotoBucket.remove(uploaded.map(photo => photo.path));
        throw error;
      }
    }

    async function deleteNotePhotos(note) {
      if (role === 'viewer') throw new Error('Family Viewer accounts cannot delete note pictures.');
      const paths = note?.photoPaths || [];
      if (!paths.length) return;
      const removed = await notePhotoBucket.remove(paths);
      if (removed.error) throw removed.error;
      note.photoPaths = [];
      note.photoUrls = [];
    }

    async function setRecordReceipt(record, recordKind, file) {
      if (role === 'viewer') throw new Error('Family Viewer accounts cannot change receipts.');
      if (!record?._cloudId) throw new Error('Save this record before adding its receipt.');
      const recordTypes = {
        fuel: { table: 'trip_fuel', folder: 'fuel' },
        maintenance: { table: 'maintenance', folder: 'maintenance' },
        'seasonal-payment': { table: 'seasonal_payments', folder: 'seasonal-payment' },
        electric: { table: 'electric_bills', folder: 'electric' }
      };
      const target = recordTypes[recordKind];
      if (!target) throw new Error('That receipt type is not supported.');
      const oldPath = record.receiptPhotoPath || '';

      if (!file) {
        const update = await client.from(target.table).update({ receipt_photo_path: null }).eq('id', record._cloudId);
        if (update.error) throw update.error;
        if (oldPath) {
          const removed = await receiptBucket.remove([oldPath]);
          if (removed.error) console.warn('The old receipt could not be removed.', removed.error);
        }
        record.receiptPhotoPath = '';
        record.receiptPhotoUrl = '';
        return record;
      }

      const prepared = file?.higginsDocumentScan
        ? { blob: file, extension: 'jpg', contentType: 'image/jpeg' }
        : await preparePhoto(file);
      const path = `${householdId}/${target.folder}/${record._cloudId}/receipt-${Date.now()}.${prepared.extension}`;
      const upload = await receiptBucket.upload(path, prepared.blob, {
        cacheControl: '3600',
        contentType: prepared.contentType,
        upsert: false
      });
      if (upload.error) throw upload.error;

      const update = await client.from(target.table).update({ receipt_photo_path: path }).eq('id', record._cloudId);
      if (update.error) {
        await receiptBucket.remove([path]);
        throw update.error;
      }
      if (oldPath && oldPath !== path) {
        const removed = await receiptBucket.remove([oldPath]);
        if (removed.error) console.warn('The replaced receipt could not be removed.', removed.error);
      }
      record.receiptPhotoPath = path;
      record.receiptPhotoUrl = await signedPhotoUrl(receiptBucket, path);
      return record;
    }

    async function detachLinkedDocuments(record, recordType, linkRole) {
      const linked = assert(await client
        .from('hub_document_links')
        .select('id, document_id')
        .eq('source_app', 'travel-journal')
        .eq('record_type', recordType)
        .eq('record_id', String(record._cloudId))
        .eq('link_role', linkRole));
      if (!linked.length) return;

      const documentIds = [...new Set(linked.map(link => link.document_id))];
      assert(await client.from('hub_document_links').delete().in('id', linked.map(link => link.id)));

      for (const documentId of documentIds) {
        const remainingLinks = assert(await client
          .from('hub_document_links')
          .select('id')
          .eq('document_id', documentId)
          .limit(1));
        if (remainingLinks.length) continue;

        const files = assert(await client
          .from('hub_document_files')
          .select('storage_bucket, storage_path')
          .eq('document_id', documentId));
        assert(await client.from('hub_documents').delete().eq('id', documentId));
        for (const [bucketName, paths] of Object.entries(files.reduce((groups, storedFile) => {
          if (!storedFile.storage_path) return groups;
          const name = storedFile.storage_bucket || 'hub-documents';
          (groups[name] ||= []).push(storedFile.storage_path);
          return groups;
        }, {}))) {
          const removed = await client.storage.from(bucketName).remove(paths);
          if (removed.error) console.warn('An unlinked document file could not be removed.', removed.error);
        }
      }
    }

    async function setElectricBillDocument(record, file) {
      if (role === 'viewer') throw new Error('Family Viewer accounts cannot change electric bills.');
      if (!record?._cloudId) throw new Error('Save this electric bill before adding its scan.');
      const oldLegacyPath = record.receiptPhotoPath || '';

      if (!file) {
        await detachLinkedDocuments(record, 'electric_bill', 'bill_scan');
        const update = await client.from('electric_bills').update({ receipt_photo_path: null }).eq('id', record._cloudId);
        if (update.error) throw update.error;
        if (oldLegacyPath && !(record.documentFiles || []).some(storedFile =>
          storedFile.storageBucket === 'record-receipts' && storedFile.storagePath === oldLegacyPath
        )) {
          const removed = await receiptBucket.remove([oldLegacyPath]);
          if (removed.error) console.warn('The old electric-bill image could not be removed.', removed.error);
        }
        record.documentId = '';
        record.documentTitle = '';
        record.documentStatus = '';
        record.documentFiles = [];
        record.receiptPhotoPath = '';
        record.receiptPhotoUrl = '';
        return record;
      }

      const prepared = file?.higginsDocumentScan
        ? { blob: file, extension: 'jpg', contentType: 'image/jpeg' }
        : await preparePhoto(file);
      const userResult = await client.auth.getUser();
      if (userResult.error) throw userResult.error;
      const userId = userResult.data?.user?.id;
      if (!userId) throw new Error('Please sign in again before saving this document.');

      const documentId = uuid();
      const fileId = uuid();
      const titleDate = record.date
        ? new Date(`${record.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Undated';
      const displayTitle = `Lehigh Gorge electric bill · ${titleDate}`;
      const originalFilename = file.name || `electric-bill-${record.date || Date.now()}.${prepared.extension}`;
      const storagePath = `${householdId}/${documentId}/${fileId}.${prepared.extension}`;
      let uploaded = false;
      let documentCreated = false;

      try {
        const documentInsert = await client.from('hub_documents').insert({
          id: documentId,
          household_id: householdId,
          display_title: displayTitle,
          document_type: 'electric_bill',
          document_date: record.date || null,
          source_app: 'travel-journal',
          processing_status: 'approved',
          ai_processing_status: 'not_requested',
          retention_status: 'keep',
          created_by: userId,
          uploaded_at: new Date().toISOString()
        });
        if (documentInsert.error) throw documentInsert.error;
        documentCreated = true;

        const upload = await hubDocumentBucket.upload(storagePath, prepared.blob, {
          cacheControl: '3600',
          contentType: prepared.contentType,
          upsert: false
        });
        if (upload.error) throw upload.error;
        uploaded = true;

        const dimensions = file?.higginsDocumentScan || {};
        const fileInsert = await client.from('hub_document_files').insert({
          id: fileId,
          document_id: documentId,
          page_number: 1,
          original_filename: originalFilename,
          mime_type: prepared.contentType,
          file_size_bytes: Number(prepared.blob.size) || 0,
          storage_bucket: 'hub-documents',
          storage_path: storagePath,
          width: Number(dimensions.width) || null,
          height: Number(dimensions.height) || null,
          cleanup_metadata: file?.higginsDocumentScan
            ? { cleaned_locally: true, scanner_version: '0.40.0' }
            : { optimized_locally: true }
        });
        if (fileInsert.error) throw fileInsert.error;

        const linkInsert = await client.from('hub_document_links').insert({
          document_id: documentId,
          source_app: 'travel-journal',
          record_type: 'electric_bill',
          record_id: String(record._cloudId),
          link_role: 'bill_scan',
          is_primary: true,
          created_by: userId
        });
        if (linkInsert.error) throw linkInsert.error;

        const update = await client.from('electric_bills').update({ receipt_photo_path: null }).eq('id', record._cloudId);
        if (update.error) throw update.error;

        const priorDocumentIds = new Set((record.documentFiles || []).map(storedFile => storedFile.documentId).filter(Boolean));
        if (record.documentId) priorDocumentIds.add(record.documentId);
        assert(await client.from('hub_document_links')
          .delete()
          .eq('source_app', 'travel-journal')
          .eq('record_type', 'electric_bill')
          .eq('record_id', String(record._cloudId))
          .eq('link_role', 'bill_scan')
          .neq('document_id', documentId));
        for (const priorDocumentId of priorDocumentIds) {
          const remainingLinks = assert(await client.from('hub_document_links').select('id').eq('document_id', priorDocumentId).limit(1));
          if (remainingLinks.length) continue;
          const priorFiles = assert(await client.from('hub_document_files').select('storage_bucket, storage_path').eq('document_id', priorDocumentId));
          assert(await client.from('hub_documents').delete().eq('id', priorDocumentId));
          for (const [bucketName, paths] of Object.entries(priorFiles.reduce((groups, storedFile) => {
            if (!storedFile.storage_path) return groups;
            (groups[storedFile.storage_bucket || 'hub-documents'] ||= []).push(storedFile.storage_path);
            return groups;
          }, {}))) {
            const removed = await client.storage.from(bucketName).remove(paths);
            if (removed.error) console.warn('A replaced document file could not be removed.', removed.error);
          }
        }
        if (oldLegacyPath && !priorDocumentIds.size) {
          const removed = await receiptBucket.remove([oldLegacyPath]);
          if (removed.error) console.warn('The replaced legacy bill image could not be removed.', removed.error);
        }

        const url = await signedPhotoUrl(hubDocumentBucket, storagePath);
        record.documentId = documentId;
        record.documentTitle = displayTitle;
        record.documentStatus = 'approved';
        record.documentFiles = [{
          id: fileId,
          documentId,
          pageNumber: 1,
          originalFilename,
          mimeType: prepared.contentType,
          fileSizeBytes: Number(prepared.blob.size) || 0,
          storageBucket: 'hub-documents',
          storagePath,
          url
        }];
        record.receiptPhotoPath = '';
        record.receiptPhotoUrl = url;
        return record;
      } catch (error) {
        if (uploaded) await hubDocumentBucket.remove([storagePath]);
        if (documentCreated) await client.from('hub_documents').delete().eq('id', documentId);
        throw error;
      }
    }

    async function setTripPlanPdfDocument(record, file) {
      if (role === 'viewer') throw new Error('Family Viewer accounts cannot change reservation documents.');
      if (!record?._cloudId) throw new Error('Save this activity before adding its PDF.');

      if (!file) {
        await detachLinkedDocuments(record, 'trip_plan', 'supporting_document');
        record.documentAttachments = [];
        return record;
      }

      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
      if (!isPdf) throw new Error('Please choose a PDF file.');
      if (file.size > 25 * 1024 * 1024) throw new Error('That PDF is larger than the 25 MB document limit.');

      const userResult = await client.auth.getUser();
      if (userResult.error) throw userResult.error;
      const userId = userResult.data?.user?.id;
      if (!userId) throw new Error('Please sign in again before saving this document.');

      const documentId = uuid();
      const fileId = uuid();
      const displayTitle = `${record.title || 'Trip activity'} · confirmation PDF`;
      const originalFilename = file.name || `trip-activity-${record._cloudId}.pdf`;
      const storagePath = `${householdId}/${documentId}/${fileId}.pdf`;
      let uploaded = false;
      let documentCreated = false;

      try {
        const documentInsert = await client.from('hub_documents').insert({
          id: documentId,
          household_id: householdId,
          display_title: displayTitle,
          document_type: 'trip_activity_document',
          document_date: record.date || null,
          source_app: 'travel-journal',
          processing_status: 'approved',
          ai_processing_status: 'not_requested',
          retention_status: 'keep',
          created_by: userId,
          uploaded_at: new Date().toISOString()
        });
        if (documentInsert.error) throw documentInsert.error;
        documentCreated = true;

        const upload = await hubDocumentBucket.upload(storagePath, file, {
          cacheControl: '3600',
          contentType: 'application/pdf',
          upsert: false
        });
        if (upload.error) throw upload.error;
        uploaded = true;

        const fileInsert = await client.from('hub_document_files').insert({
          id: fileId,
          document_id: documentId,
          page_number: 1,
          original_filename: originalFilename,
          mime_type: 'application/pdf',
          file_size_bytes: Number(file.size) || 0,
          storage_bucket: 'hub-documents',
          storage_path: storagePath,
          cleanup_metadata: { preserved_as_pdf: true }
        });
        if (fileInsert.error) throw fileInsert.error;

        const linkInsert = await client.from('hub_document_links').insert({
          document_id: documentId,
          source_app: 'travel-journal',
          record_type: 'trip_plan',
          record_id: String(record._cloudId),
          link_role: 'supporting_document',
          is_primary: true,
          created_by: userId
        });
        if (linkInsert.error) throw linkInsert.error;

        const previousAttachments = [...(record.documentAttachments || [])];
        assert(await client.from('hub_document_links')
          .delete()
          .eq('source_app', 'travel-journal')
          .eq('record_type', 'trip_plan')
          .eq('record_id', String(record._cloudId))
          .eq('link_role', 'supporting_document')
          .neq('document_id', documentId));

        for (const attachment of previousAttachments) {
          if (!attachment.documentId || attachment.documentId === documentId) continue;
          const remainingLinks = assert(await client.from('hub_document_links').select('id').eq('document_id', attachment.documentId).limit(1));
          if (remainingLinks.length) continue;
          const priorFiles = assert(await client.from('hub_document_files').select('storage_bucket, storage_path').eq('document_id', attachment.documentId));
          assert(await client.from('hub_documents').delete().eq('id', attachment.documentId));
          for (const [bucketName, paths] of Object.entries(priorFiles.reduce((groups, storedFile) => {
            if (!storedFile.storage_path) return groups;
            (groups[storedFile.storage_bucket || 'hub-documents'] ||= []).push(storedFile.storage_path);
            return groups;
          }, {}))) {
            const removed = await client.storage.from(bucketName).remove(paths);
            if (removed.error) console.warn('A replaced reservation document could not be removed.', removed.error);
          }
        }

        const url = await signedPhotoUrl(hubDocumentBucket, storagePath);
        record.documentAttachments = [{
          documentId,
          documentTitle: displayTitle,
          documentStatus: 'approved',
          fileId,
          pageNumber: 1,
          originalFilename,
          mimeType: 'application/pdf',
          fileSizeBytes: Number(file.size) || 0,
          storageBucket: 'hub-documents',
          storagePath,
          url
        }];
        return record;
      } catch (error) {
        if (uploaded) await hubDocumentBucket.remove([storagePath]);
        if (documentCreated) await client.from('hub_documents').delete().eq('id', documentId);
        throw error;
      }
    }

    async function deleteRecordReceipt(record) {
      if (role === 'viewer') throw new Error('Family Viewer accounts cannot delete receipts.');
      const paths = [
        ...(record?.receiptPhotoPath ? [record.receiptPhotoPath] : []),
        ...(record?.receiptPhotoPaths || [])
      ];
      if (!paths.length) return;
      const removed = await receiptBucket.remove(paths);
      if (removed.error) throw removed.error;
      record.receiptPhotoPath = '';
      record.receiptPhotoUrl = '';
      record.receiptPhotoPaths = [];
      record.receiptPhotoUrls = [];
    }

    async function setMultiRecordReceipts(record, recordKind, { addFiles = [], removePaths = [] } = {}) {
      if (role === 'viewer') throw new Error('Family Viewer accounts cannot change receipts.');
      if (!record?._cloudId) throw new Error('Save this record before adding receipts.');
      const recordTypes = {
        maintenance: { table: 'maintenance', folder: 'maintenance' },
        'seasonal-payment': { table: 'seasonal_payments', folder: 'seasonal-payment' },
        'trip-plan': { table: 'trip_plans', folder: 'trip-plan' }
      };
      const target = recordTypes[recordKind];
      if (!target) throw new Error('That receipt type is not supported.');
      const removeSet = new Set(removePaths);
      const existingPaths = (record.receiptPhotoPaths || []).filter(path => !removeSet.has(path));
      const existingUrls = (record.receiptPhotoUrls || []).filter((_, index) => !removeSet.has((record.receiptPhotoPaths || [])[index]));
      const allowedFiles = addFiles.slice(0, Math.max(0, 6 - existingPaths.length));
      const uploaded = [];

      try {
        for (const file of allowedFiles) {
          const prepared = await preparePhoto(file);
          const path = `${householdId}/${target.folder}/${record._cloudId}/receipt-${Date.now()}-${uuid()}.${prepared.extension}`;
          const upload = await receiptBucket.upload(path, prepared.blob, {
            cacheControl: '3600',
            contentType: prepared.contentType,
            upsert: false
          });
          if (upload.error) throw upload.error;
          uploaded.push({ path, url: await signedPhotoUrl(receiptBucket, path) });
        }

        const nextPaths = [...existingPaths, ...uploaded.map(photo => photo.path)];
        const update = await client.from(target.table).update({ receipt_photo_paths: nextPaths }).eq('id', record._cloudId);
        if (update.error) throw update.error;

        if (removePaths.length) {
          const removed = await receiptBucket.remove(removePaths);
          if (removed.error) console.warn('Some removed receipts could not be deleted.', removed.error);
        }
        record.receiptPhotoPaths = nextPaths;
        record.receiptPhotoUrls = [...existingUrls, ...uploaded.map(photo => photo.url)];
        return record;
      } catch (error) {
        if (uploaded.length) await receiptBucket.remove(uploaded.map(photo => photo.path));
        throw error;
      }
    }

    async function load() {
      if (role === 'viewer') {
        const [rows, planRows] = (await Promise.all([
          client.rpc('get_family_itinerary_v4'),
          client.rpc('get_family_trip_plans')
        ])).map(assert);
        const trips = new Map();
        const stays = [];
        rows.forEach(row => {
          if (!trips.has(row.trip_id)) {
            trips.set(row.trip_id, {
              _cloudId: row.trip_id,
              year: Number(String(row.start_date).slice(0, 4)),
              name: row.trip_name,
              destination: row.destination_name,
              startDate: row.start_date,
              endDate: row.end_date,
              status: 'planned',
              notes: '',
              distance: null,
              gallons: 0,
              cost: 0,
              mpg: null,
              onRoadPhotoPath: row.on_road_photo_path || '',
              onRoadPhotoUrl: ''
            });
          }
          if (row.campground_name) {
            stays.push({
              _tripId: row.trip_id,
              year: Number(String(row.arrival_date).slice(0, 4)),
              arrival: row.arrival_date,
              departure: row.checkout_date,
              checkInTime: time(row.check_in_time),
              checkOutTime: time(row.check_out_time),
              nights: row.checkout_date ? Math.round((new Date(row.checkout_date) - new Date(row.arrival_date)) / 86400000) : null,
              name: row.campground_name,
              address: row.address || '',
              city: row.city || '',
              state: row.state || '',
              zip: row.postal_code || '',
              site: row.site_number || '',
              price: 0,
              stayType: row.stay_type === 'harvest_host' ? 'harvest-host' : (row.stay_type || 'campground'),
              harvestHost: row.stay_type === 'harvest_host' || row.stay_type === 'harvest-host',
              moochdocking: row.stay_type === 'moochdocking',
              boondocking: row.stay_type === 'boondocking',
              sitePhotoPath: row.site_photo_path || '',
              signPhotoPath: row.sign_photo_path || '',
              sitePhotoUrl: '',
              signPhotoUrl: '',
              notes: ''
            });
          }
        });
        const tripSummaries = [...trips.values()];
        const tripPlans = planRows.map(row => ({
          _cloudId: row.plan_id,
          _tripId: row.trip_id,
          title: row.title,
          planType: row.plan_type || 'activity',
          status: row.status || 'planned',
          date: row.plan_date,
          startTime: time(row.start_time),
          endTime: time(row.end_time),
          locationName: row.location_name || '',
          address: row.address || '',
          city: row.city || '',
          state: row.state || '',
          zip: row.postal_code || '',
          confirmationCode: '',
          cost: 0,
          websiteUrl: '',
          receiptPhotoPaths: [],
          receiptPhotoUrls: [],
          notes: '',
          viewerSafe: true
        }));
        await Promise.all([hydrateStayPhotoUrls(stays), hydrateTripPhotoUrls(tripSummaries)]);
        return {
          tripSummaries,
          stays,
          tripPlans,
          fuel: [],
          siteFees: [],
          electric: [],
          phillisMaintenance: [],
          phillisUpgrades: [],
          rubyMaintenance: [],
          rubyUpgrades: [],
          sharedNotes: [],
          vehicleDetails: [],
          meta: { cloud: true, viewer: true }
        };
      }
      const results = await Promise.all([
        client.from('trips').select('*').eq('household_id', householdId),
        client.from('campground_stays').select('*'),
        client.from('trip_fuel').select('*'),
        client.from('vehicles').select('*').eq('household_id', householdId),
        client.from('maintenance').select('*'),
        client.from('seasonal_sites').select('*').eq('household_id', householdId),
        client.from('site_seasons').select('*'),
        client.from('seasonal_payments').select('*'),
        client.from('electric_bills').select('*'),
        client.from('hub_notes').select('*').eq('household_id', householdId),
        client.from('trip_plans').select('*').eq('household_id', householdId),
        client.from('vehicle_private_details').select('vehicle_id, vin, license_plate').eq('household_id', householdId),
        client.from('hub_documents').select('*').eq('household_id', householdId),
        client.from('hub_document_files').select('*'),
        client.from('hub_document_links').select('*').eq('source_app', 'travel-journal')
      ]);
      const [trips, stays, fuel, vehicles, maintenance, sites, seasons, payments, electric, notes, plans, privateVehicleDetails, documents, documentFiles, documentLinks] = results.map(assert);
      known = {
        trips: new Set(trips.map(x => x.id)),
        campground_stays: new Set(stays.map(x => x.id)),
        trip_fuel: new Set(fuel.map(x => x.id)),
        maintenance: new Set(maintenance.map(x => x.id)),
        site_seasons: new Set(seasons.map(x => x.id)),
        seasonal_payments: new Set(payments.map(x => x.id)),
        electric_bills: new Set(electric.map(x => x.id)),
        hub_notes: new Set(notes.map(x => x.id)),
        trip_plans: new Set(plans.map(x => x.id))
      };

      const tripById = new Map(trips.map(x => [x.id, x]));
      const vehicleById = new Map(vehicles.map(x => [x.id, x]));
      const privateVehicleById = new Map(privateVehicleDetails.map(x => [x.vehicle_id, x]));
      const seasonById = new Map(seasons.map(x => [x.id, x]));
      const documentById = new Map(documents.map(x => [x.id, x]));
      const documentFilesById = new Map();
      documentFiles.forEach(file => {
        if (!documentFilesById.has(file.document_id)) documentFilesById.set(file.document_id, []);
        documentFilesById.get(file.document_id).push(file);
      });
      documentFilesById.forEach(files => files.sort((a, b) => Number(a.page_number) - Number(b.page_number)));
      const electricDocumentLinkByRecordId = new Map(
        documentLinks
          .filter(link => link.record_type === 'electric_bill' && link.link_role === 'bill_scan')
          .sort((a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)))
          .map(link => [String(link.record_id), link])
      );
      const planDocumentLinksByRecordId = new Map();
      documentLinks
        .filter(link => link.record_type === 'trip_plan' && link.link_role === 'supporting_document')
        .forEach(link => {
          const key = String(link.record_id);
          if (!planDocumentLinksByRecordId.has(key)) planDocumentLinksByRecordId.set(key, []);
          planDocumentLinksByRecordId.get(key).push(link);
        });
      const site = sites[0] || {};
      const siteLocation = String(site.location || '');
      const siteLocationParts = siteLocation.split(',').map(x => x.trim());
      const siteStateZip = String(siteLocationParts[2] || '').match(/^([A-Z]{2})\s*(.*)$/);
      const fuelByTrip = new Map();
      fuel.forEach(row => {
        if (!fuelByTrip.has(row.trip_id)) fuelByTrip.set(row.trip_id, []);
        fuelByTrip.get(row.trip_id).push(row);
      });

      const tripSummaries = trips.map(row => {
        const rows = fuelByTrip.get(row.id) || [];
        const gallons = rows.reduce((sum, x) => sum + (num(x.gallons) || 0), 0);
        const cost = rows.reduce((sum, x) => sum + (num(x.total_cost) || 0), 0);
        const distance = rows.reduce((sum, x) => sum + (num(x.trip_meter) || 0), 0) || null;
        const towVehicle = vehicleById.get(row.tow_vehicle_id);
        const rv = vehicleById.get(row.rv_id);
        return {
          _cloudId: row.id,
          _towVehicleId: row.tow_vehicle_id || null,
          _rvId: row.rv_id || null,
          year: Number(String(row.start_date).slice(0, 4)),
          name: row.name,
          destination: row.destination_name,
          startDate: row.start_date,
          endDate: row.end_date,
          status: row.status,
          notes: row.notes || '',
          towVehicle: towVehicle?.name || '',
          towFuelType: towVehicle?.fuel_type || '',
          rv: rv?.name || '',
          distance,
          gallons,
          cost,
          mpg: gallons && distance ? distance / gallons : null,
          onRoadPhotoPath: row.on_road_photo_path || '',
          onRoadPhotoUrl: ''
        };
      });
      await hydrateTripPhotoUrls(tripSummaries);

      const tripName = id => tripById.get(id)?.name || '';
      const localStays = stays.map(row => ({
        _cloudId: row.id,
        _tripId: row.trip_id,
        year: Number(String(row.arrival_date).slice(0, 4)),
        arrival: row.arrival_date,
        departure: row.checkout_date,
        checkInTime: time(row.check_in_time),
        checkOutTime: time(row.check_out_time),
        nights: row.checkout_date ? Math.round((new Date(row.checkout_date) - new Date(row.arrival_date)) / 86400000) : null,
        name: row.campground_name,
        address: row.address || '',
        city: row.city || '',
        state: row.state || '',
        zip: row.postal_code || '',
        site: row.site_number || '',
        price: num(row.cost) || 0,
        stayType: row.stay_type === 'harvest_host' ? 'harvest-host' : (row.stay_type || ''),
        harvestHost: row.stay_type === 'harvest_host' || row.stay_type === 'harvest-host',
        moochdocking: row.stay_type === 'moochdocking',
        boondocking: row.stay_type === 'boondocking',
        sitePhotoPath: row.site_photo_path || '',
        signPhotoPath: row.sign_photo_path || '',
        sitePhotoUrl: '',
        signPhotoUrl: '',
        notes: row.notes || ''
      }));
      await hydrateStayPhotoUrls(localStays);

      seasons.forEach(season => {
        localStays.push({
          _cloudId: season.id,
          _seasonId: season.id,
          year: Number(season.year),
          arrival: 'Season',
          departure: 'Season',
          nights: null,
          name: site.name || 'Seasonal site',
          address: siteLocationParts[0] || siteLocation,
          city: siteLocationParts[1] || '',
          state: siteStateZip?.[1] || '',
          zip: siteStateZip?.[2] || '',
          site: site.site_number || '',
          price: num(season.annual_fee) || 0,
          harvestHost: false,
          notes: season.notes || ''
        });
      });

      const maintenanceGroups = {
        phillisMaintenance: [], phillisUpgrades: [],
        rubyMaintenance: [], rubyUpgrades: []
      };
      maintenance.forEach(row => {
        const vehicle = vehicleById.get(row.vehicle_id);
        const prefix = vehicle?.vehicle_type === 'truck' ? 'ruby' : 'phillis';
        const suffix = row.record_type === 'upgrade' ? 'Upgrades' : 'Maintenance';
        maintenanceGroups[prefix + suffix].push({
          _cloudId: row.id,
          _vehicleId: row.vehicle_id,
          trailer: prefix === 'phillis' ? (vehicle?.name || '') : undefined,
          date: row.date,
          description: row.description,
          location: row.vendor || '',
          price: num(row.cost) || 0,
          receiptPhotoPaths: Array.isArray(row.receipt_photo_paths) ? row.receipt_photo_paths : [],
          receiptPhotoUrls: [],
          notes: row.notes || ''
        });
      });
      await hydrateMultiReceiptUrls(Object.values(maintenanceGroups).flat());

      const siteFees = payments.map(row => ({
        _cloudId: row.id,
        _seasonId: row.season_id,
        year: Number(seasonById.get(row.season_id)?.year),
        date: row.payment_date,
        payment: num(row.amount) || 0,
        check: row.check_number || '',
        receiptPhotoPaths: Array.isArray(row.receipt_photo_paths) ? row.receipt_photo_paths : [],
        receiptPhotoUrls: [],
        notes: row.notes || ''
      }));
      await hydrateMultiReceiptUrls(siteFees);

      const electricRows = [...electric].sort((a, b) => String(a.bill_date).localeCompare(String(b.bill_date)));
      const priorBySeason = new Map();
      const localElectric = electricRows.map(row => {
        const previous = priorBySeason.get(row.season_id) ?? num(row.meter_reading);
        const current = num(row.meter_reading) || 0;
        const documentLink = electricDocumentLinkByRecordId.get(String(row.id));
        const document = documentLink ? documentById.get(documentLink.document_id) : null;
        const linkedFiles = document ? (documentFilesById.get(document.id) || []) : [];
        priorBySeason.set(row.season_id, current);
        return {
          _cloudId: row.id,
          _seasonId: row.season_id,
          documentId: document?.id || '',
          documentTitle: document?.display_title || '',
          documentStatus: document?.processing_status || '',
          documentFiles: linkedFiles.map(file => ({
            id: file.id,
            documentId: file.document_id,
            pageNumber: Number(file.page_number) || 1,
            originalFilename: file.original_filename || '',
            mimeType: file.mime_type || '',
            fileSizeBytes: Number(file.file_size_bytes) || 0,
            storageBucket: file.storage_bucket || 'hub-documents',
            storagePath: file.storage_path || '',
            url: ''
          })),
          date: row.bill_date,
          previous,
          current,
          usage: current - previous,
          unitPrice: num(row.rate) || 0,
          total: num(row.amount) || 0,
          paid: row.payment_date || '',
          check: row.check_number || '',
          receiptPhotoPath: row.receipt_photo_path || '',
          receiptPhotoUrl: '',
          notes: row.notes || ''
        };
      });
      await Promise.all(localElectric.map(async record => {
        if (!record.documentFiles.length) return;
        await Promise.all(record.documentFiles.map(async file => {
          const bucket = file.storageBucket === 'record-receipts' ? receiptBucket :
            file.storageBucket === 'hub-documents' ? hubDocumentBucket :
            client.storage.from(file.storageBucket);
          file.url = await signedPhotoUrl(bucket, file.storagePath);
        }));
        const firstImage = record.documentFiles.find(file => /^image\//i.test(file.mimeType) && file.url);
        record.receiptPhotoUrl = firstImage?.url || '';
      }));
      await hydrateReceiptUrls(localElectric.filter(record => !record.receiptPhotoUrl));

      const localNotes = notes.map(row=>({
        _cloudId:row.id,
        title:row.title,
        body:row.body||'',
        pinned:Boolean(row.is_pinned),
        archived:Boolean(row.is_archived),
        tripId:row.trip_id||null,
        photoPaths:Array.isArray(row.photo_paths)?row.photo_paths:[],
        photoUrls:[],
        createdAt:row.created_at,
        updatedAt:row.updated_at
      }));
      await hydrateNotePhotoUrls(localNotes);

      const localPlans = plans.map(row => {
        const links = planDocumentLinksByRecordId.get(String(row.id)) || [];
        const documentAttachments = links.flatMap(link => {
          const document = documentById.get(link.document_id);
          return (documentFilesById.get(link.document_id) || []).map(file => ({
            documentId: link.document_id,
            documentTitle: document?.display_title || '',
            documentStatus: document?.processing_status || '',
            fileId: file.id,
            pageNumber: Number(file.page_number) || 1,
            originalFilename: file.original_filename || '',
            mimeType: file.mime_type || '',
            fileSizeBytes: Number(file.file_size_bytes) || 0,
            storageBucket: file.storage_bucket || 'hub-documents',
            storagePath: file.storage_path || '',
            url: ''
          }));
        });
        return {
          _cloudId: row.id,
          _tripId: row.trip_id,
          title: row.title,
          planType: row.plan_type || 'activity',
          status: row.status || 'planned',
          date: row.plan_date,
          startTime: time(row.start_time),
          endTime: time(row.end_time),
          locationName: row.location_name || '',
          address: row.address || '',
          city: row.city || '',
          state: row.state || '',
          zip: row.postal_code || '',
          confirmationCode: row.confirmation_code || '',
          cost: num(row.cost) || 0,
          websiteUrl: row.website_url || '',
          receiptPhotoPaths: Array.isArray(row.receipt_photo_paths) ? row.receipt_photo_paths : [],
          receiptPhotoUrls: [],
          documentAttachments,
          notes: row.notes || ''
        };
      });
      await hydrateMultiReceiptUrls(localPlans);
      await Promise.all(localPlans.flatMap(plan => (plan.documentAttachments || []).map(async attachment => {
        const bucket = attachment.storageBucket === 'hub-documents'
          ? hubDocumentBucket
          : client.storage.from(attachment.storageBucket);
        attachment.url = await signedPhotoUrl(bucket, attachment.storagePath);
      })));

      const localFuel = fuel.map(row => {
        const legacyLocation = String(row.location || '').trim();
        const legacyMatch = legacyLocation.match(/^(.*?),\s*([A-Za-z]{2})$/);
        const legacyCity = legacyMatch ? legacyMatch[1].trim() : legacyLocation;
        const legacyState = legacyMatch ? legacyMatch[2].toUpperCase() : '';
        return {
          _cloudId: row.id,
          _tripId: row.trip_id,
          _vehicleId: row.vehicle_id || tripById.get(row.trip_id)?.tow_vehicle_id || null,
          trip: tripName(row.trip_id),
          vehicle: vehicleById.get(row.vehicle_id || tripById.get(row.trip_id)?.tow_vehicle_id)?.name || '',
          date: row.fuel_date,
          station: row.station || '',
          city: row.city || legacyCity,
          state: row.state || legacyState,
          location: [row.city || legacyCity,row.state || legacyState].filter(Boolean).join(', '),
          odometer: num(row.odometer),
          tripMiles: num(row.trip_meter),
          gallons: num(row.gallons) || 0,
          total: num(row.total_cost) || 0,
          price: num(row.gallons) ? num(row.total_cost) / num(row.gallons) : 0,
          fuelType: row.fuel_type || '',
          receiptPhotoPath: row.receipt_photo_path || '',
          receiptPhotoUrl: '',
          notes: row.notes || ''
        };
      });
      await hydrateReceiptUrls(localFuel);

      return {
        tripSummaries,
        stays: localStays,
        fuel: localFuel,
        siteFees,
        electric: localElectric,
        sharedNotes: localNotes,
        tripPlans: localPlans,
        vehicleDetails: vehicles.map(vehicle => ({
          _cloudId: vehicle.id,
          name: vehicle.name,
          licensePlate: privateVehicleById.get(vehicle.id)?.license_plate || '',
          vin: privateVehicleById.get(vehicle.id)?.vin || ''
        })),
        ...maintenanceGroups,
        meta: { cloud: true }
      };
    }

    const removeMissing = async (table, ids) => {
      const missing = [...(known[table] || [])].filter(id => !ids.has(id));
      if (!missing.length) return;
      assert(await client.from(table).delete().in('id', missing));
    };

    async function write(snapshot) {
      const vehicles = assert(await client.from('vehicles').select('*').eq('household_id', householdId));
      const ruby = vehicles.find(x => x.vehicle_type === 'truck' && x.is_active) || vehicles.find(x => x.name === 'Ruby');
      const phillis = vehicles.find(x => x.vehicle_type === 'rv' && x.is_active) || vehicles.find(x => x.name === 'Phillis II.0') || vehicles.find(x => x.name === 'Phillis');
      const originalPhillis = vehicles.find(x => x.name === 'Phillis') || phillis;
      const phillisTwo = vehicles.find(x => x.name === 'Phillis II.0') || phillis;
      const trailerForRecord = record => record.trailer === 'Phillis'
        ? originalPhillis
        : record.trailer === 'Phillis II.0'
          ? phillisTwo
          : Number(String(record.date || '').slice(0, 4)) >= 2026 ? phillisTwo : originalPhillis;
      const siteRows = assert(await client.from('seasonal_sites').select('*').eq('household_id', householdId));
      const seasonalSite = siteRows[0];
      if (!ruby || !phillis || !seasonalSite) throw new Error('Ruby, Phillis, or Lehigh Gorge is missing.');

      snapshot.tripSummaries.forEach(x => { if (!x._cloudId) x._cloudId = uuid(); });
      const tripRows = snapshot.tripSummaries.map(x => ({
        id: x._cloudId, household_id: householdId, name: x.name,
        destination_name: x.destination || x.name, start_date: x.startDate,
        end_date: x.endDate, status: x.status || 'planned', notes: x.notes || null,
        tow_vehicle_id: x._towVehicleId || ruby.id, rv_id: x._rvId || phillis.id,
        on_road_photo_path: x.onRoadPhotoPath || null
      }));
      assert(await client.from('trips').upsert(tripRows));
      const tripFor = (name, date) => snapshot.tripSummaries.find(x =>
        x.name === name && (!date || String(x.startDate).slice(0, 4) === String(date).slice(0, 4))
      ) || snapshot.tripSummaries.find(x => x.name === name);
      const tripForStay = stay => snapshot.tripSummaries.find(x =>
        x.startDate <= stay.departure && x.endDate >= stay.arrival
      );

      const ordinaryStays = snapshot.stays.filter(x => x.arrival !== 'Season');
      ordinaryStays.forEach(x => { if (!x._cloudId) x._cloudId = uuid(); });
      const stayRows = ordinaryStays.map(x => ({
        id: x._cloudId, trip_id: x._tripId || tripForStay(x)?._cloudId,
        campground_name: x.name, arrival_date: x.arrival, checkout_date: x.departure,
        check_in_time: x.checkInTime || null, check_out_time: x.checkOutTime || null,
        site_number: x.site || null, cost: x.price || 0, address: x.address || null,
        city: x.city || null, state: x.state || null, postal_code: x.zip || null,
        stay_type: x.harvestHost || x.stayType === 'harvest-host' || x.stayType === 'harvest_host'
          ? 'harvest_host'
          : x.moochdocking || x.stayType === 'moochdocking'
            ? 'moochdocking'
            : x.boondocking || x.stayType === 'boondocking'
              ? 'boondocking'
              : 'campground',
        site_photo_path: x.sitePhotoPath || null, sign_photo_path: x.signPhotoPath || null,
        notes: x.notes || null
      })).filter(x => x.trip_id);
      if (stayRows.length) assert(await client.from('campground_stays').upsert(stayRows));

      snapshot.fuel.forEach(x => { if (!x._cloudId) x._cloudId = uuid(); });
      const fuelRows = snapshot.fuel.map(x => ({
        id: x._cloudId, household_id: householdId,
        trip_id: x._tripId || tripFor(x.trip, x.date)?._cloudId || null,
        vehicle_id: x._vehicleId || tripFor(x.trip, x.date)?._towVehicleId || ruby.id,
        fuel_date: x.date, station: x.station || null,
        city: x.city || null, state: x.state || null,
        location: [x.city,x.state].filter(Boolean).join(', ') || x.location || null,
        odometer: x.odometer, trip_meter: x.tripMiles, gallons: x.gallons,
        total_cost: x.total, fuel_type: x.fuelType || (Number(String(x.date).slice(0, 4)) >= 2025 ? 'diesel' : 'gasoline'),
        receipt_photo_path: x.receiptPhotoPath || null,
        notes: x.notes || null
      }));
      if (fuelRows.length) assert(await client.from('trip_fuel').upsert(fuelRows));

      const maintSets = [
        ['phillisMaintenance', null, 'maintenance'], ['phillisUpgrades', null, 'upgrade'],
        ['rubyMaintenance', ruby.id, 'maintenance'], ['rubyUpgrades', ruby.id, 'upgrade']
      ];
      const maintRows = maintSets.flatMap(([key, vehicleId, recordType]) => snapshot[key].map(x => {
        const assignedVehicleId=key.startsWith('phillis')?trailerForRecord(x).id:vehicleId;
        return { ...(x._cloudId != null ? { id: x._cloudId } : {}), _local: x,
          vehicle_id: assignedVehicleId, date: x.date, description: x.description,
          cost: x.price || 0, vendor: x.location || null,
          receipt_photo_paths: Array.isArray(x.receiptPhotoPaths) ? x.receiptPhotoPaths : [],
          notes: x.notes || null, record_type: recordType };
      }));
      const existingMaint = maintRows.filter(x => x.id != null).map(({ _local, ...row }) => row);
      if (existingMaint.length) assert(await client.from('maintenance').upsert(existingMaint));
      for (const row of maintRows.filter(x => x.id == null)) {
        const local = row._local;
        const { _local, ...insertRow } = row;
        const inserted = assert(await client.from('maintenance').insert(insertRow).select('id').single());
        local._cloudId = inserted.id;
        row.id = inserted.id;
      }

      const seasonEntries = snapshot.stays.filter(x => x.arrival === 'Season');
      seasonEntries.forEach(x => { if (!x._cloudId) x._cloudId = uuid(); x._seasonId = x._cloudId; });
      const seasonRows = seasonEntries.map(x => ({
        id: x._cloudId, seasonal_site_id: seasonalSite.id, year: x.year,
        annual_fee: x.price || 0, notes: x.notes || null
      }));
      if (seasonRows.length) assert(await client.from('site_seasons').upsert(seasonRows));
      const seasonForYear = year => seasonEntries.find(x => Number(x.year) === Number(year));

      const paymentRows = snapshot.siteFees.map(x => ({
        ...(x._cloudId != null ? { id: x._cloudId } : {}), _local: x,
        season_id: x._seasonId || seasonForYear(x.year)?._cloudId,
        payment_date: x.date, amount: x.payment, check_number: x.check || null,
        receipt_photo_paths: Array.isArray(x.receiptPhotoPaths) ? x.receiptPhotoPaths : [],
        notes: x.notes || null
      })).filter(x => x.season_id);
      const existingPayments = paymentRows.filter(x => x.id != null).map(({ _local, ...row }) => row);
      if (existingPayments.length) assert(await client.from('seasonal_payments').upsert(existingPayments));
      for (const row of paymentRows.filter(x => x.id == null)) {
        const local = row._local;
        const { _local, ...insertRow } = row;
        const inserted = assert(await client.from('seasonal_payments').insert(insertRow).select('id').single());
        local._cloudId = inserted.id;
        row.id = inserted.id;
      }

      snapshot.electric.forEach(x => { if (!x._cloudId) x._cloudId = uuid(); });
      const electricRows = snapshot.electric.map(x => {
        const year = Number(String(x.date).slice(0, 4));
        return {
          id: x._cloudId, season_id: x._seasonId || seasonForYear(year)?._cloudId,
          bill_date: x.date, meter_reading: x.current, amount: x.total,
          rate: x.unitPrice, payment_date: x.paid || null, check_number: x.check || null,
          receipt_photo_path: x.receiptPhotoPath || null,
          notes: x.notes || null
        };
      }).filter(x => x.season_id);
      if (electricRows.length) assert(await client.from('electric_bills').upsert(electricRows));

      snapshot.sharedNotes.forEach(x => { if (!x._cloudId) x._cloudId = uuid(); });
      const noteRows = snapshot.sharedNotes.map(x => ({
        id:x._cloudId,
        household_id:householdId,
        title:x.title,
        body:x.body||null,
        is_pinned:Boolean(x.pinned),
        is_archived:Boolean(x.archived),
        trip_id:x.tripId||null,
        photo_paths:Array.isArray(x.photoPaths)?x.photoPaths:[],
        updated_at:x.updatedAt||x.createdAt||new Date().toISOString()
      }));
      if(noteRows.length)assert(await client.from('hub_notes').upsert(noteRows));

      snapshot.tripPlans.forEach(x => { if (!x._cloudId) x._cloudId = uuid(); });
      const planRows = snapshot.tripPlans.map(x => ({
        id: x._cloudId,
        household_id: householdId,
        trip_id: x._tripId,
        title: x.title,
        plan_type: x.planType || 'activity',
        status: x.status || 'planned',
        plan_date: x.date,
        start_time: x.startTime || null,
        end_time: x.endTime || null,
        location_name: x.locationName || null,
        address: x.address || null,
        city: x.city || null,
        state: x.state || null,
        postal_code: x.zip || null,
        confirmation_code: x.confirmationCode || null,
        cost: x.cost || 0,
        website_url: x.websiteUrl || null,
        receipt_photo_paths: Array.isArray(x.receiptPhotoPaths) ? x.receiptPhotoPaths : [],
        notes: x.notes || null,
        updated_at: new Date().toISOString()
      })).filter(x => x.trip_id);
      if (planRows.length) assert(await client.from('trip_plans').upsert(planRows));

      await removeMissing('campground_stays', new Set(ordinaryStays.map(x => x._cloudId)));
      await removeMissing('trip_fuel', new Set(snapshot.fuel.map(x => x._cloudId)));
      await removeMissing('maintenance', new Set(maintRows.map(x => x.id)));
      await removeMissing('seasonal_payments', new Set(snapshot.siteFees.map(x => x._cloudId)));
      await removeMissing('electric_bills', new Set(snapshot.electric.map(x => x._cloudId)));
      await removeMissing('site_seasons', new Set(seasonEntries.map(x => x._cloudId)));
      await removeMissing('hub_notes', new Set(snapshot.sharedNotes.map(x => x._cloudId)));
      await removeMissing('trip_plans', new Set(snapshot.tripPlans.map(x => x._cloudId)));
      await removeMissing('trips', new Set(snapshot.tripSummaries.map(x => x._cloudId)));
      Object.keys(known).forEach(table => {
        const source = table === 'campground_stays' ? ordinaryStays :
          table === 'trip_fuel' ? snapshot.fuel :
          table === 'maintenance' ? maintRows.map(x => ({ _cloudId: x.id })) :
          table === 'site_seasons' ? seasonEntries :
          table === 'seasonal_payments' ? snapshot.siteFees :
          table === 'electric_bills' ? snapshot.electric :
          table === 'hub_notes' ? snapshot.sharedNotes : snapshot.tripSummaries;
        const resolvedSource = table === 'trip_plans' ? snapshot.tripPlans : source;
        known[table] = new Set(resolvedSource.map(x => x._cloudId));
      });
    }

    return {
      load,
      save(snapshot) {
        syncing = syncing.then(() => write(snapshot));
        return syncing;
      },
      setStayPhoto,
      setTripPhoto,
      setNotePhotos,
      deleteNotePhotos,
      setRecordReceipt,
      setElectricBillDocument,
      setTripPlanPdfDocument,
      deleteRecordReceipt,
      setMultiRecordReceipts,
      getStorageUsage,
      optimizeStoredPhotos
    };
  }

  window.addEventListener('adventure-cloud-ready', event => {
    window.ADVENTURE_HUB_STORE = createStore(event.detail);
    window.dispatchEvent(new CustomEvent('adventure-store-ready'));
  });
})();
