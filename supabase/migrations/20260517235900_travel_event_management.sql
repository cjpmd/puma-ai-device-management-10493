-- Travel event management tables
-- 8 tables covering the full travel lifecycle: event, transport, accommodation,
-- budget, itinerary, updates, documents, and per-player consent tracking.

-- ─── TABLES ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.travel_event (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id          uuid        NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  title               text        NOT NULL,
  destination_city    text        NOT NULL,
  destination_country text        NOT NULL,
  departure_date      date        NOT NULL,
  return_date         date        NOT NULL,
  event_type          text        NOT NULL CHECK (event_type IN ('tournament','festival','training_camp','friendly_tour')),
  squads              text[]      NOT NULL DEFAULT '{}',
  total_budget        numeric,
  status              text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','planning','confirmed','in_progress','complete')),
  created_by          uuid        REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.travel_transport_leg (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_event_id     uuid        NOT NULL REFERENCES public.travel_event(id) ON DELETE CASCADE,
  leg_order           int         NOT NULL,
  transport_type      text        NOT NULL CHECK (transport_type IN ('flight','coach','train','ferry')),
  provider            text,
  reference_number    text,
  departure_location  text,
  arrival_location    text,
  departure_datetime  timestamptz,
  arrival_datetime    timestamptz,
  status              text        NOT NULL DEFAULT 'provisional' CHECK (status IN ('provisional','confirmed','cancelled')),
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.travel_accommodation (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_event_id     uuid        NOT NULL REFERENCES public.travel_event(id) ON DELETE CASCADE,
  hotel_name          text        NOT NULL,
  address             text,
  phone               text,
  check_in            timestamptz,
  check_out           timestamptz,
  room_count          int,
  meal_plan           text,
  booking_reference   text,
  status              text        NOT NULL DEFAULT 'provisional' CHECK (status IN ('provisional','confirmed')),
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.travel_budget_item (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_event_id  uuid        NOT NULL REFERENCES public.travel_event(id) ON DELETE CASCADE,
  category         text        NOT NULL CHECK (category IN ('flights','accommodation','ground_transport','tournament_entry','meals','kit','other')),
  description      text,
  budgeted_amount  numeric,
  actual_amount    numeric,
  paid             bool        NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.travel_itinerary_item (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_event_id    uuid        NOT NULL REFERENCES public.travel_event(id) ON DELETE CASCADE,
  day_date           date        NOT NULL,
  item_time          time,
  title              text        NOT NULL,
  description        text,
  location           text,
  item_type          text        NOT NULL CHECK (item_type IN ('travel','match','training','meal','free_time','ceremony','curfew')),
  visible_to_parents bool        NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  sort_order         int         NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.travel_update (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_event_id  uuid        NOT NULL REFERENCES public.travel_event(id) ON DELETE CASCADE,
  title            text        NOT NULL,
  body             text        NOT NULL,
  update_type      text        NOT NULL CHECK (update_type IN ('info','warning','urgent')),
  target_squads    text[]      NOT NULL DEFAULT '{}',
  posted_by        uuid        REFERENCES auth.users(id),
  posted_at        timestamptz NOT NULL DEFAULT now(),
  sent_push        bool        NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.travel_document (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_event_id  uuid        NOT NULL REFERENCES public.travel_event(id) ON DELETE CASCADE,
  title            text        NOT NULL,
  document_type    text        NOT NULL CHECK (document_type IN ('consent','passport','medical','insurance','booking','risk_assessment','other')),
  file_url         text,
  is_restricted    bool        NOT NULL DEFAULT false,
  uploaded_by      uuid        REFERENCES auth.users(id),
  uploaded_at      timestamptz NOT NULL DEFAULT now(),
  required         bool        NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.travel_player_consent (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_event_id             uuid        NOT NULL REFERENCES public.travel_event(id) ON DELETE CASCADE,
  player_id                   uuid        NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  travel_consent_signed       bool        NOT NULL DEFAULT false,
  passport_submitted          bool        NOT NULL DEFAULT false,
  medical_declaration_signed  bool        NOT NULL DEFAULT false,
  photo_consent               bool        NOT NULL DEFAULT false,
  emergency_contact_confirmed bool        NOT NULL DEFAULT false,
  dietary_requirements        text,
  passport_expiry             date,
  signed_at                   timestamptz,
  signed_by                   text,
  UNIQUE (travel_event_id, player_id)
);

-- ─── INDEXES ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_travel_event_academy       ON public.travel_event(academy_id);
CREATE INDEX IF NOT EXISTS idx_travel_transport_event     ON public.travel_transport_leg(travel_event_id);
CREATE INDEX IF NOT EXISTS idx_travel_accommodation_event ON public.travel_accommodation(travel_event_id);
CREATE INDEX IF NOT EXISTS idx_travel_budget_event        ON public.travel_budget_item(travel_event_id);
CREATE INDEX IF NOT EXISTS idx_travel_itinerary_event     ON public.travel_itinerary_item(travel_event_id);
CREATE INDEX IF NOT EXISTS idx_travel_update_event        ON public.travel_update(travel_event_id);
CREATE INDEX IF NOT EXISTS idx_travel_document_event      ON public.travel_document(travel_event_id);
CREATE INDEX IF NOT EXISTS idx_travel_consent_event       ON public.travel_player_consent(travel_event_id);
CREATE INDEX IF NOT EXISTS idx_travel_consent_player      ON public.travel_player_consent(player_id);

-- ─── ENABLE RLS ───────────────────────────────────────────────────────────────

ALTER TABLE public.travel_event          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_transport_leg  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_accommodation  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_budget_item    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_itinerary_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_update         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_document       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_player_consent ENABLE ROW LEVEL SECURITY;

-- ─── HELPER FUNCTION ─────────────────────────────────────────────────────────
-- Returns true if the calling user belongs to the academy that owns this travel event.
CREATE OR REPLACE FUNCTION public.can_access_travel_event(p_travel_event_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.travel_event   te
    JOIN   public.user_academies ua ON ua.academy_id = te.academy_id
    WHERE  te.id        = p_travel_event_id
      AND  ua.user_id   = auth.uid()
  );
$$;

-- ─── RLS POLICIES ────────────────────────────────────────────────────────────

-- travel_event: academy_id is on the row itself, so query user_academies directly.

CREATE POLICY "te_select" ON public.travel_event
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_academies ua
    WHERE ua.academy_id = travel_event.academy_id AND ua.user_id = auth.uid()
  ));

CREATE POLICY "te_insert" ON public.travel_event
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_academies ua
    WHERE ua.academy_id = travel_event.academy_id AND ua.user_id = auth.uid()
  ));

CREATE POLICY "te_update" ON public.travel_event
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_academies ua
    WHERE ua.academy_id = travel_event.academy_id AND ua.user_id = auth.uid()
  ));

-- travel_transport_leg

CREATE POLICY "ttl_select" ON public.travel_transport_leg
  FOR SELECT TO authenticated USING (can_access_travel_event(travel_event_id));
CREATE POLICY "ttl_insert" ON public.travel_transport_leg
  FOR INSERT TO authenticated WITH CHECK (can_access_travel_event(travel_event_id));
CREATE POLICY "ttl_update" ON public.travel_transport_leg
  FOR UPDATE TO authenticated USING (can_access_travel_event(travel_event_id));

-- travel_accommodation

CREATE POLICY "ta_select" ON public.travel_accommodation
  FOR SELECT TO authenticated USING (can_access_travel_event(travel_event_id));
CREATE POLICY "ta_insert" ON public.travel_accommodation
  FOR INSERT TO authenticated WITH CHECK (can_access_travel_event(travel_event_id));
CREATE POLICY "ta_update" ON public.travel_accommodation
  FOR UPDATE TO authenticated USING (can_access_travel_event(travel_event_id));

-- travel_budget_item

CREATE POLICY "tbi_select" ON public.travel_budget_item
  FOR SELECT TO authenticated USING (can_access_travel_event(travel_event_id));
CREATE POLICY "tbi_insert" ON public.travel_budget_item
  FOR INSERT TO authenticated WITH CHECK (can_access_travel_event(travel_event_id));
CREATE POLICY "tbi_update" ON public.travel_budget_item
  FOR UPDATE TO authenticated USING (can_access_travel_event(travel_event_id));

-- travel_itinerary_item

CREATE POLICY "tii_select" ON public.travel_itinerary_item
  FOR SELECT TO authenticated USING (can_access_travel_event(travel_event_id));
CREATE POLICY "tii_insert" ON public.travel_itinerary_item
  FOR INSERT TO authenticated WITH CHECK (can_access_travel_event(travel_event_id));
CREATE POLICY "tii_update" ON public.travel_itinerary_item
  FOR UPDATE TO authenticated USING (can_access_travel_event(travel_event_id));

-- travel_update

CREATE POLICY "tu_select" ON public.travel_update
  FOR SELECT TO authenticated USING (can_access_travel_event(travel_event_id));
CREATE POLICY "tu_insert" ON public.travel_update
  FOR INSERT TO authenticated WITH CHECK (can_access_travel_event(travel_event_id));
CREATE POLICY "tu_update" ON public.travel_update
  FOR UPDATE TO authenticated USING (can_access_travel_event(travel_event_id));

-- travel_document: two-tier visibility.
-- Non-restricted rows: any academy member.
-- is_restricted=true rows: welfare_officer and head_of_academy roles only.

CREATE POLICY "td_select_normal" ON public.travel_document
  FOR SELECT TO authenticated
  USING (
    is_restricted = false
    AND can_access_travel_event(travel_event_id)
  );

CREATE POLICY "td_select_restricted" ON public.travel_document
  FOR SELECT TO authenticated
  USING (
    is_restricted = true
    AND EXISTS (
      SELECT 1
      FROM   public.travel_event   te
      JOIN   public.user_academies ua ON ua.academy_id = te.academy_id
      WHERE  te.id      = travel_document.travel_event_id
        AND  ua.user_id = auth.uid()
        AND  ua.role    IN ('welfare_officer','head_of_academy')
    )
  );

CREATE POLICY "td_insert" ON public.travel_document
  FOR INSERT TO authenticated WITH CHECK (can_access_travel_event(travel_event_id));
CREATE POLICY "td_update" ON public.travel_document
  FOR UPDATE TO authenticated USING (can_access_travel_event(travel_event_id));

-- travel_player_consent

CREATE POLICY "tpc_select" ON public.travel_player_consent
  FOR SELECT TO authenticated USING (can_access_travel_event(travel_event_id));
CREATE POLICY "tpc_insert" ON public.travel_player_consent
  FOR INSERT TO authenticated WITH CHECK (can_access_travel_event(travel_event_id));
CREATE POLICY "tpc_update" ON public.travel_player_consent
  FOR UPDATE TO authenticated USING (can_access_travel_event(travel_event_id));
