import { createClient } from 'npm:@supabase/supabase-js@2';

const OPENAI_MODEL = 'gpt-5-mini';
const MAX_AI_INPUT_BYTES = 30 * 1024 * 1024;
const INPUT_USD_PER_MILLION = 0.25;
const OUTPUT_USD_PER_MILLION = 2.00;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});

const toDataUrl = async (blob, mimeType) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
};

const outputText = response => {
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (part.type === 'output_text' && typeof part.text === 'string') return part.text;
    }
  }
  return '';
};

const valueSchema = type => ({ type: [type, 'null'] });
const buildExtractionSchema = fields => ({
  type: 'object',
  additionalProperties: false,
  properties: {
    fields: {
      type: 'object',
      additionalProperties: false,
      properties: Object.fromEntries(Object.entries(fields).map(([key, type]) => [key, valueSchema(type)])),
      required: Object.keys(fields)
    },
    field_confidence: {
      type: 'object',
      additionalProperties: false,
      properties: Object.fromEntries(Object.keys(fields).map(key => [key, valueSchema('number')])),
      required: Object.keys(fields)
    },
    review_fields: { type: 'array', items: { type: 'string' } },
    extracted_text: { type: 'string' },
    overall_confidence: { type: ['number', 'null'] }
  },
  required: ['fields', 'field_confidence', 'review_fields', 'extracted_text', 'overall_confidence']
});

const extractionProfiles = {
  electric_bill: {
    schemaName: 'electric_bill_extraction',
    schema: buildExtractionSchema({
      campground: 'string',
      bill_date: 'string',
      current_meter_reading: 'number',
      electricity_usage: 'number',
      rate: 'number',
      amount_due: 'number',
      payment_date: 'string',
      check_number: 'string',
      amount_paid: 'number'
    }),
    prompt: [
      'Read this seasonal-site electricity bill.',
      'Read both printed text and handwritten payment notes.',
      'The site number and previous meter reading are supplied by the Travel Journal, so do not extract or infer them.',
      'Use YYYY-MM-DD for dates. Use null when a field is absent or uncertain.',
      'bill_date is the printed bill date.',
      'payment_date, check_number, and amount_paid refer to handwritten payment notes when present.',
      'Do not infer a billing period, due date, rate, payment detail, or amount that is not visible.',
      'Put any uncertain field names in review_fields.',
      'extracted_text should be a concise transcription useful for later search, not an explanation.'
    ].join(' ')
  },
  fuel_receipt: {
    schemaName: 'fuel_receipt_extraction',
    schema: buildExtractionSchema({
      purchase_type: 'string',
      receipt_date: 'string',
      receipt_time: 'string',
      station_name: 'string',
      address: 'string',
      city: 'string',
      state: 'string',
      fuel_type: 'string',
      gallons: 'number',
      price_per_gallon: 'number',
      total_cost: 'number',
      def_gallons: 'number',
      def_price_per_gallon: 'number',
      def_total_cost: 'number',
      trip_meter: 'number',
      odometer: 'number'
    }),
    prompt: [
      'Read this fuel and/or DEF receipt and return only values that are visible.',
      'Set purchase_type to fuel, def, or fuel_def. Use fuel_def when one receipt clearly contains both a fuel line and a diesel exhaust fluid or DEF line.',
      'Extract the printed transaction date, time, station name, street address, city, and state.',
      'Fuel fields are fuel_type, gallons, price_per_gallon, and total_cost. DEF must never be included in those fuel amounts.',
      'DEF fields are def_gallons, def_price_per_gallon, and def_total_cost. Look for DEF, diesel exhaust fluid, BlueDEF, or clearly identified bulk DEF lines.',
      'Normalize fuel_type to diesel or gasoline when the receipt clearly identifies it; otherwise use null.',
      'Use YYYY-MM-DD for receipt_date and HH:MM 24-hour format for receipt_time.',
      'For handwriting, inspect only values written beside the explicit labels TRIP and ODO.',
      'TRIP means trip_meter and ODO means odometer.',
      'Trip meter is relevant only when purchase_type contains fuel; do not require or infer it for a DEF-only receipt.',
      'Ignore every other handwritten note, number, mark, or annotation.',
      'Do not infer missing printed or handwritten values.',
      'Use null when a field is absent or uncertain, and put every uncertain field name in review_fields.',
      'extracted_text should be a concise transcription useful for later search, not an explanation.'
    ].join(' ')
  },
  open_roads_settlement: {
    schemaName: 'open_roads_settlement_extraction',
    schema: buildExtractionSchema({
      invoice_id: 'string',
      transaction_date: 'string',
      location: 'string',
      product: 'string',
      quantity: 'number',
      unit_price: 'number',
      subtotal: 'number',
      discount: 'number',
      program_fee: 'number',
      fees: 'number',
      you_saved: 'number',
      total_paid: 'number'
    }),
    prompt: [
      'Read this Open Roads Transaction Details screenshot and return only values that are visible.',
      'This is the delayed settlement for an existing fuel stop, not a new fuel receipt.',
      'Extract invoice ID, transaction date, location, product, quantity, unit price, subtotal, discount, program fee, other fees, You Saved, and Total Paid.',
      'Use YYYY-MM-DD for transaction_date.',
      'Treat Discount as the gross discount, Program Fee as the Open Roads program fee, Fees as other fees, You Saved as net savings, and Total Paid as the final actual fuel expense.',
      'Open Roads may display Total Paid with a leading minus sign because it is a charge. Return total_paid as the positive amount paid.',
      'Do not combine, recompute, or infer monetary values that are not shown.',
      'Use null when a field is absent or uncertain, and put every uncertain field name in review_fields.',
      'extracted_text should be a concise transcription useful for later search, not an explanation.'
    ].join(' ')
  }
};

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const openaiKey = Deno.env.get('OPENAI_API_KEY') || '';
  const authorization = request.headers.get('Authorization') || '';
  if (!supabaseUrl || !supabaseAnonKey) return json({ error: 'The Supabase function is not configured.' }, 500);
  if (!openaiKey) return json({ error: 'OPENAI_API_KEY has not been configured in Supabase.' }, 503);
  if (!authorization) return json({ error: 'Please sign in again.' }, 401);

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } }
  });
  const userResult = await client.auth.getUser();
  if (userResult.error || !userResult.data.user) return json({ error: 'Please sign in again.' }, 401);

  let documentId = '';
  try {
    const body = await request.json();
    documentId = String(body?.documentId || '');
    if (!documentId) return json({ error: 'A document ID is required.' }, 400);

    const [documentResult, filesResult] = await Promise.all([
      client
        .from('hub_documents')
        .select('*')
        .eq('id', documentId)
        .single(),
      client
        .from('hub_document_files')
        .select('*')
        .eq('document_id', documentId)
        .order('page_number')
    ]);
    if (documentResult.error) throw documentResult.error;
    const documentType = documentResult.data.document_type;
    const profile = extractionProfiles[documentType];
    if (!profile) return json({ error: 'This document type is not supported by the secure reader.' }, 400);
    if (filesResult.error) throw filesResult.error;
    if (!filesResult.data?.length) return json({ error: 'This document has no saved files.' }, 400);

    const processingUpdate = Promise.resolve(client.from('hub_documents').update({
      processing_status: 'processing',
      ai_processing_status: 'processing'
    }).eq('id', documentId));

    const content = [{ type: 'input_text', text: profile.prompt }];
    let totalBytes = 0;
    const fileContent = await Promise.all(filesResult.data.map(async file => {
      const knownBytes = Number(file.file_size_bytes) || 0;
      totalBytes += knownBytes;
      if (totalBytes > MAX_AI_INPUT_BYTES) {
        throw new Error('This document is too large for one AI reading. The saved files are unchanged.');
      }
      const mimeType = file.mime_type || 'application/octet-stream';
      if (mimeType === 'application/pdf') {
        const download = await client.storage.from(file.storage_bucket || 'hub-documents').download(file.storage_path);
        if (download.error) throw download.error;
        if (!knownBytes) totalBytes += download.data.size;
        if (totalBytes > MAX_AI_INPUT_BYTES) {
          throw new Error('This document is too large for one AI reading. The saved files are unchanged.');
        }
        const dataUrl = await toDataUrl(download.data, mimeType);
        return {
          type: 'input_file',
          filename: file.original_filename || `document-${file.page_number}.pdf`,
          file_data: dataUrl,
          detail: 'high'
        };
      } else if (mimeType.startsWith('image/')) {
        const signed = await client.storage
          .from(file.storage_bucket || 'hub-documents')
          .createSignedUrl(file.storage_path, 10 * 60);
        if (signed.error) throw signed.error;
        return { type: 'input_image', image_url: signed.data.signedUrl, detail: 'high' };
      }
      return null;
    }));
    const processingResult = await processingUpdate;
    if (processingResult.error) throw processingResult.error;
    content.push(...fileContent.filter(Boolean));
    if (content.length === 1) throw new Error('This document does not contain a supported image or PDF.');

    const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        store: false,
        input: [{ role: 'user', content }],
        text: {
          format: {
            type: 'json_schema',
            name: profile.schemaName,
            strict: true,
            schema: profile.schema
          }
        }
      })
    });
    const openaiResult = await openaiResponse.json();
    if (!openaiResponse.ok) {
      throw new Error(openaiResult?.error?.message || 'OpenAI could not read the document.');
    }
    const extractedTextOutput = outputText(openaiResult);
    if (!extractedTextOutput) throw new Error('OpenAI returned no readable document values.');
    const extracted = JSON.parse(extractedTextOutput);
    const inputTokens = Number(openaiResult?.usage?.input_tokens) || 0;
    const outputTokens = Number(openaiResult?.usage?.output_tokens) || 0;
    const cost = Number(((inputTokens * INPUT_USD_PER_MILLION + outputTokens * OUTPUT_USD_PER_MILLION) / 1_000_000).toFixed(6));
    const extractedData = {
      ...extracted,
      model: OPENAI_MODEL,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
      processed_at: new Date().toISOString()
    };
    const updateResult = await client.from('hub_documents').update({
      processing_status: 'review',
      ai_processing_status: 'review',
      extracted_text: extracted.extracted_text || null,
      extracted_data: extractedData,
      review_fields: extracted.review_fields || [],
      confidence: extracted.overall_confidence,
      processing_cost_usd: cost
    }).eq('id', documentId).select('*').single();
    if (updateResult.error) throw updateResult.error;

    return json({
      document: updateResult.data,
      usage: { inputTokens, outputTokens, costUsd: cost, model: OPENAI_MODEL }
    });
  } catch (error) {
    if (documentId) {
      await client.from('hub_documents').update({
        processing_status: 'failed',
        ai_processing_status: 'failed'
      }).eq('id', documentId);
    }
    return json({ error: error instanceof Error ? error.message : 'The document could not be processed.' }, 500);
  }
});
