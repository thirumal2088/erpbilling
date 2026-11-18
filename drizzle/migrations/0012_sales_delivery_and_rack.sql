ALTER TABLE public.sales ADD COLUMN delivery_option text NOT NULL DEFAULT 'pickup';
ALTER TABLE public.sales ADD COLUMN delivery_date date;
COMMENT ON COLUMN public.sales.delivery_option IS 'Fulfilment choice for the bill: pickup, delivery or courier';
COMMENT ON COLUMN public.sales.delivery_date IS 'Promised delivery date shown on the printed bill';
ALTER TABLE public.materials ADD COLUMN rack_location text;
COMMENT ON COLUMN public.materials.rack_location IS 'Rack or shelf location where the material is stored';