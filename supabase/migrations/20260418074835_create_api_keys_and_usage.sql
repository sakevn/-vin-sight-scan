/*
  # VinSight Public API - API Key Management & Usage Tracking

  ## Overview
  This migration sets up the infrastructure for the public VinSight API
  that allows third-party applications (e.g., car rental platforms) to
  integrate VIN decoding into their own workflows.

  ## New Tables

  ### 1. `api_keys`
  Stores API keys issued to third-party developers.
  - `id` (uuid, PK)
  - `key_hash` (text, unique) — SHA-256 hash of the raw API key (never store raw keys)
  - `key_prefix` (text) — First 8 chars of the raw key for display (e.g., "vsk_1234")
  - `name` (text) — Human-readable label given by creator
  - `owner_email` (text) — Contact email for the key owner
  - `is_active` (boolean) — Whether this key is currently valid
  - `rate_limit_per_min` (integer) — Max requests per minute (default 60)
  - `total_requests` (integer) — Lifetime request count
  - `last_used_at` (timestamptz)
  - `created_at` (timestamptz)
  - `expires_at` (timestamptz, nullable) — Optional expiry

  ### 2. `api_usage_logs`
  Per-request audit log for API usage, billing, and analytics.
  - `id` (uuid, PK)
  - `api_key_id` (uuid, FK → api_keys.id)
  - `vin` (text) — The VIN that was queried
  - `source` (text) — Data source used (nhtsa+offline / offline)
  - `status_code` (integer) — HTTP response code
  - `response_ms` (integer) — Response time in ms
  - `ip_address` (text, nullable)
  - `user_agent` (text, nullable)
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on both tables
  - api_keys: no public read; service role only (all access via edge functions)
  - api_usage_logs: no public read; service role only
  - API keys are validated in the edge function using the hashed value
*/

CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash text UNIQUE NOT NULL,
  key_prefix text NOT NULL,
  name text NOT NULL DEFAULT '',
  owner_email text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  rate_limit_per_min integer NOT NULL DEFAULT 60,
  total_requests integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on api_keys"
  ON api_keys FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role insert api_keys"
  ON api_keys FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role update api_keys"
  ON api_keys FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS api_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid REFERENCES api_keys(id) ON DELETE SET NULL,
  vin text,
  source text,
  status_code integer NOT NULL DEFAULT 200,
  response_ms integer,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on api_usage_logs"
  ON api_usage_logs FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role insert api_usage_logs"
  ON api_usage_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_usage_key_id ON api_usage_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created ON api_usage_logs(created_at DESC);
