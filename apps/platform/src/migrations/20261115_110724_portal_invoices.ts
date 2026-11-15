import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Fakture za uplate potvrđene kroz kandidatski portal ulaze u istu tabelu (i istu KIR numeraciju)
 * kao domenske fakture: domenske veze postaju neobavezne, dodaju se polja portala.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "candidate_invoices" ALTER COLUMN "candidate_account_id" DROP NOT NULL;
  ALTER TABLE "candidate_invoices" ALTER COLUMN "candidate_process_id" DROP NOT NULL;
  ALTER TABLE "candidate_invoices" ALTER COLUMN "pre_application_id" DROP NOT NULL;
  ALTER TABLE "candidate_invoices" ALTER COLUMN "candidate_payment_id" DROP NOT NULL;
  ALTER TABLE "candidate_invoices" ADD COLUMN IF NOT EXISTS "portal_record_key" varchar;
  ALTER TABLE "candidate_invoices" ADD COLUMN IF NOT EXISTS "portal_email" varchar;
  ALTER TABLE "candidate_invoices" ADD COLUMN IF NOT EXISTS "portal_installment" varchar;
  ALTER TABLE "candidate_invoices" ADD COLUMN IF NOT EXISTS "payment_received_at" timestamp(3) with time zone;
  ALTER TABLE "candidate_invoices" ADD COLUMN IF NOT EXISTS "payment_reference" varchar;
  CREATE INDEX IF NOT EXISTS "candidate_invoices_portal_record_key_idx" ON "candidate_invoices" USING btree ("portal_record_key");
  CREATE INDEX IF NOT EXISTS "candidate_invoices_portal_email_idx" ON "candidate_invoices" USING btree ("portal_email");
  -- Jedna faktura po rati po kandidatu iz portala (zaštita i od istovremenih potvrda).
  CREATE UNIQUE INDEX IF NOT EXISTS "candidate_invoices_portal_installment_unique"
    ON "candidate_invoices" ("portal_email", "portal_installment")
    WHERE "portal_email" IS NOT NULL AND "portal_installment" IS NOT NULL;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "candidate_invoices_portal_installment_unique";
  DROP INDEX IF EXISTS "candidate_invoices_portal_record_key_idx";
  DROP INDEX IF EXISTS "candidate_invoices_portal_email_idx";
  ALTER TABLE "candidate_invoices" ALTER COLUMN "candidate_account_id" SET NOT NULL;
  ALTER TABLE "candidate_invoices" ALTER COLUMN "candidate_process_id" SET NOT NULL;
  ALTER TABLE "candidate_invoices" ALTER COLUMN "pre_application_id" SET NOT NULL;
  ALTER TABLE "candidate_invoices" ALTER COLUMN "candidate_payment_id" SET NOT NULL;
  ALTER TABLE "candidate_invoices" DROP COLUMN IF EXISTS "portal_record_key";
  ALTER TABLE "candidate_invoices" DROP COLUMN IF EXISTS "portal_email";
  ALTER TABLE "candidate_invoices" DROP COLUMN IF EXISTS "portal_installment";
  ALTER TABLE "candidate_invoices" DROP COLUMN IF EXISTS "payment_received_at";
  ALTER TABLE "candidate_invoices" DROP COLUMN IF EXISTS "payment_reference";`)
}
