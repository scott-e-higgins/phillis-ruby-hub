# Higgins Hub secure document reader

`extract-document` is the reusable server-side document-understanding entry
point. Version 1 supports Higgins Travel Journal electric bills. Future
document types can add their own extraction schema without changing the
capture, cleanup, preview, upload, or shared document catalog.

The browser never receives the OpenAI key. The function downloads a document
through the signed-in user's existing Supabase permissions and sends only the
selected document to the OpenAI Responses API.

## One-time Supabase setup

1. Add `OPENAI_API_KEY` as a Supabase Edge Function secret.
2. Deploy the `extract-document` function.
3. Leave JWT verification enabled.

The built-in `SUPABASE_URL` and `SUPABASE_ANON_KEY` function variables are used
to enforce the same household permissions as the Travel Journal.

## Current model and cost accounting

The function uses `gpt-5-mini` for a cost-conscious, image-capable structured
extraction. It records input/output token counts and an estimated processing
cost on `hub_documents`. Pricing constants should be reviewed whenever the
model changes.

No AI request is made for capture, cropping, straightening, rotation,
compression, PDF preservation, preview, upload, or ordinary document viewing.
