
-- ============ travel_event ============
CREATE TABLE public.travel_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academy_id uuid NOT NULL,
  title text NOT NULL,
  destination_city text NOT NULL,
  destination_country text NOT NULL,
  departure_date date NOT NULL,
  return_date date NOT NULL,
  event_type text NOT NULL,
  squads text[] NOT NULL DEFAULT '{}',
  total_budget numeric,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_travel_event_academy ON public.travel_event(academy_id);
ALTER TABLE public.travel_event ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view travel events for academy" ON public.travel_event
  FOR SELECT TO authenticated
  USING (public.user_has_academy_access(auth.uid(), academy_id));
CREATE POLICY "insert travel events for academy" ON public.travel_event
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_academy_access(auth.uid(), academy_id));
CREATE POLICY "update travel events for academy" ON public.travel_event
  FOR UPDATE TO authenticated
  USING (public.user_has_academy_access(auth.uid(), academy_id))
  WITH CHECK (public.user_has_academy_access(auth.uid(), academy_id));
CREATE POLICY "delete travel events for academy" ON public.travel_event
  FOR DELETE TO authenticated
  USING (public.user_has_academy_access(auth.uid(), academy_id));

CREATE TRIGGER trg_travel_event_updated_at BEFORE UPDATE ON public.travel_event
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper now that table exists
CREATE OR REPLACE FUNCTION public.user_has_travel_event_access(_user_id uuid, _event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.travel_event te
    WHERE te.id = _event_id
      AND public.user_has_academy_access(_user_id, te.academy_id)
  );
$$;

-- ============ travel_itinerary_item ============
CREATE TABLE public.travel_itinerary_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_event_id uuid NOT NULL REFERENCES public.travel_event(id) ON DELETE CASCADE,
  day_date date NOT NULL,
  item_time time,
  title text NOT NULL,
  description text,
  location text,
  item_type text NOT NULL,
  visible_to_parents boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_itinerary_event ON public.travel_itinerary_item(travel_event_id);
ALTER TABLE public.travel_itinerary_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage itinerary" ON public.travel_itinerary_item
  FOR ALL TO authenticated
  USING (public.user_has_travel_event_access(auth.uid(), travel_event_id))
  WITH CHECK (public.user_has_travel_event_access(auth.uid(), travel_event_id));
CREATE TRIGGER trg_itinerary_updated_at BEFORE UPDATE ON public.travel_itinerary_item
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ travel_transport_leg ============
CREATE TABLE public.travel_transport_leg (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_event_id uuid NOT NULL REFERENCES public.travel_event(id) ON DELETE CASCADE,
  leg_order integer NOT NULL DEFAULT 0,
  transport_type text NOT NULL,
  provider text,
  reference_number text,
  departure_location text,
  arrival_location text,
  departure_datetime timestamptz,
  arrival_datetime timestamptz,
  status text NOT NULL DEFAULT 'provisional',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_transport_event ON public.travel_transport_leg(travel_event_id);
ALTER TABLE public.travel_transport_leg ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage transport" ON public.travel_transport_leg
  FOR ALL TO authenticated
  USING (public.user_has_travel_event_access(auth.uid(), travel_event_id))
  WITH CHECK (public.user_has_travel_event_access(auth.uid(), travel_event_id));
CREATE TRIGGER trg_transport_updated_at BEFORE UPDATE ON public.travel_transport_leg
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ travel_accommodation ============
CREATE TABLE public.travel_accommodation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_event_id uuid NOT NULL REFERENCES public.travel_event(id) ON DELETE CASCADE,
  hotel_name text NOT NULL,
  address text,
  phone text,
  check_in date,
  check_out date,
  room_count integer,
  meal_plan text,
  booking_reference text,
  status text NOT NULL DEFAULT 'provisional',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_accom_event ON public.travel_accommodation(travel_event_id);
ALTER TABLE public.travel_accommodation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage accommodation" ON public.travel_accommodation
  FOR ALL TO authenticated
  USING (public.user_has_travel_event_access(auth.uid(), travel_event_id))
  WITH CHECK (public.user_has_travel_event_access(auth.uid(), travel_event_id));
CREATE TRIGGER trg_accom_updated_at BEFORE UPDATE ON public.travel_accommodation
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ travel_budget_item ============
CREATE TABLE public.travel_budget_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_event_id uuid NOT NULL REFERENCES public.travel_event(id) ON DELETE CASCADE,
  category text NOT NULL,
  description text,
  budgeted_amount numeric,
  actual_amount numeric,
  paid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_budget_event ON public.travel_budget_item(travel_event_id);
ALTER TABLE public.travel_budget_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage budget" ON public.travel_budget_item
  FOR ALL TO authenticated
  USING (public.user_has_travel_event_access(auth.uid(), travel_event_id))
  WITH CHECK (public.user_has_travel_event_access(auth.uid(), travel_event_id));
CREATE TRIGGER trg_budget_updated_at BEFORE UPDATE ON public.travel_budget_item
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ travel_player_consent ============
CREATE TABLE public.travel_player_consent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_event_id uuid NOT NULL REFERENCES public.travel_event(id) ON DELETE CASCADE,
  player_id uuid NOT NULL,
  travel_consent_signed boolean NOT NULL DEFAULT false,
  passport_submitted boolean NOT NULL DEFAULT false,
  medical_declaration_signed boolean NOT NULL DEFAULT false,
  photo_consent boolean NOT NULL DEFAULT false,
  emergency_contact_confirmed boolean NOT NULL DEFAULT false,
  dietary_requirements text,
  passport_expiry date,
  signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (travel_event_id, player_id)
);
CREATE INDEX idx_consent_event ON public.travel_player_consent(travel_event_id);
CREATE INDEX idx_consent_player ON public.travel_player_consent(player_id);
ALTER TABLE public.travel_player_consent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage consent" ON public.travel_player_consent
  FOR ALL TO authenticated
  USING (public.user_has_travel_event_access(auth.uid(), travel_event_id))
  WITH CHECK (public.user_has_travel_event_access(auth.uid(), travel_event_id));
CREATE TRIGGER trg_consent_updated_at BEFORE UPDATE ON public.travel_player_consent
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ travel_document ============
CREATE TABLE public.travel_document (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_event_id uuid NOT NULL REFERENCES public.travel_event(id) ON DELETE CASCADE,
  title text NOT NULL,
  document_type text NOT NULL,
  file_url text,
  is_restricted boolean NOT NULL DEFAULT false,
  required boolean NOT NULL DEFAULT false,
  uploaded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_document_event ON public.travel_document(travel_event_id);
ALTER TABLE public.travel_document ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage documents" ON public.travel_document
  FOR ALL TO authenticated
  USING (public.user_has_travel_event_access(auth.uid(), travel_event_id))
  WITH CHECK (public.user_has_travel_event_access(auth.uid(), travel_event_id));
CREATE TRIGGER trg_document_updated_at BEFORE UPDATE ON public.travel_document
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ travel_update ============
CREATE TABLE public.travel_update (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_event_id uuid NOT NULL REFERENCES public.travel_event(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  update_type text NOT NULL,
  target_squads text[] NOT NULL DEFAULT '{}',
  sent_push boolean NOT NULL DEFAULT false,
  posted_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_update_event ON public.travel_update(travel_event_id);
ALTER TABLE public.travel_update ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage updates" ON public.travel_update
  FOR ALL TO authenticated
  USING (public.user_has_travel_event_access(auth.uid(), travel_event_id))
  WITH CHECK (public.user_has_travel_event_access(auth.uid(), travel_event_id));
CREATE TRIGGER trg_update_updated_at BEFORE UPDATE ON public.travel_update
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Storage bucket ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('travel-documents', 'travel-documents', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "travel-documents read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'travel-documents');

CREATE POLICY "travel-documents insert by academy member"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'travel-documents'
    AND public.user_has_travel_event_access(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid
    )
  );

CREATE POLICY "travel-documents update by academy member"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'travel-documents'
    AND public.user_has_travel_event_access(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid
    )
  );

CREATE POLICY "travel-documents delete by academy member"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'travel-documents'
    AND public.user_has_travel_event_access(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid
    )
  );
