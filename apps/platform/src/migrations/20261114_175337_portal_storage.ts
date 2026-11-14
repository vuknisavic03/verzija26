import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Trajno skladište kandidatskog portala u Postgresu (umesto `.data/portal-store.json`, koji se
 * brisao pri svakom deploy-u) i šifrovana dokumenta portala.
 *
 * Ručno napisana i idempotentna: dodaje samo dve nove tabele, bez diranja postojećih.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  DO $$ BEGIN
    CREATE TYPE "public"."enum_portal_records_kind" AS ENUM('candidate', 'settings');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;

  CREATE TABLE IF NOT EXISTS "portal_records" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"kind" "enum_portal_records_kind" DEFAULT 'candidate' NOT NULL,
  	"email" varchar,
  	"data" jsonb NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "portal_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"record_key" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"field" varchar NOT NULL,
  	"file_name" varchar NOT NULL,
  	"mime_type" varchar NOT NULL,
  	"size_bytes" numeric NOT NULL,
  	"sha256" varchar NOT NULL,
  	"ciphertext" varchar NOT NULL,
  	"iv" varchar NOT NULL,
  	"auth_tag" varchar NOT NULL,
  	"key_id" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "portal_records_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "portal_documents_id" integer;
  DO $$ BEGIN
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_portal_records_fk" FOREIGN KEY ("portal_records_id") REFERENCES "public"."portal_records"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  DO $$ BEGIN
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_portal_documents_fk" FOREIGN KEY ("portal_documents_id") REFERENCES "public"."portal_documents"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;
  CREATE UNIQUE INDEX IF NOT EXISTS "portal_records_key_idx" ON "portal_records" USING btree ("key");
  CREATE INDEX IF NOT EXISTS "portal_records_kind_idx" ON "portal_records" USING btree ("kind");
  CREATE INDEX IF NOT EXISTS "portal_records_email_idx" ON "portal_records" USING btree ("email");
  CREATE INDEX IF NOT EXISTS "portal_records_updated_at_idx" ON "portal_records" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "portal_records_created_at_idx" ON "portal_records" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "portal_documents_record_key_idx" ON "portal_documents" USING btree ("record_key");
  CREATE INDEX IF NOT EXISTS "portal_documents_email_idx" ON "portal_documents" USING btree ("email");
  CREATE INDEX IF NOT EXISTS "portal_documents_updated_at_idx" ON "portal_documents" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "portal_documents_created_at_idx" ON "portal_documents" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_portal_records_id_idx" ON "payload_locked_documents_rels" USING btree ("portal_records_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_portal_documents_id_idx" ON "payload_locked_documents_rels" USING btree ("portal_documents_id");

  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_portal_records_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_portal_documents_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_portal_records_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_portal_documents_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "portal_records_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "portal_documents_id";
  DROP TABLE IF EXISTS "portal_documents" CASCADE;
  DROP TABLE IF EXISTS "portal_records" CASCADE;
  DROP TYPE IF EXISTS "public"."enum_portal_records_kind";
  `)
}
