-- =============================================================================
-- SNAPSHOT SCHEMA — Mee Too Pilates
-- Generato: 2026-06-17 da ispezione OpenAPI PostgREST
-- Questo file documenta lo stato attuale del DB. NON applicarlo a un DB
-- esistente senza verificare: potrebbe divergere sui default/vincoli esatti.
-- Per un DB nuovo usare questo come base e ricontrollare con pg_dump.
-- =============================================================================

-- Estensioni
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- STUDIOS (nessuna dipendenza)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.studios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  email       TEXT,
  phone       TEXT,
  address     TEXT,
  city        TEXT,
  vat_number  TEXT,
  fiscal_code TEXT,
  logo_url    TEXT,
  settings    JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- PROFILES (dipende da auth.users e studios)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  studio_id     UUID REFERENCES public.studios(id) ON DELETE SET NULL,
  role          TEXT NOT NULL,                    -- 'admin' | 'instructor' | 'client'
  first_name    TEXT,
  last_name     TEXT,
  phone         TEXT,
  date_of_birth DATE,
  avatar_url    TEXT,
  medical_notes TEXT,
  fiscal_code   TEXT,
  address       TEXT,
  city          TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- CLASSES (dipende da studios)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.classes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id        UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT,
  duration_minutes INTEGER NOT NULL,
  color            TEXT,
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- PACKAGES (dipende da studios)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.packages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id      UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  description    TEXT,
  credits        INTEGER NOT NULL,
  validity_days  INTEGER,
  price          NUMERIC NOT NULL,
  is_active      BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- SCHEDULES (dipende da studios, classes, profiles)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.schedules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id        UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  class_id         UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  instructor_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  starts_at        TIMESTAMPTZ NOT NULL,
  ends_at          TIMESTAMPTZ NOT NULL,
  max_spots        INTEGER NOT NULL,
  current_bookings INTEGER DEFAULT 0,
  location         TEXT,
  notes            TEXT,
  is_cancelled     BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- CLIENT_PACKAGES (dipende da studios, profiles, packages)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.client_packages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id     UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  client_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  package_id    UUID NOT NULL REFERENCES public.packages(id) ON DELETE RESTRICT,
  credits_total INTEGER NOT NULL,
  credits_used  INTEGER DEFAULT 0,
  price_paid    NUMERIC,
  purchased_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,
  is_active     BOOLEAN DEFAULT TRUE
);

-- =============================================================================
-- BOOKINGS (dipende da studios, profiles, schedules, client_packages)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.bookings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id         UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  client_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  schedule_id       UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  client_package_id UUID REFERENCES public.client_packages(id) ON DELETE SET NULL,
  status            TEXT DEFAULT 'confirmed',     -- 'confirmed' | 'cancelled'
  booked_at         TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at      TIMESTAMPTZ
);

-- =============================================================================
-- CLIENT_NOTES (dipende da profiles, studios)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.client_notes (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  note_text TEXT NOT NULL,
  studio_id UUID REFERENCES public.studios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- WALLET_TRANSACTIONS (dipende da studios, profiles)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id   UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount      NUMERIC NOT NULL,
  type        TEXT NOT NULL,                       -- 'credit' | 'debit'
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- EVENTS (dipende da studios)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id    UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ NOT NULL,
  location     TEXT,
  max_spots    INTEGER,
  price        NUMERIC,
  cover_url    TEXT,
  is_published BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- EVENT_REGISTRATIONS (dipende da studios, events, profiles)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.event_registrations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id    UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  event_id     UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  client_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status       TEXT DEFAULT 'registered',
  amount_paid  NUMERIC,
  registered_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- PRODUCTS (dipende da studios)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id   UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  price       NUMERIC,
  is_free     BOOLEAN DEFAULT FALSE,
  is_active   BOOLEAN DEFAULT TRUE,
  cover_url   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- CONTENT_ITEMS (dipende da studios, products)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.content_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id        UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  product_id       UUID REFERENCES public.products(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  type             TEXT,                           -- 'video' | 'pdf' | ecc.
  url              TEXT,
  duration_seconds INTEGER,
  sort_order       INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INVOICES (dipende da studios, profiles, client_packages)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id             UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  client_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_package_id     UUID REFERENCES public.client_packages(id) ON DELETE SET NULL,
  amount                NUMERIC NOT NULL,
  vat_amount            NUMERIC,
  invoice_number        TEXT,
  fatture_in_cloud_id   TEXT,
  sdi_status            TEXT,
  pdf_url               TEXT,
  issued_at             TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- EMAIL_CAMPAIGNS (dipende da studios)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id        UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  subject          TEXT NOT NULL,
  body             TEXT,
  segment          TEXT,
  status           TEXT DEFAULT 'draft',           -- 'draft' | 'sent'
  sent_at          TIMESTAMPTZ,
  recipients_count INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
