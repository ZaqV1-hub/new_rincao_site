-- Apply explicitly before enabling the weather routes; request handlers never create tables.
CREATE TABLE IF NOT EXISTS weather_forecast_cache (
  parque TEXT NOT NULL CHECK (parque IN ('rincao','estancia')),
  latitude NUMERIC(7,4) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude NUMERIC(8,4) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  source TEXT NOT NULL CHECK (source = 'MET Norway'),
  payload JSONB,
  queried_at TIMESTAMPTZ,
  model_updated_at TIMESTAMPTZ,
  last_modified TEXT,
  attempted_at TIMESTAMPTZ,
  next_refresh_at TIMESTAMPTZ NOT NULL DEFAULT '-infinity',
  lease_token UUID,
  lease_until TIMESTAMPTZ,
  last_error TEXT,
  PRIMARY KEY (parque,latitude,longitude),
  CHECK ((lease_token IS NULL) = (lease_until IS NULL))
);

CREATE TABLE IF NOT EXISTS weather_forecast_days (
  parque TEXT NOT NULL CHECK (parque IN ('rincao','estancia')),
  data DATE NOT NULL,
  latitude NUMERIC(7,4) NOT NULL,
  longitude NUMERIC(8,4) NOT NULL,
  source TEXT NOT NULL CHECK (source = 'MET Norway'),
  queried_at TIMESTAMPTZ NOT NULL,
  model_updated_at TIMESTAMPTZ NOT NULL,
  snapshot JSONB NOT NULL,
  PRIMARY KEY (parque,data)
);
