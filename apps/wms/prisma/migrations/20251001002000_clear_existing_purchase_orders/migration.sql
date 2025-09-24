DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'inventory_transactions'
  ) THEN
    UPDATE "public"."inventory_transactions"
    SET "purchase_order_id" = NULL,
        "purchase_order_line_id" = NULL
    WHERE "purchase_order_id" IS NOT NULL
       OR "purchase_order_line_id" IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'purchase_order_lines'
  ) THEN
    DELETE FROM "public"."purchase_order_lines";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'purchase_orders'
  ) THEN
    DELETE FROM "public"."purchase_orders";
  END IF;
END$$;
