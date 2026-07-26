import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_MODEL = 'gpt-5-mini';
const MAX_AI_INPUT_BYTES = 30 * 1024 * 1024;
const INPUT_USD_PER_MILLION = 0.25;
const OUTPUT_USD_PER_MILLION = 2.00;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});

const toDataUrl = async (blob: Blob, mimeType: string) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
};

const outputText = (response: Record<string, unknown>) => {
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output as Array<Record<string, unknown>>) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content as Array<Record<string, unknown>>) {
      if (part.type === 'output_text' && typeof part.text === 'string') return part.text;
    }
  }
  return '';
};

const valueSchema = (type: 'string' | 'number') => ({ type: [type, 'null'] });
const extractionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    fields: {
      type: 'object',
      additionalProperties: false,
      properties: {
        campground: valueSchema('string'),
        bill_date: valueSchema('string'),
        current_meter_reading: valueSchema('number'),
        electricity_usage: valueSchema('number'),
        rate: valueSchema('number'),
        amount_due: valueSchema('number'),
        payment_date: valueSchema('string'),
        check_number: valueSchema('string'),
        amount_paid: valueSchema('number')
      },
      required: [
        'campground',
        'bill_date',
        'current_meter_reading',
        'electricity_usage',
        'rate',
        'amount_due',
        'payment_date',
        'check_number',
        'amount_paid'
      ]
    },
    field_confidence: {
      type: 'object',
      additionalProperties: false,
      properties: {
        campground: valueSchema('number'),
        bill_date: valueSchema('number'),
        current_meter_reading: valueSchema('number'),
        electricity_usage: valueSchema('number'),
        rate: valueSchema('number'),
        amount_due: valueSchema('number'),
        payment_date: valueSchema('number'),
        check_number: valueSchema('number'),
        amount_paid: valueSchema('number')
      },
      required: [
        'campground',
        'bill_date',
        'current_meter_reading',
        'electricity_usage',
        'rate',
        'amount_due',
        'payment_date',
        'check_number',
        'amount_paid'
      ]
    },
    review_fields: { type: 'array', items: { type: 'string' } },
    extracted_text: { type: 'string' },
    overall_confidence: { type: ['number', 'null'] }
  },
  required: ['fields', 'field_confidence', 'review_fields', 'extracted_text', 'overall_confidence']
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

    const documentResult = await client
      .from('hub_documents')
      .select('*')
      .eq('id', documentId)
      .single();
    if (documentResult.error) throw documentResult.error;
    if (documentResult.data.document_type !== 'electric_bill') {
      return json({ error: 'This reader currently supports electric bills only.' }, 400);
    }

    const filesResult = await client
      .from('hub_document_files')
      .select('*')
      .eq('document_id', documentId)
      .order('page_number');
    if (filesResult.error) throw filesResult.error;
    if (!filesResult.data?.length) return json({ error: 'This document has no saved files.' }, 400);

    await client.from('hub_documents').update({
      processing_status: 'processing',
      ai_processing_status: 'processing'
    }).eq('id', documentId);

    const content: Array<Record<string, unknown>> = [{
      type: 'input_text',
      text: [
        'Read this seasonal-site electricity bill.',
        'Read both printed text and handwritten payment notes.',
        'The site number and previous meter reading are supplied by the Travel Journal, so do not extract or infer them.',
        'Use YYYY-MM-DD for dates. Use null when a field is absent or uncertain.',
        'bill_date is the printed bill date.',
        'payment_date, check_number, and amount_paid refer to handwritten payment notes when present.',
        'Do not infer a billing period, due date, rate, payment detail, or amount that is not visible.',
        'Put any uncertain field names in review_fields.',
        'extracted_text should be a concise transcription of the bill text useful for later search, not an explanation.'
      ].join(' ')
    }];
    let totalBytes = 0;
    for (const file of filesResult.data) {
      const download = await client.storage.from(file.storage_bucket || 'hub-documents').download(file.storage_path);
      if (download.error) throw download.error;
      totalBytes += download.data.size;
      if (totalBytes > MAX_AI_INPUT_BYTES) {
        throw new Error('This document is too large for one AI reading. The saved files are unchanged.');
      }
      const mimeType = file.mime_type || download.data.type || 'application/octet-stream';
      const dataUrl = await toDataUrl(download.data, mimeType);
      if (mimeType === 'application/pdf') {
        content.push({
          type: 'input_file',
          filename: file.original_filename || `document-${file.page_number}.pdf`,
          file_data: dataUrl,
          detail: 'high'
        });
      } else if (mimeType.startsWith('image/')) {
        content.push({ type: 'input_image', image_url: dataUrl, detail: 'high' });
      }
    }
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
            name: 'electric_bill_extraction',
            strict: true,
            schema: extractionSchema
          }
        }
      })
    });
    const openaiResult = await openaiResponse.json();
    if (!openaiResponse.ok) {
      throw new Error(openaiResult?.error?.message || 'OpenAI could not read the document.');
    }
    const extractedTextOutput = outputText(openaiResult);
    if (!extractedTextOutput) throw new Error('OpenAI returned no readable bill values.');
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
