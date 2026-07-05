import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "tools_semantic_entities" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"term" varchar,
  	"url" varchar
  );
  
  CREATE TABLE "_tools_v_version_semantic_entities" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"term" varchar,
  	"url" varchar,
  	"_uuid" varchar
  );
  
  ALTER TABLE "tools_semantic_entities" ADD CONSTRAINT "tools_semantic_entities_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tools_v_version_semantic_entities" ADD CONSTRAINT "_tools_v_version_semantic_entities_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_tools_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "tools_semantic_entities_order_idx" ON "tools_semantic_entities" USING btree ("_order");
  CREATE INDEX "tools_semantic_entities_parent_id_idx" ON "tools_semantic_entities" USING btree ("_parent_id");
  CREATE INDEX "_tools_v_version_semantic_entities_order_idx" ON "_tools_v_version_semantic_entities" USING btree ("_order");
  CREATE INDEX "_tools_v_version_semantic_entities_parent_id_idx" ON "_tools_v_version_semantic_entities" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "tools_semantic_entities" CASCADE;
  DROP TABLE "_tools_v_version_semantic_entities" CASCADE;`)
}
