CREATE TABLE public.vin_lookups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vin TEXT NOT NULL,
  make TEXT,
  model TEXT,
  model_year TEXT,
  country TEXT,
  manufacturer TEXT,
  plant TEXT,
  serial_number TEXT,
  engine TEXT,
  body_class TEXT,
  vehicle_type TEXT,
  source TEXT NOT NULL DEFAULT 'nhtsa',
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX vin_lookups_vin_idx ON public.vin_lookups (vin);
CREATE INDEX vin_lookups_created_at_idx ON public.vin_lookups (created_at DESC);

ALTER TABLE public.vin_lookups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read vin lookups"
  ON public.vin_lookups FOR SELECT
  USING (true);