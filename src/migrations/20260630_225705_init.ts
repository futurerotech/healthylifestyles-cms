import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'editor');
  CREATE TYPE "public"."enum_categories_kind" AS ENUM('tool', 'section');
  CREATE TYPE "public"."enum__categories_v_version_kind" AS ENUM('tool', 'section');
  CREATE TYPE "public"."enum_authors_schema_type" AS ENUM('Organization', 'Person');
  CREATE TYPE "public"."enum_tools_inputs_type" AS ENUM('number', 'select', 'radio', 'toggle');
  CREATE TYPE "public"."enum_tools_tool_type" AS ENUM('formula', 'coded');
  CREATE TYPE "public"."enum_tools_icon" AS ENUM('flame', 'pie-chart', 'egg', 'wheat', 'droplet', 'scale', 'percent', 'target', 'dumbbell', 'ruler', 'person-standing', 'trending-down', 'trending-up', 'weight', 'calendar-clock', 'calendar-days', 'calendar-heart', 'baby', 'heart', 'heart-pulse', 'activity', 'gauge', 'moon', 'moon-star', 'bed', 'alarm-clock', 'clock', 'coffee', 'wine', 'beer', 'hourglass', 'utensils', 'beef', 'cookie', 'footprints', 'timer', 'wind', 'armchair', 'cigarette', 'battery-low', 'flask');
  CREATE TYPE "public"."enum_tools_gradient" AS ENUM('orange', 'amber', 'cyan', 'blue', 'purple', 'indigo', 'red', 'pink', 'green', 'teal', 'brown', 'sky');
  CREATE TYPE "public"."enum_tools_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__tools_v_version_inputs_type" AS ENUM('number', 'select', 'radio', 'toggle');
  CREATE TYPE "public"."enum__tools_v_version_tool_type" AS ENUM('formula', 'coded');
  CREATE TYPE "public"."enum__tools_v_version_icon" AS ENUM('flame', 'pie-chart', 'egg', 'wheat', 'droplet', 'scale', 'percent', 'target', 'dumbbell', 'ruler', 'person-standing', 'trending-down', 'trending-up', 'weight', 'calendar-clock', 'calendar-days', 'calendar-heart', 'baby', 'heart', 'heart-pulse', 'activity', 'gauge', 'moon', 'moon-star', 'bed', 'alarm-clock', 'clock', 'coffee', 'wine', 'beer', 'hourglass', 'utensils', 'beef', 'cookie', 'footprints', 'timer', 'wind', 'armchair', 'cigarette', 'battery-low', 'flask');
  CREATE TYPE "public"."enum__tools_v_version_gradient" AS ENUM('orange', 'amber', 'cyan', 'blue', 'purple', 'indigo', 'red', 'pink', 'green', 'teal', 'brown', 'sky');
  CREATE TYPE "public"."enum__tools_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_articles_blocks_hero_overlay" AS ENUM('dark', 'light', 'none');
  CREATE TYPE "public"."enum_articles_blocks_calculator_embed_variant" AS ENUM('inline', 'banner');
  CREATE TYPE "public"."enum_articles_blocks_two_column_image_side" AS ENUM('left', 'right');
  CREATE TYPE "public"."enum_articles_blocks_text_style" AS ENUM('p', 'h2', 'h3');
  CREATE TYPE "public"."enum_articles_blocks_list_style" AS ENUM('unordered', 'ordered');
  CREATE TYPE "public"."enum_articles_blocks_callout_tone" AS ENUM('info', 'tip', 'warning');
  CREATE TYPE "public"."enum_articles_ai_provider" AS ENUM('gemini', 'nararouter', 'mimo-v2.5-free', 'mimo-v2.5-pro-free', 'mistral-large', 'mistral-medium-3-5', 'deepseek', 'zai', 'local', 'anthropic');
  CREATE TYPE "public"."enum_articles_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__articles_v_blocks_hero_overlay" AS ENUM('dark', 'light', 'none');
  CREATE TYPE "public"."enum__articles_v_blocks_calculator_embed_variant" AS ENUM('inline', 'banner');
  CREATE TYPE "public"."enum__articles_v_blocks_two_column_image_side" AS ENUM('left', 'right');
  CREATE TYPE "public"."enum__articles_v_blocks_text_style" AS ENUM('p', 'h2', 'h3');
  CREATE TYPE "public"."enum__articles_v_blocks_list_style" AS ENUM('unordered', 'ordered');
  CREATE TYPE "public"."enum__articles_v_blocks_callout_tone" AS ENUM('info', 'tip', 'warning');
  CREATE TYPE "public"."enum__articles_v_version_ai_provider" AS ENUM('gemini', 'nararouter', 'mimo-v2.5-free', 'mimo-v2.5-pro-free', 'mistral-large', 'mistral-medium-3-5', 'deepseek', 'zai', 'local', 'anthropic');
  CREATE TYPE "public"."enum__articles_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_pages_blocks_hero_overlay" AS ENUM('dark', 'light', 'none');
  CREATE TYPE "public"."enum_pages_blocks_calculator_embed_variant" AS ENUM('inline', 'banner');
  CREATE TYPE "public"."enum_pages_blocks_two_column_image_side" AS ENUM('left', 'right');
  CREATE TYPE "public"."enum_pages_blocks_text_style" AS ENUM('p', 'h2', 'h3');
  CREATE TYPE "public"."enum_pages_blocks_list_style" AS ENUM('unordered', 'ordered');
  CREATE TYPE "public"."enum_pages_blocks_callout_tone" AS ENUM('info', 'tip', 'warning');
  CREATE TYPE "public"."enum_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__pages_v_blocks_hero_overlay" AS ENUM('dark', 'light', 'none');
  CREATE TYPE "public"."enum__pages_v_blocks_calculator_embed_variant" AS ENUM('inline', 'banner');
  CREATE TYPE "public"."enum__pages_v_blocks_two_column_image_side" AS ENUM('left', 'right');
  CREATE TYPE "public"."enum__pages_v_blocks_text_style" AS ENUM('p', 'h2', 'h3');
  CREATE TYPE "public"."enum__pages_v_blocks_list_style" AS ENUM('unordered', 'ordered');
  CREATE TYPE "public"."enum__pages_v_blocks_callout_tone" AS ENUM('info', 'tip', 'warning');
  CREATE TYPE "public"."enum__pages_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_redirects_type" AS ENUM('301', '302');
  CREATE TYPE "public"."enum_personas_rules_match_type" AS ENUM('tool', 'category');
  CREATE TYPE "public"."enum_indexing_status_engine" AS ENUM('https://api.indexnow.org/indexnow', 'https://www.bing.com/indexnow', 'https://search.yandex.com/indexnow', 'google');
  CREATE TYPE "public"."enum_indexing_status_status" AS ENUM('pending', 'success', 'failed');
  CREATE TYPE "public"."enum_pseo_templates_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_pseo_datasets_status" AS ENUM('draft', 'ready', 'generated');
  CREATE TYPE "public"."enum_pseo_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_subscribers_interests" AS ENUM('weight-loss', 'nutrition', 'fitness', 'sleep', 'heart-health', 'mental-wellness', 'womens-health', 'general');
  CREATE TYPE "public"."enum_subscribers_source" AS ENUM('web-form', 'csv-import', 'n8n-sync', 'api');
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'schedulePublish');
  CREATE TYPE "public"."enum_payload_jobs_log_state" AS ENUM('failed', 'succeeded');
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'schedulePublish');
  CREATE TYPE "public"."enum_settings_social_platform" AS ENUM('Facebook', 'X (Twitter)', 'Instagram', 'YouTube', 'LinkedIn', 'Pinterest', 'TikTok', 'Threads', 'Bluesky');
  CREATE TYPE "public"."enum__settings_v_version_social_platform" AS ENUM('Facebook', 'X (Twitter)', 'Instagram', 'YouTube', 'LinkedIn', 'Pinterest', 'TikTok', 'Threads', 'Bluesky');
  CREATE TYPE "public"."enum_social_media_profiles_platform" AS ENUM('Facebook', 'X (Twitter)', 'Instagram', 'YouTube', 'LinkedIn', 'Pinterest', 'TikTok', 'Threads', 'Bluesky');
  CREATE TYPE "public"."enum_social_media_twitter_card_style" AS ENUM('summary', 'summary_large_image');
  CREATE TYPE "public"."enum_ad_management_slots_placement" AS ENUM('header', 'sidebar', 'inContent', 'stickyFooter', 'afterResult', 'midContent');
  CREATE TYPE "public"."enum_ad_management_slots_format" AS ENUM('auto', 'rectangle', 'leaderboard', 'sidebar', 'mobileBanner');
  CREATE TYPE "public"."enum_ad_management_affiliates_target_slots" AS ENUM('header', 'sidebar', 'inContent', 'stickyFooter', 'afterResult');
  CREATE TYPE "public"."enum_lead_gen_offers_offer_type" AS ENUM('pdf', 'tips');
  CREATE TYPE "public"."enum_lead_gen_offers_placement" AS ENUM('afterResult', 'sidebar', 'midContent');
  CREATE TYPE "public"."enum_audience_csv_import_status" AS ENUM('idle', 'importing', 'complete', 'failed');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"role" "enum_users_role" DEFAULT 'editor' NOT NULL,
  	"bio" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"enable_a_p_i_key" boolean,
  	"api_key" varchar,
  	"api_key_index" varchar,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"credit" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar,
  	"sizes_hero_url" varchar,
  	"sizes_hero_width" numeric,
  	"sizes_hero_height" numeric,
  	"sizes_hero_mime_type" varchar,
  	"sizes_hero_filesize" numeric,
  	"sizes_hero_filename" varchar,
  	"sizes_og_url" varchar,
  	"sizes_og_width" numeric,
  	"sizes_og_height" numeric,
  	"sizes_og_mime_type" varchar,
  	"sizes_og_filesize" numeric,
  	"sizes_og_filename" varchar
  );
  
  CREATE TABLE "categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar,
  	"kind" "enum_categories_kind" DEFAULT 'tool',
  	"description" varchar,
  	"icon" varchar,
  	"accent_color" varchar,
  	"accent" varchar,
  	"order" numeric DEFAULT 0,
  	"seo_meta_title" varchar,
  	"seo_canonical" varchar,
  	"seo_meta_description" varchar,
  	"seo_no_index" boolean DEFAULT false,
  	"seo_og_image_id" integer,
  	"seo_og_title" varchar,
  	"seo_og_description" varchar,
  	"seo_twitter_title" varchar,
  	"seo_twitter_description" varchar,
  	"seo_twitter_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "categories_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "_categories_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_name" varchar NOT NULL,
  	"version_slug" varchar,
  	"version_kind" "enum__categories_v_version_kind" DEFAULT 'tool',
  	"version_description" varchar,
  	"version_icon" varchar,
  	"version_accent_color" varchar,
  	"version_accent" varchar,
  	"version_order" numeric DEFAULT 0,
  	"version_seo_meta_title" varchar,
  	"version_seo_canonical" varchar,
  	"version_seo_meta_description" varchar,
  	"version_seo_no_index" boolean DEFAULT false,
  	"version_seo_og_image_id" integer,
  	"version_seo_og_title" varchar,
  	"version_seo_og_description" varchar,
  	"version_seo_twitter_title" varchar,
  	"version_seo_twitter_description" varchar,
  	"version_seo_twitter_image_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_categories_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "tags" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar,
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "authors_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"url" varchar
  );
  
  CREATE TABLE "authors" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar,
  	"role" varchar,
  	"credential" varchar,
  	"bio" varchar,
  	"initials" varchar,
  	"color" varchar,
  	"avatar_id" integer,
  	"schema_type" "enum_authors_schema_type" DEFAULT 'Organization',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "tools_inputs_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"value" varchar
  );
  
  CREATE TABLE "tools_inputs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"key" varchar,
  	"type" "enum_tools_inputs_type" DEFAULT 'number',
  	"required" boolean DEFAULT true,
  	"unit_metric_label" varchar,
  	"unit_imperial_label" varchar,
  	"min" numeric,
  	"max" numeric,
  	"step" numeric,
  	"default_value" numeric,
  	"help" varchar
  );
  
  CREATE TABLE "tools_outputs_bands" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"up_to" numeric,
  	"label" varchar,
  	"color" varchar
  );
  
  CREATE TABLE "tools_outputs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"label" varchar,
  	"expression" varchar,
  	"unit" varchar,
  	"decimals" numeric DEFAULT 1
  );
  
  CREATE TABLE "tools_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar
  );
  
  CREATE TABLE "tools_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"url" varchar
  );
  
  CREATE TABLE "tools" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"category_id" integer,
  	"tool_type" "enum_tools_tool_type" DEFAULT 'formula',
  	"coded_component" varchar,
  	"icon" "enum_tools_icon",
  	"gradient" "enum_tools_gradient" DEFAULT 'blue',
  	"accent_color" varchar,
  	"minutes_badge" varchar,
  	"enabled" boolean DEFAULT true,
  	"featured" boolean DEFAULT false,
  	"what_it_is" jsonb,
  	"how_calculated" jsonb,
  	"how_to_read" jsonb,
  	"seo_meta_title" varchar,
  	"seo_canonical" varchar,
  	"seo_meta_description" varchar,
  	"seo_no_index" boolean DEFAULT false,
  	"seo_og_image_id" integer,
  	"seo_og_title" varchar,
  	"seo_og_description" varchar,
  	"seo_twitter_title" varchar,
  	"seo_twitter_description" varchar,
  	"seo_twitter_image_id" integer,
  	"slug" varchar,
  	"sort_order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_tools_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "tools_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "tools_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"tools_id" integer
  );
  
  CREATE TABLE "_tools_v_version_inputs_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"value" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_tools_v_version_inputs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"key" varchar,
  	"type" "enum__tools_v_version_inputs_type" DEFAULT 'number',
  	"required" boolean DEFAULT true,
  	"unit_metric_label" varchar,
  	"unit_imperial_label" varchar,
  	"min" numeric,
  	"max" numeric,
  	"step" numeric,
  	"default_value" numeric,
  	"help" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_tools_v_version_outputs_bands" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"up_to" numeric,
  	"label" varchar,
  	"color" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_tools_v_version_outputs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"label" varchar,
  	"expression" varchar,
  	"unit" varchar,
  	"decimals" numeric DEFAULT 1,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_tools_v_version_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_tools_v_version_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"url" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_tools_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_name" varchar,
  	"version_category_id" integer,
  	"version_tool_type" "enum__tools_v_version_tool_type" DEFAULT 'formula',
  	"version_coded_component" varchar,
  	"version_icon" "enum__tools_v_version_icon",
  	"version_gradient" "enum__tools_v_version_gradient" DEFAULT 'blue',
  	"version_accent_color" varchar,
  	"version_minutes_badge" varchar,
  	"version_enabled" boolean DEFAULT true,
  	"version_featured" boolean DEFAULT false,
  	"version_what_it_is" jsonb,
  	"version_how_calculated" jsonb,
  	"version_how_to_read" jsonb,
  	"version_seo_meta_title" varchar,
  	"version_seo_canonical" varchar,
  	"version_seo_meta_description" varchar,
  	"version_seo_no_index" boolean DEFAULT false,
  	"version_seo_og_image_id" integer,
  	"version_seo_og_title" varchar,
  	"version_seo_og_description" varchar,
  	"version_seo_twitter_title" varchar,
  	"version_seo_twitter_description" varchar,
  	"version_seo_twitter_image_id" integer,
  	"version_slug" varchar,
  	"version_sort_order" numeric DEFAULT 0,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__tools_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "_tools_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "_tools_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"tools_id" integer
  );
  
  CREATE TABLE "articles_blocks_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"subtitle" varchar,
  	"cta_label" varchar,
  	"cta_url" varchar,
  	"background_image_id" integer,
  	"overlay" "enum_articles_blocks_hero_overlay" DEFAULT 'dark',
  	"block_name" varchar
  );
  
  CREATE TABLE "articles_blocks_calculator_embed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tool_id" integer,
  	"variant" "enum_articles_blocks_calculator_embed_variant" DEFAULT 'inline',
  	"block_name" varchar
  );
  
  CREATE TABLE "articles_blocks_two_column" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"image_side" "enum_articles_blocks_two_column_image_side" DEFAULT 'left',
  	"heading" varchar,
  	"text" varchar,
  	"cta_label" varchar,
  	"cta_url" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "articles_blocks_viral_hook_banner" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"hook" varchar,
  	"subtext" varchar,
  	"bg_color" varchar DEFAULT '#f0fdf4',
  	"text_color" varchar DEFAULT '#166534',
  	"cta_label" varchar,
  	"cta_url" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "articles_blocks_tool_embed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tool_id" integer,
  	"label" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "articles_blocks_people_also_ask_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar
  );
  
  CREATE TABLE "articles_blocks_people_also_ask" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "articles_blocks_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"style" "enum_articles_blocks_text_style" DEFAULT 'p',
  	"text" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "articles_blocks_list_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "articles_blocks_list" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"style" "enum_articles_blocks_list_style" DEFAULT 'unordered',
  	"block_name" varchar
  );
  
  CREATE TABLE "articles_blocks_callout" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tone" "enum_articles_blocks_callout_tone" DEFAULT 'info',
  	"title" varchar,
  	"text" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "articles_blocks_table_rows" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "articles_blocks_table" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"caption" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "articles_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar
  );
  
  CREATE TABLE "articles_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"url" varchar
  );
  
  CREATE TABLE "articles_semantic_entities" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"term" varchar,
  	"url" varchar
  );
  
  CREATE TABLE "articles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"excerpt" varchar,
  	"hero_image_id" integer,
  	"seo_meta_title" varchar,
  	"seo_canonical" varchar,
  	"seo_meta_description" varchar,
  	"seo_no_index" boolean DEFAULT false,
  	"seo_og_image_id" integer,
  	"seo_og_title" varchar,
  	"seo_og_description" varchar,
  	"seo_twitter_title" varchar,
  	"seo_twitter_description" varchar,
  	"seo_twitter_image_id" integer,
  	"ai_provider" "enum_articles_ai_provider" DEFAULT 'gemini',
  	"ai_generated" boolean DEFAULT false,
  	"reviewed_by_human" boolean DEFAULT false,
  	"ai_image_prompt" varchar,
  	"slug" varchar,
  	"category_id" integer,
  	"author_id" integer,
  	"reviewer_id" integer,
  	"publish_date" timestamp(3) with time zone,
  	"updated_date" timestamp(3) with time zone,
  	"featured" boolean DEFAULT false,
  	"primary_tool_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_articles_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "articles_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "articles_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"tools_id" integer,
  	"tags_id" integer,
  	"articles_id" integer
  );
  
  CREATE TABLE "_articles_v_blocks_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"subtitle" varchar,
  	"cta_label" varchar,
  	"cta_url" varchar,
  	"background_image_id" integer,
  	"overlay" "enum__articles_v_blocks_hero_overlay" DEFAULT 'dark',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_articles_v_blocks_calculator_embed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"tool_id" integer,
  	"variant" "enum__articles_v_blocks_calculator_embed_variant" DEFAULT 'inline',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_articles_v_blocks_two_column" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"image_side" "enum__articles_v_blocks_two_column_image_side" DEFAULT 'left',
  	"heading" varchar,
  	"text" varchar,
  	"cta_label" varchar,
  	"cta_url" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_articles_v_blocks_viral_hook_banner" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"hook" varchar,
  	"subtext" varchar,
  	"bg_color" varchar DEFAULT '#f0fdf4',
  	"text_color" varchar DEFAULT '#166534',
  	"cta_label" varchar,
  	"cta_url" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_articles_v_blocks_tool_embed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"tool_id" integer,
  	"label" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_articles_v_blocks_people_also_ask_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_articles_v_blocks_people_also_ask" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_articles_v_blocks_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"style" "enum__articles_v_blocks_text_style" DEFAULT 'p',
  	"text" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_articles_v_blocks_list_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_articles_v_blocks_list" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"style" "enum__articles_v_blocks_list_style" DEFAULT 'unordered',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_articles_v_blocks_callout" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"tone" "enum__articles_v_blocks_callout_tone" DEFAULT 'info',
  	"title" varchar,
  	"text" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_articles_v_blocks_table_rows" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_articles_v_blocks_table" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"caption" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_articles_v_version_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_articles_v_version_sources" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"url" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_articles_v_version_semantic_entities" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"term" varchar,
  	"url" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_articles_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_excerpt" varchar,
  	"version_hero_image_id" integer,
  	"version_seo_meta_title" varchar,
  	"version_seo_canonical" varchar,
  	"version_seo_meta_description" varchar,
  	"version_seo_no_index" boolean DEFAULT false,
  	"version_seo_og_image_id" integer,
  	"version_seo_og_title" varchar,
  	"version_seo_og_description" varchar,
  	"version_seo_twitter_title" varchar,
  	"version_seo_twitter_description" varchar,
  	"version_seo_twitter_image_id" integer,
  	"version_ai_provider" "enum__articles_v_version_ai_provider" DEFAULT 'gemini',
  	"version_ai_generated" boolean DEFAULT false,
  	"version_reviewed_by_human" boolean DEFAULT false,
  	"version_ai_image_prompt" varchar,
  	"version_slug" varchar,
  	"version_category_id" integer,
  	"version_author_id" integer,
  	"version_reviewer_id" integer,
  	"version_publish_date" timestamp(3) with time zone,
  	"version_updated_date" timestamp(3) with time zone,
  	"version_featured" boolean DEFAULT false,
  	"version_primary_tool_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__articles_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "_articles_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "_articles_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"tools_id" integer,
  	"tags_id" integer,
  	"articles_id" integer
  );
  
  CREATE TABLE "pages_blocks_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"subtitle" varchar,
  	"cta_label" varchar,
  	"cta_url" varchar,
  	"background_image_id" integer,
  	"overlay" "enum_pages_blocks_hero_overlay" DEFAULT 'dark',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_calculator_embed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tool_id" integer,
  	"variant" "enum_pages_blocks_calculator_embed_variant" DEFAULT 'inline',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_two_column" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"image_side" "enum_pages_blocks_two_column_image_side" DEFAULT 'left',
  	"heading" varchar,
  	"text" varchar,
  	"cta_label" varchar,
  	"cta_url" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_viral_hook_banner" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"hook" varchar,
  	"subtext" varchar,
  	"bg_color" varchar DEFAULT '#f0fdf4',
  	"text_color" varchar DEFAULT '#166534',
  	"cta_label" varchar,
  	"cta_url" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_tool_embed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tool_id" integer,
  	"label" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_people_also_ask_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar
  );
  
  CREATE TABLE "pages_blocks_people_also_ask" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"style" "enum_pages_blocks_text_style" DEFAULT 'p',
  	"text" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_list_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "pages_blocks_list" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"style" "enum_pages_blocks_list_style" DEFAULT 'unordered',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_callout" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tone" "enum_pages_blocks_callout_tone" DEFAULT 'info',
  	"title" varchar,
  	"text" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_table_rows" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "pages_blocks_table" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"caption" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"hero_image_id" integer,
  	"seo_meta_title" varchar,
  	"seo_canonical" varchar,
  	"seo_meta_description" varchar,
  	"seo_no_index" boolean DEFAULT false,
  	"seo_og_image_id" integer,
  	"seo_og_title" varchar,
  	"seo_og_description" varchar,
  	"seo_twitter_title" varchar,
  	"seo_twitter_description" varchar,
  	"seo_twitter_image_id" integer,
  	"slug" varchar,
  	"publish_date" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_pages_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "pages_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_hero" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"subtitle" varchar,
  	"cta_label" varchar,
  	"cta_url" varchar,
  	"background_image_id" integer,
  	"overlay" "enum__pages_v_blocks_hero_overlay" DEFAULT 'dark',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_calculator_embed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"tool_id" integer,
  	"variant" "enum__pages_v_blocks_calculator_embed_variant" DEFAULT 'inline',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_two_column" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"image_side" "enum__pages_v_blocks_two_column_image_side" DEFAULT 'left',
  	"heading" varchar,
  	"text" varchar,
  	"cta_label" varchar,
  	"cta_url" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_viral_hook_banner" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"hook" varchar,
  	"subtext" varchar,
  	"bg_color" varchar DEFAULT '#f0fdf4',
  	"text_color" varchar DEFAULT '#166534',
  	"cta_label" varchar,
  	"cta_url" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_tool_embed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"tool_id" integer,
  	"label" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_people_also_ask_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_people_also_ask" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"style" "enum__pages_v_blocks_text_style" DEFAULT 'p',
  	"text" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_list_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_list" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"style" "enum__pages_v_blocks_list_style" DEFAULT 'unordered',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_callout" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"tone" "enum__pages_v_blocks_callout_tone" DEFAULT 'info',
  	"title" varchar,
  	"text" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_table_rows" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_table" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"caption" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_hero_image_id" integer,
  	"version_seo_meta_title" varchar,
  	"version_seo_canonical" varchar,
  	"version_seo_meta_description" varchar,
  	"version_seo_no_index" boolean DEFAULT false,
  	"version_seo_og_image_id" integer,
  	"version_seo_og_title" varchar,
  	"version_seo_og_description" varchar,
  	"version_seo_twitter_title" varchar,
  	"version_seo_twitter_description" varchar,
  	"version_seo_twitter_image_id" integer,
  	"version_slug" varchar,
  	"version_publish_date" timestamp(3) with time zone,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__pages_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "_pages_v_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "redirects" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"from" varchar NOT NULL,
  	"to" varchar NOT NULL,
  	"type" "enum_redirects_type" DEFAULT '301',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "tool_usage" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tool_id" integer NOT NULL,
  	"session_id" varchar NOT NULL,
  	"profile_id" integer,
  	"started_at" timestamp(3) with time zone NOT NULL,
  	"completed_at" timestamp(3) with time zone,
  	"last_field_reached" varchar,
  	"total_fields_completed" numeric,
  	"total_fields" numeric,
  	"completed" boolean DEFAULT false,
  	"duration" numeric,
  	"referrer" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "personas_rules" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"match_type" "enum_personas_rules_match_type" NOT NULL,
  	"tool_id" integer,
  	"category_id" integer,
  	"min_usage" numeric DEFAULT 1
  );
  
  CREATE TABLE "personas" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"icon" varchar,
  	"color" varchar,
  	"enabled" boolean DEFAULT true,
  	"slug" varchar,
  	"profiles_count" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "profiles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"profile_id" varchar NOT NULL,
  	"tool_usage_count" numeric DEFAULT 0,
  	"last_active_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "profiles_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"personas_id" integer
  );
  
  CREATE TABLE "indexing_status" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"doc_type" varchar NOT NULL,
  	"doc_slug" varchar NOT NULL,
  	"url" varchar NOT NULL,
  	"engine" "enum_indexing_status_engine" NOT NULL,
  	"status" "enum_indexing_status_status" DEFAULT 'pending' NOT NULL,
  	"http_status" numeric,
  	"error" varchar,
  	"submitted_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "pseo_templates" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"status" "enum_pseo_templates_status" DEFAULT 'draft',
  	"headline_template" varchar NOT NULL,
  	"subheadline_template" varchar,
  	"body_template" varchar NOT NULL,
  	"cta_template" varchar,
  	"cta_link" varchar,
  	"meta_title_template" varchar NOT NULL,
  	"meta_desc_template" varchar NOT NULL,
  	"h1_template" varchar,
  	"slug_template" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "pseo_datasets" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"template_id" integer NOT NULL,
  	"status" "enum_pseo_datasets_status" DEFAULT 'draft',
  	"csv_file_id" integer NOT NULL,
  	"columns" jsonb,
  	"row_count" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "pseo_pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"status" "enum_pseo_pages_status" DEFAULT 'published',
  	"template_id" integer NOT NULL,
  	"dataset_id" integer NOT NULL,
  	"keyword" varchar,
  	"variables" jsonb,
  	"headline" varchar,
  	"subheadline" varchar,
  	"body_html" varchar,
  	"cta_text" varchar,
  	"cta_url" varchar,
  	"seo_meta_title" varchar,
  	"seo_meta_description" varchar,
  	"seo_og_image_id" integer,
  	"seo_no_index" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "leads" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"name" varchar,
  	"offer" varchar,
  	"tool" varchar,
  	"source_page" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "subscribers_interests" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_subscribers_interests",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "subscribers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"name" varchar,
  	"source" "enum_subscribers_source" DEFAULT 'web-form',
  	"subscribed_at" timestamp(3) with time zone,
  	"unsubscribed_at" timestamp(3) with time zone,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "push_subscriptions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"endpoint" varchar NOT NULL,
  	"auth_key" varchar NOT NULL,
  	"p256dh_key" varchar NOT NULL,
  	"user_agent" varchar,
  	"subscribed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "push_history" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"body" varchar,
  	"article_id" integer,
  	"url" varchar,
  	"sent_count" numeric DEFAULT 0,
  	"failed_count" numeric DEFAULT 0,
  	"errors" jsonb,
  	"sent_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_jobs_log" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"executed_at" timestamp(3) with time zone NOT NULL,
  	"completed_at" timestamp(3) with time zone NOT NULL,
  	"task_slug" "enum_payload_jobs_log_task_slug" NOT NULL,
  	"task_i_d" varchar NOT NULL,
  	"input" jsonb,
  	"output" jsonb,
  	"state" "enum_payload_jobs_log_state" NOT NULL,
  	"error" jsonb
  );
  
  CREATE TABLE "payload_jobs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"input" jsonb,
  	"completed_at" timestamp(3) with time zone,
  	"total_tried" numeric DEFAULT 0,
  	"has_error" boolean DEFAULT false,
  	"error" jsonb,
  	"task_slug" "enum_payload_jobs_task_slug",
  	"queue" varchar DEFAULT 'default',
  	"wait_until" timestamp(3) with time zone,
  	"processing" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"media_id" integer,
  	"categories_id" integer,
  	"tags_id" integer,
  	"authors_id" integer,
  	"tools_id" integer,
  	"articles_id" integer,
  	"pages_id" integer,
  	"redirects_id" integer,
  	"tool_usage_id" integer,
  	"personas_id" integer,
  	"profiles_id" integer,
  	"indexing_status_id" integer,
  	"pseo_templates_id" integer,
  	"pseo_datasets_id" integer,
  	"pseo_pages_id" integer,
  	"leads_id" integer,
  	"subscribers_id" integer,
  	"push_subscriptions_id" integer,
  	"push_history_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "settings_nav" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"href" varchar NOT NULL
  );
  
  CREATE TABLE "settings_footer_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"href" varchar NOT NULL
  );
  
  CREATE TABLE "settings_social" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"platform" "enum_settings_social_platform",
  	"url" varchar NOT NULL,
  	"color" varchar
  );
  
  CREATE TABLE "settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"site_title" varchar DEFAULT 'HealthyLifeStyles' NOT NULL,
  	"tagline" varchar DEFAULT 'Trusted Wellness',
  	"description" varchar,
  	"logo_id" integer,
  	"favicon_id" integer,
  	"primary_color" varchar DEFAULT '#22c55e',
  	"secondary_color" varchar DEFAULT '#3b82f6',
  	"default_og_image_id" integer,
  	"contact_email" varchar,
  	"copyright_text" varchar DEFAULT '© 2026 HealthyLifeStyles. All rights reserved.',
  	"ga4_id" varchar,
  	"search_console_id" varchar,
  	"ads_enabled" boolean DEFAULT false,
  	"adsense_client" varchar,
  	"affiliate_disclosure" varchar DEFAULT 'As an affiliate we may earn from qualifying purchases — at no extra cost to you.',
  	"cookie_consent_text" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "_settings_v_version_nav" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"href" varchar NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_settings_v_version_footer_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"href" varchar NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_settings_v_version_social" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"platform" "enum__settings_v_version_social_platform",
  	"url" varchar NOT NULL,
  	"color" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_settings_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"version_site_title" varchar DEFAULT 'HealthyLifeStyles' NOT NULL,
  	"version_tagline" varchar DEFAULT 'Trusted Wellness',
  	"version_description" varchar,
  	"version_logo_id" integer,
  	"version_favicon_id" integer,
  	"version_primary_color" varchar DEFAULT '#22c55e',
  	"version_secondary_color" varchar DEFAULT '#3b82f6',
  	"version_default_og_image_id" integer,
  	"version_contact_email" varchar,
  	"version_copyright_text" varchar DEFAULT '© 2026 HealthyLifeStyles. All rights reserved.',
  	"version_ga4_id" varchar,
  	"version_search_console_id" varchar,
  	"version_ads_enabled" boolean DEFAULT false,
  	"version_adsense_client" varchar,
  	"version_affiliate_disclosure" varchar DEFAULT 'As an affiliate we may earn from qualifying purchases — at no extra cost to you.',
  	"version_cookie_consent_text" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "indexing" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"index_now_key" varchar,
  	"google_service_account" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "social_media_profiles" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"platform" "enum_social_media_profiles_platform" NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "social_media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"twitter_site" varchar,
  	"facebook_app_id" varchar,
  	"publisher_url" varchar,
  	"default_share_text" varchar DEFAULT 'Check this out from HealthyLifeStyles: {title} {url}',
  	"default_og_image_id" integer,
  	"default_twitter_image_id" integer,
  	"twitter_card_style" "enum_social_media_twitter_card_style" DEFAULT 'summary_large_image',
  	"og_locale" varchar DEFAULT 'en_US',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "ad_management_slots" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"placement" "enum_ad_management_slots_placement" NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"format" "enum_ad_management_slots_format" DEFAULT 'auto',
  	"label" varchar,
  	"adsense_slot_id" varchar,
  	"custom_code" varchar,
  	"affiliate_banner_image_id" integer,
  	"affiliate_banner_alt" varchar,
  	"affiliate_banner_url" varchar,
  	"affiliate_banner_width" numeric,
  	"affiliate_banner_height" numeric
  );
  
  CREATE TABLE "ad_management_affiliates_target_slots" (
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"value" "enum_ad_management_affiliates_target_slots",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "ad_management_affiliates" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"url" varchar NOT NULL,
  	"image_id" integer NOT NULL,
  	"alt" varchar,
  	"width" numeric,
  	"height" numeric
  );
  
  CREATE TABLE "ad_management" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"adsense_enabled" boolean DEFAULT false,
  	"adsense_client" varchar,
  	"lazy_load" boolean DEFAULT true,
  	"partytown_enabled" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "lead_gen_offers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"enabled" boolean DEFAULT true,
  	"headline" varchar NOT NULL,
  	"description" varchar,
  	"offer_type" "enum_lead_gen_offers_offer_type" DEFAULT 'pdf',
  	"pdf_id" integer,
  	"tips_text" jsonb,
  	"button_label" varchar DEFAULT 'Get Your Free Report',
  	"collect_name" boolean DEFAULT true,
  	"placement" "enum_lead_gen_offers_placement" DEFAULT 'afterResult'
  );
  
  CREATE TABLE "lead_gen" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enabled" boolean DEFAULT false,
  	"success_message" varchar DEFAULT 'Thanks! Your free guide is on its way. Check your inbox shortly.',
  	"n8n_webhook_url" varchar,
  	"n8n_api_key" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "lead_gen_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"tools_id" integer
  );
  
  CREATE TABLE "audience" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"n8n_webhook_url" varchar,
  	"n8n_api_key" varchar,
  	"forward_on_create" boolean DEFAULT true,
  	"push_enabled" boolean DEFAULT false,
  	"vapid_subject" varchar,
  	"vapid_public_key" varchar,
  	"vapid_private_key" varchar,
  	"default_icon" varchar,
  	"auto_push_on_publish" boolean DEFAULT false,
  	"csv_file_id" integer,
  	"csv_email_column" varchar DEFAULT 'email',
  	"csv_name_column" varchar,
  	"csv_interests_column" varchar,
  	"csv_import_status" "enum_audience_csv_import_status" DEFAULT 'idle',
  	"csv_import_result" jsonb,
  	"projected_rpm" numeric DEFAULT 8,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_seo_og_image_id_media_id_fk" FOREIGN KEY ("seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_seo_twitter_image_id_media_id_fk" FOREIGN KEY ("seo_twitter_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories_texts" ADD CONSTRAINT "categories_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_categories_v" ADD CONSTRAINT "_categories_v_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_categories_v" ADD CONSTRAINT "_categories_v_version_seo_og_image_id_media_id_fk" FOREIGN KEY ("version_seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_categories_v" ADD CONSTRAINT "_categories_v_version_seo_twitter_image_id_media_id_fk" FOREIGN KEY ("version_seo_twitter_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_categories_v_texts" ADD CONSTRAINT "_categories_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_categories_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "authors_links" ADD CONSTRAINT "authors_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "authors" ADD CONSTRAINT "authors_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tools_inputs_options" ADD CONSTRAINT "tools_inputs_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tools_inputs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tools_inputs" ADD CONSTRAINT "tools_inputs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tools_outputs_bands" ADD CONSTRAINT "tools_outputs_bands_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tools_outputs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tools_outputs" ADD CONSTRAINT "tools_outputs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tools_faq" ADD CONSTRAINT "tools_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tools_sources" ADD CONSTRAINT "tools_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tools" ADD CONSTRAINT "tools_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tools" ADD CONSTRAINT "tools_seo_og_image_id_media_id_fk" FOREIGN KEY ("seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tools" ADD CONSTRAINT "tools_seo_twitter_image_id_media_id_fk" FOREIGN KEY ("seo_twitter_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tools_texts" ADD CONSTRAINT "tools_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tools_rels" ADD CONSTRAINT "tools_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tools_rels" ADD CONSTRAINT "tools_rels_tools_fk" FOREIGN KEY ("tools_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tools_v_version_inputs_options" ADD CONSTRAINT "_tools_v_version_inputs_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_tools_v_version_inputs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tools_v_version_inputs" ADD CONSTRAINT "_tools_v_version_inputs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_tools_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tools_v_version_outputs_bands" ADD CONSTRAINT "_tools_v_version_outputs_bands_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_tools_v_version_outputs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tools_v_version_outputs" ADD CONSTRAINT "_tools_v_version_outputs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_tools_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tools_v_version_faq" ADD CONSTRAINT "_tools_v_version_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_tools_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tools_v_version_sources" ADD CONSTRAINT "_tools_v_version_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_tools_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tools_v" ADD CONSTRAINT "_tools_v_parent_id_tools_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tools"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_tools_v" ADD CONSTRAINT "_tools_v_version_category_id_categories_id_fk" FOREIGN KEY ("version_category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_tools_v" ADD CONSTRAINT "_tools_v_version_seo_og_image_id_media_id_fk" FOREIGN KEY ("version_seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_tools_v" ADD CONSTRAINT "_tools_v_version_seo_twitter_image_id_media_id_fk" FOREIGN KEY ("version_seo_twitter_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_tools_v_texts" ADD CONSTRAINT "_tools_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_tools_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tools_v_rels" ADD CONSTRAINT "_tools_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_tools_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_tools_v_rels" ADD CONSTRAINT "_tools_v_rels_tools_fk" FOREIGN KEY ("tools_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_blocks_hero" ADD CONSTRAINT "articles_blocks_hero_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles_blocks_hero" ADD CONSTRAINT "articles_blocks_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_blocks_calculator_embed" ADD CONSTRAINT "articles_blocks_calculator_embed_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles_blocks_calculator_embed" ADD CONSTRAINT "articles_blocks_calculator_embed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_blocks_two_column" ADD CONSTRAINT "articles_blocks_two_column_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles_blocks_two_column" ADD CONSTRAINT "articles_blocks_two_column_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_blocks_viral_hook_banner" ADD CONSTRAINT "articles_blocks_viral_hook_banner_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_blocks_tool_embed" ADD CONSTRAINT "articles_blocks_tool_embed_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles_blocks_tool_embed" ADD CONSTRAINT "articles_blocks_tool_embed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_blocks_people_also_ask_items" ADD CONSTRAINT "articles_blocks_people_also_ask_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles_blocks_people_also_ask"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_blocks_people_also_ask" ADD CONSTRAINT "articles_blocks_people_also_ask_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_blocks_text" ADD CONSTRAINT "articles_blocks_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_blocks_list_items" ADD CONSTRAINT "articles_blocks_list_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles_blocks_list"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_blocks_list" ADD CONSTRAINT "articles_blocks_list_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_blocks_callout" ADD CONSTRAINT "articles_blocks_callout_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_blocks_table_rows" ADD CONSTRAINT "articles_blocks_table_rows_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles_blocks_table"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_blocks_table" ADD CONSTRAINT "articles_blocks_table_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_faq" ADD CONSTRAINT "articles_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_sources" ADD CONSTRAINT "articles_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_semantic_entities" ADD CONSTRAINT "articles_semantic_entities_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles" ADD CONSTRAINT "articles_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles" ADD CONSTRAINT "articles_seo_og_image_id_media_id_fk" FOREIGN KEY ("seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles" ADD CONSTRAINT "articles_seo_twitter_image_id_media_id_fk" FOREIGN KEY ("seo_twitter_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles" ADD CONSTRAINT "articles_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles" ADD CONSTRAINT "articles_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles" ADD CONSTRAINT "articles_reviewer_id_authors_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."authors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles" ADD CONSTRAINT "articles_primary_tool_id_tools_id_fk" FOREIGN KEY ("primary_tool_id") REFERENCES "public"."tools"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles_texts" ADD CONSTRAINT "articles_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_tools_fk" FOREIGN KEY ("tools_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_blocks_hero" ADD CONSTRAINT "_articles_v_blocks_hero_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v_blocks_hero" ADD CONSTRAINT "_articles_v_blocks_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_blocks_calculator_embed" ADD CONSTRAINT "_articles_v_blocks_calculator_embed_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v_blocks_calculator_embed" ADD CONSTRAINT "_articles_v_blocks_calculator_embed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_blocks_two_column" ADD CONSTRAINT "_articles_v_blocks_two_column_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v_blocks_two_column" ADD CONSTRAINT "_articles_v_blocks_two_column_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_blocks_viral_hook_banner" ADD CONSTRAINT "_articles_v_blocks_viral_hook_banner_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_blocks_tool_embed" ADD CONSTRAINT "_articles_v_blocks_tool_embed_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v_blocks_tool_embed" ADD CONSTRAINT "_articles_v_blocks_tool_embed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_blocks_people_also_ask_items" ADD CONSTRAINT "_articles_v_blocks_people_also_ask_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_articles_v_blocks_people_also_ask"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_blocks_people_also_ask" ADD CONSTRAINT "_articles_v_blocks_people_also_ask_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_blocks_text" ADD CONSTRAINT "_articles_v_blocks_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_blocks_list_items" ADD CONSTRAINT "_articles_v_blocks_list_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_articles_v_blocks_list"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_blocks_list" ADD CONSTRAINT "_articles_v_blocks_list_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_blocks_callout" ADD CONSTRAINT "_articles_v_blocks_callout_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_blocks_table_rows" ADD CONSTRAINT "_articles_v_blocks_table_rows_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_articles_v_blocks_table"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_blocks_table" ADD CONSTRAINT "_articles_v_blocks_table_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_version_faq" ADD CONSTRAINT "_articles_v_version_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_version_sources" ADD CONSTRAINT "_articles_v_version_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_version_semantic_entities" ADD CONSTRAINT "_articles_v_version_semantic_entities_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_parent_id_articles_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_version_hero_image_id_media_id_fk" FOREIGN KEY ("version_hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_version_seo_og_image_id_media_id_fk" FOREIGN KEY ("version_seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_version_seo_twitter_image_id_media_id_fk" FOREIGN KEY ("version_seo_twitter_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_version_category_id_categories_id_fk" FOREIGN KEY ("version_category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_version_author_id_authors_id_fk" FOREIGN KEY ("version_author_id") REFERENCES "public"."authors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_version_reviewer_id_authors_id_fk" FOREIGN KEY ("version_reviewer_id") REFERENCES "public"."authors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_version_primary_tool_id_tools_id_fk" FOREIGN KEY ("version_primary_tool_id") REFERENCES "public"."tools"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v_texts" ADD CONSTRAINT "_articles_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_rels" ADD CONSTRAINT "_articles_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_rels" ADD CONSTRAINT "_articles_v_rels_tools_fk" FOREIGN KEY ("tools_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_rels" ADD CONSTRAINT "_articles_v_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_rels" ADD CONSTRAINT "_articles_v_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero" ADD CONSTRAINT "pages_blocks_hero_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero" ADD CONSTRAINT "pages_blocks_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_calculator_embed" ADD CONSTRAINT "pages_blocks_calculator_embed_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_calculator_embed" ADD CONSTRAINT "pages_blocks_calculator_embed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_two_column" ADD CONSTRAINT "pages_blocks_two_column_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_two_column" ADD CONSTRAINT "pages_blocks_two_column_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_viral_hook_banner" ADD CONSTRAINT "pages_blocks_viral_hook_banner_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_tool_embed" ADD CONSTRAINT "pages_blocks_tool_embed_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_tool_embed" ADD CONSTRAINT "pages_blocks_tool_embed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_people_also_ask_items" ADD CONSTRAINT "pages_blocks_people_also_ask_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_people_also_ask"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_people_also_ask" ADD CONSTRAINT "pages_blocks_people_also_ask_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_text" ADD CONSTRAINT "pages_blocks_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_list_items" ADD CONSTRAINT "pages_blocks_list_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_list"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_list" ADD CONSTRAINT "pages_blocks_list_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_callout" ADD CONSTRAINT "pages_blocks_callout_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_table_rows" ADD CONSTRAINT "pages_blocks_table_rows_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_table"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_table" ADD CONSTRAINT "pages_blocks_table_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_seo_og_image_id_media_id_fk" FOREIGN KEY ("seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_seo_twitter_image_id_media_id_fk" FOREIGN KEY ("seo_twitter_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_texts" ADD CONSTRAINT "pages_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_hero" ADD CONSTRAINT "_pages_v_blocks_hero_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_hero" ADD CONSTRAINT "_pages_v_blocks_hero_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_calculator_embed" ADD CONSTRAINT "_pages_v_blocks_calculator_embed_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_calculator_embed" ADD CONSTRAINT "_pages_v_blocks_calculator_embed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_two_column" ADD CONSTRAINT "_pages_v_blocks_two_column_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_two_column" ADD CONSTRAINT "_pages_v_blocks_two_column_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_viral_hook_banner" ADD CONSTRAINT "_pages_v_blocks_viral_hook_banner_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_tool_embed" ADD CONSTRAINT "_pages_v_blocks_tool_embed_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_tool_embed" ADD CONSTRAINT "_pages_v_blocks_tool_embed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_people_also_ask_items" ADD CONSTRAINT "_pages_v_blocks_people_also_ask_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_people_also_ask"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_people_also_ask" ADD CONSTRAINT "_pages_v_blocks_people_also_ask_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_text" ADD CONSTRAINT "_pages_v_blocks_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_list_items" ADD CONSTRAINT "_pages_v_blocks_list_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_list"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_list" ADD CONSTRAINT "_pages_v_blocks_list_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_callout" ADD CONSTRAINT "_pages_v_blocks_callout_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_table_rows" ADD CONSTRAINT "_pages_v_blocks_table_rows_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_table"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_table" ADD CONSTRAINT "_pages_v_blocks_table_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_parent_id_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_hero_image_id_media_id_fk" FOREIGN KEY ("version_hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_seo_og_image_id_media_id_fk" FOREIGN KEY ("version_seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_version_seo_twitter_image_id_media_id_fk" FOREIGN KEY ("version_seo_twitter_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_texts" ADD CONSTRAINT "_pages_v_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tool_usage" ADD CONSTRAINT "tool_usage_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tool_usage" ADD CONSTRAINT "tool_usage_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "personas_rules" ADD CONSTRAINT "personas_rules_tool_id_tools_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tools"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "personas_rules" ADD CONSTRAINT "personas_rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "personas_rules" ADD CONSTRAINT "personas_rules_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."personas"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "profiles_rels" ADD CONSTRAINT "profiles_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "profiles_rels" ADD CONSTRAINT "profiles_rels_personas_fk" FOREIGN KEY ("personas_id") REFERENCES "public"."personas"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pseo_datasets" ADD CONSTRAINT "pseo_datasets_template_id_pseo_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."pseo_templates"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pseo_datasets" ADD CONSTRAINT "pseo_datasets_csv_file_id_media_id_fk" FOREIGN KEY ("csv_file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pseo_pages" ADD CONSTRAINT "pseo_pages_template_id_pseo_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."pseo_templates"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pseo_pages" ADD CONSTRAINT "pseo_pages_dataset_id_pseo_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."pseo_datasets"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pseo_pages" ADD CONSTRAINT "pseo_pages_seo_og_image_id_media_id_fk" FOREIGN KEY ("seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "subscribers_interests" ADD CONSTRAINT "subscribers_interests_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."subscribers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "push_history" ADD CONSTRAINT "push_history_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_jobs_log" ADD CONSTRAINT "payload_jobs_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_authors_fk" FOREIGN KEY ("authors_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tools_fk" FOREIGN KEY ("tools_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_redirects_fk" FOREIGN KEY ("redirects_id") REFERENCES "public"."redirects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tool_usage_fk" FOREIGN KEY ("tool_usage_id") REFERENCES "public"."tool_usage"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_personas_fk" FOREIGN KEY ("personas_id") REFERENCES "public"."personas"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_profiles_fk" FOREIGN KEY ("profiles_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_indexing_status_fk" FOREIGN KEY ("indexing_status_id") REFERENCES "public"."indexing_status"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pseo_templates_fk" FOREIGN KEY ("pseo_templates_id") REFERENCES "public"."pseo_templates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pseo_datasets_fk" FOREIGN KEY ("pseo_datasets_id") REFERENCES "public"."pseo_datasets"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pseo_pages_fk" FOREIGN KEY ("pseo_pages_id") REFERENCES "public"."pseo_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_leads_fk" FOREIGN KEY ("leads_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_subscribers_fk" FOREIGN KEY ("subscribers_id") REFERENCES "public"."subscribers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_push_subscriptions_fk" FOREIGN KEY ("push_subscriptions_id") REFERENCES "public"."push_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_push_history_fk" FOREIGN KEY ("push_history_id") REFERENCES "public"."push_history"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "settings_nav" ADD CONSTRAINT "settings_nav_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "settings_footer_links" ADD CONSTRAINT "settings_footer_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "settings_social" ADD CONSTRAINT "settings_social_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "settings" ADD CONSTRAINT "settings_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "settings" ADD CONSTRAINT "settings_favicon_id_media_id_fk" FOREIGN KEY ("favicon_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "settings" ADD CONSTRAINT "settings_default_og_image_id_media_id_fk" FOREIGN KEY ("default_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_settings_v_version_nav" ADD CONSTRAINT "_settings_v_version_nav_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_settings_v_version_footer_links" ADD CONSTRAINT "_settings_v_version_footer_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_settings_v_version_social" ADD CONSTRAINT "_settings_v_version_social_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_settings_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_settings_v" ADD CONSTRAINT "_settings_v_version_logo_id_media_id_fk" FOREIGN KEY ("version_logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_settings_v" ADD CONSTRAINT "_settings_v_version_favicon_id_media_id_fk" FOREIGN KEY ("version_favicon_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_settings_v" ADD CONSTRAINT "_settings_v_version_default_og_image_id_media_id_fk" FOREIGN KEY ("version_default_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "social_media_profiles" ADD CONSTRAINT "social_media_profiles_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."social_media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "social_media" ADD CONSTRAINT "social_media_default_og_image_id_media_id_fk" FOREIGN KEY ("default_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "social_media" ADD CONSTRAINT "social_media_default_twitter_image_id_media_id_fk" FOREIGN KEY ("default_twitter_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ad_management_slots" ADD CONSTRAINT "ad_management_slots_affiliate_banner_image_id_media_id_fk" FOREIGN KEY ("affiliate_banner_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ad_management_slots" ADD CONSTRAINT "ad_management_slots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."ad_management"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ad_management_affiliates_target_slots" ADD CONSTRAINT "ad_management_affiliates_target_slots_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."ad_management_affiliates"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "ad_management_affiliates" ADD CONSTRAINT "ad_management_affiliates_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ad_management_affiliates" ADD CONSTRAINT "ad_management_affiliates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."ad_management"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "lead_gen_offers" ADD CONSTRAINT "lead_gen_offers_pdf_id_media_id_fk" FOREIGN KEY ("pdf_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "lead_gen_offers" ADD CONSTRAINT "lead_gen_offers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."lead_gen"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "lead_gen_rels" ADD CONSTRAINT "lead_gen_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."lead_gen"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "lead_gen_rels" ADD CONSTRAINT "lead_gen_rels_tools_fk" FOREIGN KEY ("tools_id") REFERENCES "public"."tools"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "audience" ADD CONSTRAINT "audience_csv_file_id_media_id_fk" FOREIGN KEY ("csv_file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "media" USING btree ("sizes_card_filename");
  CREATE INDEX "media_sizes_hero_sizes_hero_filename_idx" ON "media" USING btree ("sizes_hero_filename");
  CREATE INDEX "media_sizes_og_sizes_og_filename_idx" ON "media" USING btree ("sizes_og_filename");
  CREATE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");
  CREATE INDEX "categories_seo_seo_og_image_idx" ON "categories" USING btree ("seo_og_image_id");
  CREATE INDEX "categories_seo_seo_twitter_image_idx" ON "categories" USING btree ("seo_twitter_image_id");
  CREATE INDEX "categories_updated_at_idx" ON "categories" USING btree ("updated_at");
  CREATE INDEX "categories_created_at_idx" ON "categories" USING btree ("created_at");
  CREATE INDEX "categories_texts_order_parent" ON "categories_texts" USING btree ("order","parent_id");
  CREATE INDEX "_categories_v_parent_idx" ON "_categories_v" USING btree ("parent_id");
  CREATE INDEX "_categories_v_version_version_slug_idx" ON "_categories_v" USING btree ("version_slug");
  CREATE INDEX "_categories_v_version_seo_version_seo_og_image_idx" ON "_categories_v" USING btree ("version_seo_og_image_id");
  CREATE INDEX "_categories_v_version_seo_version_seo_twitter_image_idx" ON "_categories_v" USING btree ("version_seo_twitter_image_id");
  CREATE INDEX "_categories_v_version_version_updated_at_idx" ON "_categories_v" USING btree ("version_updated_at");
  CREATE INDEX "_categories_v_version_version_created_at_idx" ON "_categories_v" USING btree ("version_created_at");
  CREATE INDEX "_categories_v_created_at_idx" ON "_categories_v" USING btree ("created_at");
  CREATE INDEX "_categories_v_updated_at_idx" ON "_categories_v" USING btree ("updated_at");
  CREATE INDEX "_categories_v_texts_order_parent" ON "_categories_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "tags_slug_idx" ON "tags" USING btree ("slug");
  CREATE INDEX "tags_updated_at_idx" ON "tags" USING btree ("updated_at");
  CREATE INDEX "tags_created_at_idx" ON "tags" USING btree ("created_at");
  CREATE INDEX "authors_links_order_idx" ON "authors_links" USING btree ("_order");
  CREATE INDEX "authors_links_parent_id_idx" ON "authors_links" USING btree ("_parent_id");
  CREATE INDEX "authors_slug_idx" ON "authors" USING btree ("slug");
  CREATE INDEX "authors_avatar_idx" ON "authors" USING btree ("avatar_id");
  CREATE INDEX "authors_updated_at_idx" ON "authors" USING btree ("updated_at");
  CREATE INDEX "authors_created_at_idx" ON "authors" USING btree ("created_at");
  CREATE INDEX "tools_inputs_options_order_idx" ON "tools_inputs_options" USING btree ("_order");
  CREATE INDEX "tools_inputs_options_parent_id_idx" ON "tools_inputs_options" USING btree ("_parent_id");
  CREATE INDEX "tools_inputs_order_idx" ON "tools_inputs" USING btree ("_order");
  CREATE INDEX "tools_inputs_parent_id_idx" ON "tools_inputs" USING btree ("_parent_id");
  CREATE INDEX "tools_outputs_bands_order_idx" ON "tools_outputs_bands" USING btree ("_order");
  CREATE INDEX "tools_outputs_bands_parent_id_idx" ON "tools_outputs_bands" USING btree ("_parent_id");
  CREATE INDEX "tools_outputs_order_idx" ON "tools_outputs" USING btree ("_order");
  CREATE INDEX "tools_outputs_parent_id_idx" ON "tools_outputs" USING btree ("_parent_id");
  CREATE INDEX "tools_faq_order_idx" ON "tools_faq" USING btree ("_order");
  CREATE INDEX "tools_faq_parent_id_idx" ON "tools_faq" USING btree ("_parent_id");
  CREATE INDEX "tools_sources_order_idx" ON "tools_sources" USING btree ("_order");
  CREATE INDEX "tools_sources_parent_id_idx" ON "tools_sources" USING btree ("_parent_id");
  CREATE INDEX "tools_category_idx" ON "tools" USING btree ("category_id");
  CREATE INDEX "tools_seo_seo_og_image_idx" ON "tools" USING btree ("seo_og_image_id");
  CREATE INDEX "tools_seo_seo_twitter_image_idx" ON "tools" USING btree ("seo_twitter_image_id");
  CREATE INDEX "tools_slug_idx" ON "tools" USING btree ("slug");
  CREATE INDEX "tools_updated_at_idx" ON "tools" USING btree ("updated_at");
  CREATE INDEX "tools_created_at_idx" ON "tools" USING btree ("created_at");
  CREATE INDEX "tools__status_idx" ON "tools" USING btree ("_status");
  CREATE INDEX "tools_texts_order_parent" ON "tools_texts" USING btree ("order","parent_id");
  CREATE INDEX "tools_rels_order_idx" ON "tools_rels" USING btree ("order");
  CREATE INDEX "tools_rels_parent_idx" ON "tools_rels" USING btree ("parent_id");
  CREATE INDEX "tools_rels_path_idx" ON "tools_rels" USING btree ("path");
  CREATE INDEX "tools_rels_tools_id_idx" ON "tools_rels" USING btree ("tools_id");
  CREATE INDEX "_tools_v_version_inputs_options_order_idx" ON "_tools_v_version_inputs_options" USING btree ("_order");
  CREATE INDEX "_tools_v_version_inputs_options_parent_id_idx" ON "_tools_v_version_inputs_options" USING btree ("_parent_id");
  CREATE INDEX "_tools_v_version_inputs_order_idx" ON "_tools_v_version_inputs" USING btree ("_order");
  CREATE INDEX "_tools_v_version_inputs_parent_id_idx" ON "_tools_v_version_inputs" USING btree ("_parent_id");
  CREATE INDEX "_tools_v_version_outputs_bands_order_idx" ON "_tools_v_version_outputs_bands" USING btree ("_order");
  CREATE INDEX "_tools_v_version_outputs_bands_parent_id_idx" ON "_tools_v_version_outputs_bands" USING btree ("_parent_id");
  CREATE INDEX "_tools_v_version_outputs_order_idx" ON "_tools_v_version_outputs" USING btree ("_order");
  CREATE INDEX "_tools_v_version_outputs_parent_id_idx" ON "_tools_v_version_outputs" USING btree ("_parent_id");
  CREATE INDEX "_tools_v_version_faq_order_idx" ON "_tools_v_version_faq" USING btree ("_order");
  CREATE INDEX "_tools_v_version_faq_parent_id_idx" ON "_tools_v_version_faq" USING btree ("_parent_id");
  CREATE INDEX "_tools_v_version_sources_order_idx" ON "_tools_v_version_sources" USING btree ("_order");
  CREATE INDEX "_tools_v_version_sources_parent_id_idx" ON "_tools_v_version_sources" USING btree ("_parent_id");
  CREATE INDEX "_tools_v_parent_idx" ON "_tools_v" USING btree ("parent_id");
  CREATE INDEX "_tools_v_version_version_category_idx" ON "_tools_v" USING btree ("version_category_id");
  CREATE INDEX "_tools_v_version_seo_version_seo_og_image_idx" ON "_tools_v" USING btree ("version_seo_og_image_id");
  CREATE INDEX "_tools_v_version_seo_version_seo_twitter_image_idx" ON "_tools_v" USING btree ("version_seo_twitter_image_id");
  CREATE INDEX "_tools_v_version_version_slug_idx" ON "_tools_v" USING btree ("version_slug");
  CREATE INDEX "_tools_v_version_version_updated_at_idx" ON "_tools_v" USING btree ("version_updated_at");
  CREATE INDEX "_tools_v_version_version_created_at_idx" ON "_tools_v" USING btree ("version_created_at");
  CREATE INDEX "_tools_v_version_version__status_idx" ON "_tools_v" USING btree ("version__status");
  CREATE INDEX "_tools_v_created_at_idx" ON "_tools_v" USING btree ("created_at");
  CREATE INDEX "_tools_v_updated_at_idx" ON "_tools_v" USING btree ("updated_at");
  CREATE INDEX "_tools_v_latest_idx" ON "_tools_v" USING btree ("latest");
  CREATE INDEX "_tools_v_autosave_idx" ON "_tools_v" USING btree ("autosave");
  CREATE INDEX "_tools_v_texts_order_parent" ON "_tools_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "_tools_v_rels_order_idx" ON "_tools_v_rels" USING btree ("order");
  CREATE INDEX "_tools_v_rels_parent_idx" ON "_tools_v_rels" USING btree ("parent_id");
  CREATE INDEX "_tools_v_rels_path_idx" ON "_tools_v_rels" USING btree ("path");
  CREATE INDEX "_tools_v_rels_tools_id_idx" ON "_tools_v_rels" USING btree ("tools_id");
  CREATE INDEX "articles_blocks_hero_order_idx" ON "articles_blocks_hero" USING btree ("_order");
  CREATE INDEX "articles_blocks_hero_parent_id_idx" ON "articles_blocks_hero" USING btree ("_parent_id");
  CREATE INDEX "articles_blocks_hero_path_idx" ON "articles_blocks_hero" USING btree ("_path");
  CREATE INDEX "articles_blocks_hero_background_image_idx" ON "articles_blocks_hero" USING btree ("background_image_id");
  CREATE INDEX "articles_blocks_calculator_embed_order_idx" ON "articles_blocks_calculator_embed" USING btree ("_order");
  CREATE INDEX "articles_blocks_calculator_embed_parent_id_idx" ON "articles_blocks_calculator_embed" USING btree ("_parent_id");
  CREATE INDEX "articles_blocks_calculator_embed_path_idx" ON "articles_blocks_calculator_embed" USING btree ("_path");
  CREATE INDEX "articles_blocks_calculator_embed_tool_idx" ON "articles_blocks_calculator_embed" USING btree ("tool_id");
  CREATE INDEX "articles_blocks_two_column_order_idx" ON "articles_blocks_two_column" USING btree ("_order");
  CREATE INDEX "articles_blocks_two_column_parent_id_idx" ON "articles_blocks_two_column" USING btree ("_parent_id");
  CREATE INDEX "articles_blocks_two_column_path_idx" ON "articles_blocks_two_column" USING btree ("_path");
  CREATE INDEX "articles_blocks_two_column_image_idx" ON "articles_blocks_two_column" USING btree ("image_id");
  CREATE INDEX "articles_blocks_viral_hook_banner_order_idx" ON "articles_blocks_viral_hook_banner" USING btree ("_order");
  CREATE INDEX "articles_blocks_viral_hook_banner_parent_id_idx" ON "articles_blocks_viral_hook_banner" USING btree ("_parent_id");
  CREATE INDEX "articles_blocks_viral_hook_banner_path_idx" ON "articles_blocks_viral_hook_banner" USING btree ("_path");
  CREATE INDEX "articles_blocks_tool_embed_order_idx" ON "articles_blocks_tool_embed" USING btree ("_order");
  CREATE INDEX "articles_blocks_tool_embed_parent_id_idx" ON "articles_blocks_tool_embed" USING btree ("_parent_id");
  CREATE INDEX "articles_blocks_tool_embed_path_idx" ON "articles_blocks_tool_embed" USING btree ("_path");
  CREATE INDEX "articles_blocks_tool_embed_tool_idx" ON "articles_blocks_tool_embed" USING btree ("tool_id");
  CREATE INDEX "articles_blocks_people_also_ask_items_order_idx" ON "articles_blocks_people_also_ask_items" USING btree ("_order");
  CREATE INDEX "articles_blocks_people_also_ask_items_parent_id_idx" ON "articles_blocks_people_also_ask_items" USING btree ("_parent_id");
  CREATE INDEX "articles_blocks_people_also_ask_order_idx" ON "articles_blocks_people_also_ask" USING btree ("_order");
  CREATE INDEX "articles_blocks_people_also_ask_parent_id_idx" ON "articles_blocks_people_also_ask" USING btree ("_parent_id");
  CREATE INDEX "articles_blocks_people_also_ask_path_idx" ON "articles_blocks_people_also_ask" USING btree ("_path");
  CREATE INDEX "articles_blocks_text_order_idx" ON "articles_blocks_text" USING btree ("_order");
  CREATE INDEX "articles_blocks_text_parent_id_idx" ON "articles_blocks_text" USING btree ("_parent_id");
  CREATE INDEX "articles_blocks_text_path_idx" ON "articles_blocks_text" USING btree ("_path");
  CREATE INDEX "articles_blocks_list_items_order_idx" ON "articles_blocks_list_items" USING btree ("_order");
  CREATE INDEX "articles_blocks_list_items_parent_id_idx" ON "articles_blocks_list_items" USING btree ("_parent_id");
  CREATE INDEX "articles_blocks_list_order_idx" ON "articles_blocks_list" USING btree ("_order");
  CREATE INDEX "articles_blocks_list_parent_id_idx" ON "articles_blocks_list" USING btree ("_parent_id");
  CREATE INDEX "articles_blocks_list_path_idx" ON "articles_blocks_list" USING btree ("_path");
  CREATE INDEX "articles_blocks_callout_order_idx" ON "articles_blocks_callout" USING btree ("_order");
  CREATE INDEX "articles_blocks_callout_parent_id_idx" ON "articles_blocks_callout" USING btree ("_parent_id");
  CREATE INDEX "articles_blocks_callout_path_idx" ON "articles_blocks_callout" USING btree ("_path");
  CREATE INDEX "articles_blocks_table_rows_order_idx" ON "articles_blocks_table_rows" USING btree ("_order");
  CREATE INDEX "articles_blocks_table_rows_parent_id_idx" ON "articles_blocks_table_rows" USING btree ("_parent_id");
  CREATE INDEX "articles_blocks_table_order_idx" ON "articles_blocks_table" USING btree ("_order");
  CREATE INDEX "articles_blocks_table_parent_id_idx" ON "articles_blocks_table" USING btree ("_parent_id");
  CREATE INDEX "articles_blocks_table_path_idx" ON "articles_blocks_table" USING btree ("_path");
  CREATE INDEX "articles_faq_order_idx" ON "articles_faq" USING btree ("_order");
  CREATE INDEX "articles_faq_parent_id_idx" ON "articles_faq" USING btree ("_parent_id");
  CREATE INDEX "articles_sources_order_idx" ON "articles_sources" USING btree ("_order");
  CREATE INDEX "articles_sources_parent_id_idx" ON "articles_sources" USING btree ("_parent_id");
  CREATE INDEX "articles_semantic_entities_order_idx" ON "articles_semantic_entities" USING btree ("_order");
  CREATE INDEX "articles_semantic_entities_parent_id_idx" ON "articles_semantic_entities" USING btree ("_parent_id");
  CREATE INDEX "articles_hero_image_idx" ON "articles" USING btree ("hero_image_id");
  CREATE INDEX "articles_seo_seo_og_image_idx" ON "articles" USING btree ("seo_og_image_id");
  CREATE INDEX "articles_seo_seo_twitter_image_idx" ON "articles" USING btree ("seo_twitter_image_id");
  CREATE INDEX "articles_slug_idx" ON "articles" USING btree ("slug");
  CREATE INDEX "articles_category_idx" ON "articles" USING btree ("category_id");
  CREATE INDEX "articles_author_idx" ON "articles" USING btree ("author_id");
  CREATE INDEX "articles_reviewer_idx" ON "articles" USING btree ("reviewer_id");
  CREATE INDEX "articles_primary_tool_idx" ON "articles" USING btree ("primary_tool_id");
  CREATE INDEX "articles_updated_at_idx" ON "articles" USING btree ("updated_at");
  CREATE INDEX "articles_created_at_idx" ON "articles" USING btree ("created_at");
  CREATE INDEX "articles__status_idx" ON "articles" USING btree ("_status");
  CREATE INDEX "articles_texts_order_parent" ON "articles_texts" USING btree ("order","parent_id");
  CREATE INDEX "articles_rels_order_idx" ON "articles_rels" USING btree ("order");
  CREATE INDEX "articles_rels_parent_idx" ON "articles_rels" USING btree ("parent_id");
  CREATE INDEX "articles_rels_path_idx" ON "articles_rels" USING btree ("path");
  CREATE INDEX "articles_rels_tools_id_idx" ON "articles_rels" USING btree ("tools_id");
  CREATE INDEX "articles_rels_tags_id_idx" ON "articles_rels" USING btree ("tags_id");
  CREATE INDEX "articles_rels_articles_id_idx" ON "articles_rels" USING btree ("articles_id");
  CREATE INDEX "_articles_v_blocks_hero_order_idx" ON "_articles_v_blocks_hero" USING btree ("_order");
  CREATE INDEX "_articles_v_blocks_hero_parent_id_idx" ON "_articles_v_blocks_hero" USING btree ("_parent_id");
  CREATE INDEX "_articles_v_blocks_hero_path_idx" ON "_articles_v_blocks_hero" USING btree ("_path");
  CREATE INDEX "_articles_v_blocks_hero_background_image_idx" ON "_articles_v_blocks_hero" USING btree ("background_image_id");
  CREATE INDEX "_articles_v_blocks_calculator_embed_order_idx" ON "_articles_v_blocks_calculator_embed" USING btree ("_order");
  CREATE INDEX "_articles_v_blocks_calculator_embed_parent_id_idx" ON "_articles_v_blocks_calculator_embed" USING btree ("_parent_id");
  CREATE INDEX "_articles_v_blocks_calculator_embed_path_idx" ON "_articles_v_blocks_calculator_embed" USING btree ("_path");
  CREATE INDEX "_articles_v_blocks_calculator_embed_tool_idx" ON "_articles_v_blocks_calculator_embed" USING btree ("tool_id");
  CREATE INDEX "_articles_v_blocks_two_column_order_idx" ON "_articles_v_blocks_two_column" USING btree ("_order");
  CREATE INDEX "_articles_v_blocks_two_column_parent_id_idx" ON "_articles_v_blocks_two_column" USING btree ("_parent_id");
  CREATE INDEX "_articles_v_blocks_two_column_path_idx" ON "_articles_v_blocks_two_column" USING btree ("_path");
  CREATE INDEX "_articles_v_blocks_two_column_image_idx" ON "_articles_v_blocks_two_column" USING btree ("image_id");
  CREATE INDEX "_articles_v_blocks_viral_hook_banner_order_idx" ON "_articles_v_blocks_viral_hook_banner" USING btree ("_order");
  CREATE INDEX "_articles_v_blocks_viral_hook_banner_parent_id_idx" ON "_articles_v_blocks_viral_hook_banner" USING btree ("_parent_id");
  CREATE INDEX "_articles_v_blocks_viral_hook_banner_path_idx" ON "_articles_v_blocks_viral_hook_banner" USING btree ("_path");
  CREATE INDEX "_articles_v_blocks_tool_embed_order_idx" ON "_articles_v_blocks_tool_embed" USING btree ("_order");
  CREATE INDEX "_articles_v_blocks_tool_embed_parent_id_idx" ON "_articles_v_blocks_tool_embed" USING btree ("_parent_id");
  CREATE INDEX "_articles_v_blocks_tool_embed_path_idx" ON "_articles_v_blocks_tool_embed" USING btree ("_path");
  CREATE INDEX "_articles_v_blocks_tool_embed_tool_idx" ON "_articles_v_blocks_tool_embed" USING btree ("tool_id");
  CREATE INDEX "_articles_v_blocks_people_also_ask_items_order_idx" ON "_articles_v_blocks_people_also_ask_items" USING btree ("_order");
  CREATE INDEX "_articles_v_blocks_people_also_ask_items_parent_id_idx" ON "_articles_v_blocks_people_also_ask_items" USING btree ("_parent_id");
  CREATE INDEX "_articles_v_blocks_people_also_ask_order_idx" ON "_articles_v_blocks_people_also_ask" USING btree ("_order");
  CREATE INDEX "_articles_v_blocks_people_also_ask_parent_id_idx" ON "_articles_v_blocks_people_also_ask" USING btree ("_parent_id");
  CREATE INDEX "_articles_v_blocks_people_also_ask_path_idx" ON "_articles_v_blocks_people_also_ask" USING btree ("_path");
  CREATE INDEX "_articles_v_blocks_text_order_idx" ON "_articles_v_blocks_text" USING btree ("_order");
  CREATE INDEX "_articles_v_blocks_text_parent_id_idx" ON "_articles_v_blocks_text" USING btree ("_parent_id");
  CREATE INDEX "_articles_v_blocks_text_path_idx" ON "_articles_v_blocks_text" USING btree ("_path");
  CREATE INDEX "_articles_v_blocks_list_items_order_idx" ON "_articles_v_blocks_list_items" USING btree ("_order");
  CREATE INDEX "_articles_v_blocks_list_items_parent_id_idx" ON "_articles_v_blocks_list_items" USING btree ("_parent_id");
  CREATE INDEX "_articles_v_blocks_list_order_idx" ON "_articles_v_blocks_list" USING btree ("_order");
  CREATE INDEX "_articles_v_blocks_list_parent_id_idx" ON "_articles_v_blocks_list" USING btree ("_parent_id");
  CREATE INDEX "_articles_v_blocks_list_path_idx" ON "_articles_v_blocks_list" USING btree ("_path");
  CREATE INDEX "_articles_v_blocks_callout_order_idx" ON "_articles_v_blocks_callout" USING btree ("_order");
  CREATE INDEX "_articles_v_blocks_callout_parent_id_idx" ON "_articles_v_blocks_callout" USING btree ("_parent_id");
  CREATE INDEX "_articles_v_blocks_callout_path_idx" ON "_articles_v_blocks_callout" USING btree ("_path");
  CREATE INDEX "_articles_v_blocks_table_rows_order_idx" ON "_articles_v_blocks_table_rows" USING btree ("_order");
  CREATE INDEX "_articles_v_blocks_table_rows_parent_id_idx" ON "_articles_v_blocks_table_rows" USING btree ("_parent_id");
  CREATE INDEX "_articles_v_blocks_table_order_idx" ON "_articles_v_blocks_table" USING btree ("_order");
  CREATE INDEX "_articles_v_blocks_table_parent_id_idx" ON "_articles_v_blocks_table" USING btree ("_parent_id");
  CREATE INDEX "_articles_v_blocks_table_path_idx" ON "_articles_v_blocks_table" USING btree ("_path");
  CREATE INDEX "_articles_v_version_faq_order_idx" ON "_articles_v_version_faq" USING btree ("_order");
  CREATE INDEX "_articles_v_version_faq_parent_id_idx" ON "_articles_v_version_faq" USING btree ("_parent_id");
  CREATE INDEX "_articles_v_version_sources_order_idx" ON "_articles_v_version_sources" USING btree ("_order");
  CREATE INDEX "_articles_v_version_sources_parent_id_idx" ON "_articles_v_version_sources" USING btree ("_parent_id");
  CREATE INDEX "_articles_v_version_semantic_entities_order_idx" ON "_articles_v_version_semantic_entities" USING btree ("_order");
  CREATE INDEX "_articles_v_version_semantic_entities_parent_id_idx" ON "_articles_v_version_semantic_entities" USING btree ("_parent_id");
  CREATE INDEX "_articles_v_parent_idx" ON "_articles_v" USING btree ("parent_id");
  CREATE INDEX "_articles_v_version_version_hero_image_idx" ON "_articles_v" USING btree ("version_hero_image_id");
  CREATE INDEX "_articles_v_version_seo_version_seo_og_image_idx" ON "_articles_v" USING btree ("version_seo_og_image_id");
  CREATE INDEX "_articles_v_version_seo_version_seo_twitter_image_idx" ON "_articles_v" USING btree ("version_seo_twitter_image_id");
  CREATE INDEX "_articles_v_version_version_slug_idx" ON "_articles_v" USING btree ("version_slug");
  CREATE INDEX "_articles_v_version_version_category_idx" ON "_articles_v" USING btree ("version_category_id");
  CREATE INDEX "_articles_v_version_version_author_idx" ON "_articles_v" USING btree ("version_author_id");
  CREATE INDEX "_articles_v_version_version_reviewer_idx" ON "_articles_v" USING btree ("version_reviewer_id");
  CREATE INDEX "_articles_v_version_version_primary_tool_idx" ON "_articles_v" USING btree ("version_primary_tool_id");
  CREATE INDEX "_articles_v_version_version_updated_at_idx" ON "_articles_v" USING btree ("version_updated_at");
  CREATE INDEX "_articles_v_version_version_created_at_idx" ON "_articles_v" USING btree ("version_created_at");
  CREATE INDEX "_articles_v_version_version__status_idx" ON "_articles_v" USING btree ("version__status");
  CREATE INDEX "_articles_v_created_at_idx" ON "_articles_v" USING btree ("created_at");
  CREATE INDEX "_articles_v_updated_at_idx" ON "_articles_v" USING btree ("updated_at");
  CREATE INDEX "_articles_v_latest_idx" ON "_articles_v" USING btree ("latest");
  CREATE INDEX "_articles_v_autosave_idx" ON "_articles_v" USING btree ("autosave");
  CREATE INDEX "_articles_v_texts_order_parent" ON "_articles_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "_articles_v_rels_order_idx" ON "_articles_v_rels" USING btree ("order");
  CREATE INDEX "_articles_v_rels_parent_idx" ON "_articles_v_rels" USING btree ("parent_id");
  CREATE INDEX "_articles_v_rels_path_idx" ON "_articles_v_rels" USING btree ("path");
  CREATE INDEX "_articles_v_rels_tools_id_idx" ON "_articles_v_rels" USING btree ("tools_id");
  CREATE INDEX "_articles_v_rels_tags_id_idx" ON "_articles_v_rels" USING btree ("tags_id");
  CREATE INDEX "_articles_v_rels_articles_id_idx" ON "_articles_v_rels" USING btree ("articles_id");
  CREATE INDEX "pages_blocks_hero_order_idx" ON "pages_blocks_hero" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_parent_id_idx" ON "pages_blocks_hero" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_path_idx" ON "pages_blocks_hero" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_background_image_idx" ON "pages_blocks_hero" USING btree ("background_image_id");
  CREATE INDEX "pages_blocks_calculator_embed_order_idx" ON "pages_blocks_calculator_embed" USING btree ("_order");
  CREATE INDEX "pages_blocks_calculator_embed_parent_id_idx" ON "pages_blocks_calculator_embed" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_calculator_embed_path_idx" ON "pages_blocks_calculator_embed" USING btree ("_path");
  CREATE INDEX "pages_blocks_calculator_embed_tool_idx" ON "pages_blocks_calculator_embed" USING btree ("tool_id");
  CREATE INDEX "pages_blocks_two_column_order_idx" ON "pages_blocks_two_column" USING btree ("_order");
  CREATE INDEX "pages_blocks_two_column_parent_id_idx" ON "pages_blocks_two_column" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_two_column_path_idx" ON "pages_blocks_two_column" USING btree ("_path");
  CREATE INDEX "pages_blocks_two_column_image_idx" ON "pages_blocks_two_column" USING btree ("image_id");
  CREATE INDEX "pages_blocks_viral_hook_banner_order_idx" ON "pages_blocks_viral_hook_banner" USING btree ("_order");
  CREATE INDEX "pages_blocks_viral_hook_banner_parent_id_idx" ON "pages_blocks_viral_hook_banner" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_viral_hook_banner_path_idx" ON "pages_blocks_viral_hook_banner" USING btree ("_path");
  CREATE INDEX "pages_blocks_tool_embed_order_idx" ON "pages_blocks_tool_embed" USING btree ("_order");
  CREATE INDEX "pages_blocks_tool_embed_parent_id_idx" ON "pages_blocks_tool_embed" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_tool_embed_path_idx" ON "pages_blocks_tool_embed" USING btree ("_path");
  CREATE INDEX "pages_blocks_tool_embed_tool_idx" ON "pages_blocks_tool_embed" USING btree ("tool_id");
  CREATE INDEX "pages_blocks_people_also_ask_items_order_idx" ON "pages_blocks_people_also_ask_items" USING btree ("_order");
  CREATE INDEX "pages_blocks_people_also_ask_items_parent_id_idx" ON "pages_blocks_people_also_ask_items" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_people_also_ask_order_idx" ON "pages_blocks_people_also_ask" USING btree ("_order");
  CREATE INDEX "pages_blocks_people_also_ask_parent_id_idx" ON "pages_blocks_people_also_ask" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_people_also_ask_path_idx" ON "pages_blocks_people_also_ask" USING btree ("_path");
  CREATE INDEX "pages_blocks_text_order_idx" ON "pages_blocks_text" USING btree ("_order");
  CREATE INDEX "pages_blocks_text_parent_id_idx" ON "pages_blocks_text" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_text_path_idx" ON "pages_blocks_text" USING btree ("_path");
  CREATE INDEX "pages_blocks_list_items_order_idx" ON "pages_blocks_list_items" USING btree ("_order");
  CREATE INDEX "pages_blocks_list_items_parent_id_idx" ON "pages_blocks_list_items" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_list_order_idx" ON "pages_blocks_list" USING btree ("_order");
  CREATE INDEX "pages_blocks_list_parent_id_idx" ON "pages_blocks_list" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_list_path_idx" ON "pages_blocks_list" USING btree ("_path");
  CREATE INDEX "pages_blocks_callout_order_idx" ON "pages_blocks_callout" USING btree ("_order");
  CREATE INDEX "pages_blocks_callout_parent_id_idx" ON "pages_blocks_callout" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_callout_path_idx" ON "pages_blocks_callout" USING btree ("_path");
  CREATE INDEX "pages_blocks_table_rows_order_idx" ON "pages_blocks_table_rows" USING btree ("_order");
  CREATE INDEX "pages_blocks_table_rows_parent_id_idx" ON "pages_blocks_table_rows" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_table_order_idx" ON "pages_blocks_table" USING btree ("_order");
  CREATE INDEX "pages_blocks_table_parent_id_idx" ON "pages_blocks_table" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_table_path_idx" ON "pages_blocks_table" USING btree ("_path");
  CREATE INDEX "pages_hero_image_idx" ON "pages" USING btree ("hero_image_id");
  CREATE INDEX "pages_seo_seo_og_image_idx" ON "pages" USING btree ("seo_og_image_id");
  CREATE INDEX "pages_seo_seo_twitter_image_idx" ON "pages" USING btree ("seo_twitter_image_id");
  CREATE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");
  CREATE INDEX "pages_updated_at_idx" ON "pages" USING btree ("updated_at");
  CREATE INDEX "pages_created_at_idx" ON "pages" USING btree ("created_at");
  CREATE INDEX "pages__status_idx" ON "pages" USING btree ("_status");
  CREATE INDEX "pages_texts_order_parent" ON "pages_texts" USING btree ("order","parent_id");
  CREATE INDEX "_pages_v_blocks_hero_order_idx" ON "_pages_v_blocks_hero" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_hero_parent_id_idx" ON "_pages_v_blocks_hero" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_hero_path_idx" ON "_pages_v_blocks_hero" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_hero_background_image_idx" ON "_pages_v_blocks_hero" USING btree ("background_image_id");
  CREATE INDEX "_pages_v_blocks_calculator_embed_order_idx" ON "_pages_v_blocks_calculator_embed" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_calculator_embed_parent_id_idx" ON "_pages_v_blocks_calculator_embed" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_calculator_embed_path_idx" ON "_pages_v_blocks_calculator_embed" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_calculator_embed_tool_idx" ON "_pages_v_blocks_calculator_embed" USING btree ("tool_id");
  CREATE INDEX "_pages_v_blocks_two_column_order_idx" ON "_pages_v_blocks_two_column" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_two_column_parent_id_idx" ON "_pages_v_blocks_two_column" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_two_column_path_idx" ON "_pages_v_blocks_two_column" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_two_column_image_idx" ON "_pages_v_blocks_two_column" USING btree ("image_id");
  CREATE INDEX "_pages_v_blocks_viral_hook_banner_order_idx" ON "_pages_v_blocks_viral_hook_banner" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_viral_hook_banner_parent_id_idx" ON "_pages_v_blocks_viral_hook_banner" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_viral_hook_banner_path_idx" ON "_pages_v_blocks_viral_hook_banner" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_tool_embed_order_idx" ON "_pages_v_blocks_tool_embed" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_tool_embed_parent_id_idx" ON "_pages_v_blocks_tool_embed" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_tool_embed_path_idx" ON "_pages_v_blocks_tool_embed" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_tool_embed_tool_idx" ON "_pages_v_blocks_tool_embed" USING btree ("tool_id");
  CREATE INDEX "_pages_v_blocks_people_also_ask_items_order_idx" ON "_pages_v_blocks_people_also_ask_items" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_people_also_ask_items_parent_id_idx" ON "_pages_v_blocks_people_also_ask_items" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_people_also_ask_order_idx" ON "_pages_v_blocks_people_also_ask" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_people_also_ask_parent_id_idx" ON "_pages_v_blocks_people_also_ask" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_people_also_ask_path_idx" ON "_pages_v_blocks_people_also_ask" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_text_order_idx" ON "_pages_v_blocks_text" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_text_parent_id_idx" ON "_pages_v_blocks_text" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_text_path_idx" ON "_pages_v_blocks_text" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_list_items_order_idx" ON "_pages_v_blocks_list_items" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_list_items_parent_id_idx" ON "_pages_v_blocks_list_items" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_list_order_idx" ON "_pages_v_blocks_list" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_list_parent_id_idx" ON "_pages_v_blocks_list" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_list_path_idx" ON "_pages_v_blocks_list" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_callout_order_idx" ON "_pages_v_blocks_callout" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_callout_parent_id_idx" ON "_pages_v_blocks_callout" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_callout_path_idx" ON "_pages_v_blocks_callout" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_table_rows_order_idx" ON "_pages_v_blocks_table_rows" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_table_rows_parent_id_idx" ON "_pages_v_blocks_table_rows" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_table_order_idx" ON "_pages_v_blocks_table" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_table_parent_id_idx" ON "_pages_v_blocks_table" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_table_path_idx" ON "_pages_v_blocks_table" USING btree ("_path");
  CREATE INDEX "_pages_v_parent_idx" ON "_pages_v" USING btree ("parent_id");
  CREATE INDEX "_pages_v_version_version_hero_image_idx" ON "_pages_v" USING btree ("version_hero_image_id");
  CREATE INDEX "_pages_v_version_seo_version_seo_og_image_idx" ON "_pages_v" USING btree ("version_seo_og_image_id");
  CREATE INDEX "_pages_v_version_seo_version_seo_twitter_image_idx" ON "_pages_v" USING btree ("version_seo_twitter_image_id");
  CREATE INDEX "_pages_v_version_version_slug_idx" ON "_pages_v" USING btree ("version_slug");
  CREATE INDEX "_pages_v_version_version_updated_at_idx" ON "_pages_v" USING btree ("version_updated_at");
  CREATE INDEX "_pages_v_version_version_created_at_idx" ON "_pages_v" USING btree ("version_created_at");
  CREATE INDEX "_pages_v_version_version__status_idx" ON "_pages_v" USING btree ("version__status");
  CREATE INDEX "_pages_v_created_at_idx" ON "_pages_v" USING btree ("created_at");
  CREATE INDEX "_pages_v_updated_at_idx" ON "_pages_v" USING btree ("updated_at");
  CREATE INDEX "_pages_v_latest_idx" ON "_pages_v" USING btree ("latest");
  CREATE INDEX "_pages_v_autosave_idx" ON "_pages_v" USING btree ("autosave");
  CREATE INDEX "_pages_v_texts_order_parent" ON "_pages_v_texts" USING btree ("order","parent_id");
  CREATE INDEX "redirects_updated_at_idx" ON "redirects" USING btree ("updated_at");
  CREATE INDEX "redirects_created_at_idx" ON "redirects" USING btree ("created_at");
  CREATE INDEX "tool_usage_tool_idx" ON "tool_usage" USING btree ("tool_id");
  CREATE INDEX "tool_usage_session_id_idx" ON "tool_usage" USING btree ("session_id");
  CREATE INDEX "tool_usage_profile_idx" ON "tool_usage" USING btree ("profile_id");
  CREATE INDEX "tool_usage_completed_idx" ON "tool_usage" USING btree ("completed");
  CREATE INDEX "tool_usage_updated_at_idx" ON "tool_usage" USING btree ("updated_at");
  CREATE INDEX "tool_usage_created_at_idx" ON "tool_usage" USING btree ("created_at");
  CREATE INDEX "personas_rules_order_idx" ON "personas_rules" USING btree ("_order");
  CREATE INDEX "personas_rules_parent_id_idx" ON "personas_rules" USING btree ("_parent_id");
  CREATE INDEX "personas_rules_tool_idx" ON "personas_rules" USING btree ("tool_id");
  CREATE INDEX "personas_rules_category_idx" ON "personas_rules" USING btree ("category_id");
  CREATE INDEX "personas_slug_idx" ON "personas" USING btree ("slug");
  CREATE INDEX "personas_updated_at_idx" ON "personas" USING btree ("updated_at");
  CREATE INDEX "personas_created_at_idx" ON "personas" USING btree ("created_at");
  CREATE UNIQUE INDEX "profiles_profile_id_idx" ON "profiles" USING btree ("profile_id");
  CREATE INDEX "profiles_updated_at_idx" ON "profiles" USING btree ("updated_at");
  CREATE INDEX "profiles_created_at_idx" ON "profiles" USING btree ("created_at");
  CREATE INDEX "profiles_rels_order_idx" ON "profiles_rels" USING btree ("order");
  CREATE INDEX "profiles_rels_parent_idx" ON "profiles_rels" USING btree ("parent_id");
  CREATE INDEX "profiles_rels_path_idx" ON "profiles_rels" USING btree ("path");
  CREATE INDEX "profiles_rels_personas_id_idx" ON "profiles_rels" USING btree ("personas_id");
  CREATE INDEX "indexing_status_updated_at_idx" ON "indexing_status" USING btree ("updated_at");
  CREATE INDEX "indexing_status_created_at_idx" ON "indexing_status" USING btree ("created_at");
  CREATE UNIQUE INDEX "pseo_templates_slug_idx" ON "pseo_templates" USING btree ("slug");
  CREATE INDEX "pseo_templates_updated_at_idx" ON "pseo_templates" USING btree ("updated_at");
  CREATE INDEX "pseo_templates_created_at_idx" ON "pseo_templates" USING btree ("created_at");
  CREATE INDEX "pseo_datasets_template_idx" ON "pseo_datasets" USING btree ("template_id");
  CREATE INDEX "pseo_datasets_csv_file_idx" ON "pseo_datasets" USING btree ("csv_file_id");
  CREATE INDEX "pseo_datasets_updated_at_idx" ON "pseo_datasets" USING btree ("updated_at");
  CREATE INDEX "pseo_datasets_created_at_idx" ON "pseo_datasets" USING btree ("created_at");
  CREATE UNIQUE INDEX "pseo_pages_slug_idx" ON "pseo_pages" USING btree ("slug");
  CREATE INDEX "pseo_pages_template_idx" ON "pseo_pages" USING btree ("template_id");
  CREATE INDEX "pseo_pages_dataset_idx" ON "pseo_pages" USING btree ("dataset_id");
  CREATE INDEX "pseo_pages_seo_seo_og_image_idx" ON "pseo_pages" USING btree ("seo_og_image_id");
  CREATE INDEX "pseo_pages_updated_at_idx" ON "pseo_pages" USING btree ("updated_at");
  CREATE INDEX "pseo_pages_created_at_idx" ON "pseo_pages" USING btree ("created_at");
  CREATE INDEX "leads_email_idx" ON "leads" USING btree ("email");
  CREATE INDEX "leads_updated_at_idx" ON "leads" USING btree ("updated_at");
  CREATE INDEX "leads_created_at_idx" ON "leads" USING btree ("created_at");
  CREATE INDEX "subscribers_interests_order_idx" ON "subscribers_interests" USING btree ("order");
  CREATE INDEX "subscribers_interests_parent_idx" ON "subscribers_interests" USING btree ("parent_id");
  CREATE UNIQUE INDEX "subscribers_email_idx" ON "subscribers" USING btree ("email");
  CREATE INDEX "subscribers_updated_at_idx" ON "subscribers" USING btree ("updated_at");
  CREATE INDEX "subscribers_created_at_idx" ON "subscribers" USING btree ("created_at");
  CREATE UNIQUE INDEX "push_subscriptions_endpoint_idx" ON "push_subscriptions" USING btree ("endpoint");
  CREATE INDEX "push_subscriptions_updated_at_idx" ON "push_subscriptions" USING btree ("updated_at");
  CREATE INDEX "push_subscriptions_created_at_idx" ON "push_subscriptions" USING btree ("created_at");
  CREATE INDEX "push_history_article_idx" ON "push_history" USING btree ("article_id");
  CREATE INDEX "push_history_updated_at_idx" ON "push_history" USING btree ("updated_at");
  CREATE INDEX "push_history_created_at_idx" ON "push_history" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_jobs_log_order_idx" ON "payload_jobs_log" USING btree ("_order");
  CREATE INDEX "payload_jobs_log_parent_id_idx" ON "payload_jobs_log" USING btree ("_parent_id");
  CREATE INDEX "payload_jobs_completed_at_idx" ON "payload_jobs" USING btree ("completed_at");
  CREATE INDEX "payload_jobs_total_tried_idx" ON "payload_jobs" USING btree ("total_tried");
  CREATE INDEX "payload_jobs_has_error_idx" ON "payload_jobs" USING btree ("has_error");
  CREATE INDEX "payload_jobs_task_slug_idx" ON "payload_jobs" USING btree ("task_slug");
  CREATE INDEX "payload_jobs_queue_idx" ON "payload_jobs" USING btree ("queue");
  CREATE INDEX "payload_jobs_wait_until_idx" ON "payload_jobs" USING btree ("wait_until");
  CREATE INDEX "payload_jobs_processing_idx" ON "payload_jobs" USING btree ("processing");
  CREATE INDEX "payload_jobs_updated_at_idx" ON "payload_jobs" USING btree ("updated_at");
  CREATE INDEX "payload_jobs_created_at_idx" ON "payload_jobs" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("categories_id");
  CREATE INDEX "payload_locked_documents_rels_tags_id_idx" ON "payload_locked_documents_rels" USING btree ("tags_id");
  CREATE INDEX "payload_locked_documents_rels_authors_id_idx" ON "payload_locked_documents_rels" USING btree ("authors_id");
  CREATE INDEX "payload_locked_documents_rels_tools_id_idx" ON "payload_locked_documents_rels" USING btree ("tools_id");
  CREATE INDEX "payload_locked_documents_rels_articles_id_idx" ON "payload_locked_documents_rels" USING btree ("articles_id");
  CREATE INDEX "payload_locked_documents_rels_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("pages_id");
  CREATE INDEX "payload_locked_documents_rels_redirects_id_idx" ON "payload_locked_documents_rels" USING btree ("redirects_id");
  CREATE INDEX "payload_locked_documents_rels_tool_usage_id_idx" ON "payload_locked_documents_rels" USING btree ("tool_usage_id");
  CREATE INDEX "payload_locked_documents_rels_personas_id_idx" ON "payload_locked_documents_rels" USING btree ("personas_id");
  CREATE INDEX "payload_locked_documents_rels_profiles_id_idx" ON "payload_locked_documents_rels" USING btree ("profiles_id");
  CREATE INDEX "payload_locked_documents_rels_indexing_status_id_idx" ON "payload_locked_documents_rels" USING btree ("indexing_status_id");
  CREATE INDEX "payload_locked_documents_rels_pseo_templates_id_idx" ON "payload_locked_documents_rels" USING btree ("pseo_templates_id");
  CREATE INDEX "payload_locked_documents_rels_pseo_datasets_id_idx" ON "payload_locked_documents_rels" USING btree ("pseo_datasets_id");
  CREATE INDEX "payload_locked_documents_rels_pseo_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("pseo_pages_id");
  CREATE INDEX "payload_locked_documents_rels_leads_id_idx" ON "payload_locked_documents_rels" USING btree ("leads_id");
  CREATE INDEX "payload_locked_documents_rels_subscribers_id_idx" ON "payload_locked_documents_rels" USING btree ("subscribers_id");
  CREATE INDEX "payload_locked_documents_rels_push_subscriptions_id_idx" ON "payload_locked_documents_rels" USING btree ("push_subscriptions_id");
  CREATE INDEX "payload_locked_documents_rels_push_history_id_idx" ON "payload_locked_documents_rels" USING btree ("push_history_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "settings_nav_order_idx" ON "settings_nav" USING btree ("_order");
  CREATE INDEX "settings_nav_parent_id_idx" ON "settings_nav" USING btree ("_parent_id");
  CREATE INDEX "settings_footer_links_order_idx" ON "settings_footer_links" USING btree ("_order");
  CREATE INDEX "settings_footer_links_parent_id_idx" ON "settings_footer_links" USING btree ("_parent_id");
  CREATE INDEX "settings_social_order_idx" ON "settings_social" USING btree ("_order");
  CREATE INDEX "settings_social_parent_id_idx" ON "settings_social" USING btree ("_parent_id");
  CREATE INDEX "settings_logo_idx" ON "settings" USING btree ("logo_id");
  CREATE INDEX "settings_favicon_idx" ON "settings" USING btree ("favicon_id");
  CREATE INDEX "settings_default_og_image_idx" ON "settings" USING btree ("default_og_image_id");
  CREATE INDEX "_settings_v_version_nav_order_idx" ON "_settings_v_version_nav" USING btree ("_order");
  CREATE INDEX "_settings_v_version_nav_parent_id_idx" ON "_settings_v_version_nav" USING btree ("_parent_id");
  CREATE INDEX "_settings_v_version_footer_links_order_idx" ON "_settings_v_version_footer_links" USING btree ("_order");
  CREATE INDEX "_settings_v_version_footer_links_parent_id_idx" ON "_settings_v_version_footer_links" USING btree ("_parent_id");
  CREATE INDEX "_settings_v_version_social_order_idx" ON "_settings_v_version_social" USING btree ("_order");
  CREATE INDEX "_settings_v_version_social_parent_id_idx" ON "_settings_v_version_social" USING btree ("_parent_id");
  CREATE INDEX "_settings_v_version_version_logo_idx" ON "_settings_v" USING btree ("version_logo_id");
  CREATE INDEX "_settings_v_version_version_favicon_idx" ON "_settings_v" USING btree ("version_favicon_id");
  CREATE INDEX "_settings_v_version_version_default_og_image_idx" ON "_settings_v" USING btree ("version_default_og_image_id");
  CREATE INDEX "_settings_v_created_at_idx" ON "_settings_v" USING btree ("created_at");
  CREATE INDEX "_settings_v_updated_at_idx" ON "_settings_v" USING btree ("updated_at");
  CREATE INDEX "social_media_profiles_order_idx" ON "social_media_profiles" USING btree ("_order");
  CREATE INDEX "social_media_profiles_parent_id_idx" ON "social_media_profiles" USING btree ("_parent_id");
  CREATE INDEX "social_media_default_og_image_idx" ON "social_media" USING btree ("default_og_image_id");
  CREATE INDEX "social_media_default_twitter_image_idx" ON "social_media" USING btree ("default_twitter_image_id");
  CREATE INDEX "ad_management_slots_order_idx" ON "ad_management_slots" USING btree ("_order");
  CREATE INDEX "ad_management_slots_parent_id_idx" ON "ad_management_slots" USING btree ("_parent_id");
  CREATE INDEX "ad_management_slots_affiliate_banner_affiliate_banner_im_idx" ON "ad_management_slots" USING btree ("affiliate_banner_image_id");
  CREATE INDEX "ad_management_affiliates_target_slots_order_idx" ON "ad_management_affiliates_target_slots" USING btree ("order");
  CREATE INDEX "ad_management_affiliates_target_slots_parent_idx" ON "ad_management_affiliates_target_slots" USING btree ("parent_id");
  CREATE INDEX "ad_management_affiliates_order_idx" ON "ad_management_affiliates" USING btree ("_order");
  CREATE INDEX "ad_management_affiliates_parent_id_idx" ON "ad_management_affiliates" USING btree ("_parent_id");
  CREATE INDEX "ad_management_affiliates_image_idx" ON "ad_management_affiliates" USING btree ("image_id");
  CREATE INDEX "lead_gen_offers_order_idx" ON "lead_gen_offers" USING btree ("_order");
  CREATE INDEX "lead_gen_offers_parent_id_idx" ON "lead_gen_offers" USING btree ("_parent_id");
  CREATE INDEX "lead_gen_offers_pdf_idx" ON "lead_gen_offers" USING btree ("pdf_id");
  CREATE INDEX "lead_gen_rels_order_idx" ON "lead_gen_rels" USING btree ("order");
  CREATE INDEX "lead_gen_rels_parent_idx" ON "lead_gen_rels" USING btree ("parent_id");
  CREATE INDEX "lead_gen_rels_path_idx" ON "lead_gen_rels" USING btree ("path");
  CREATE INDEX "lead_gen_rels_tools_id_idx" ON "lead_gen_rels" USING btree ("tools_id");
  CREATE INDEX "audience_csv_file_idx" ON "audience" USING btree ("csv_file_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "categories" CASCADE;
  DROP TABLE "categories_texts" CASCADE;
  DROP TABLE "_categories_v" CASCADE;
  DROP TABLE "_categories_v_texts" CASCADE;
  DROP TABLE "tags" CASCADE;
  DROP TABLE "authors_links" CASCADE;
  DROP TABLE "authors" CASCADE;
  DROP TABLE "tools_inputs_options" CASCADE;
  DROP TABLE "tools_inputs" CASCADE;
  DROP TABLE "tools_outputs_bands" CASCADE;
  DROP TABLE "tools_outputs" CASCADE;
  DROP TABLE "tools_faq" CASCADE;
  DROP TABLE "tools_sources" CASCADE;
  DROP TABLE "tools" CASCADE;
  DROP TABLE "tools_texts" CASCADE;
  DROP TABLE "tools_rels" CASCADE;
  DROP TABLE "_tools_v_version_inputs_options" CASCADE;
  DROP TABLE "_tools_v_version_inputs" CASCADE;
  DROP TABLE "_tools_v_version_outputs_bands" CASCADE;
  DROP TABLE "_tools_v_version_outputs" CASCADE;
  DROP TABLE "_tools_v_version_faq" CASCADE;
  DROP TABLE "_tools_v_version_sources" CASCADE;
  DROP TABLE "_tools_v" CASCADE;
  DROP TABLE "_tools_v_texts" CASCADE;
  DROP TABLE "_tools_v_rels" CASCADE;
  DROP TABLE "articles_blocks_hero" CASCADE;
  DROP TABLE "articles_blocks_calculator_embed" CASCADE;
  DROP TABLE "articles_blocks_two_column" CASCADE;
  DROP TABLE "articles_blocks_viral_hook_banner" CASCADE;
  DROP TABLE "articles_blocks_tool_embed" CASCADE;
  DROP TABLE "articles_blocks_people_also_ask_items" CASCADE;
  DROP TABLE "articles_blocks_people_also_ask" CASCADE;
  DROP TABLE "articles_blocks_text" CASCADE;
  DROP TABLE "articles_blocks_list_items" CASCADE;
  DROP TABLE "articles_blocks_list" CASCADE;
  DROP TABLE "articles_blocks_callout" CASCADE;
  DROP TABLE "articles_blocks_table_rows" CASCADE;
  DROP TABLE "articles_blocks_table" CASCADE;
  DROP TABLE "articles_faq" CASCADE;
  DROP TABLE "articles_sources" CASCADE;
  DROP TABLE "articles_semantic_entities" CASCADE;
  DROP TABLE "articles" CASCADE;
  DROP TABLE "articles_texts" CASCADE;
  DROP TABLE "articles_rels" CASCADE;
  DROP TABLE "_articles_v_blocks_hero" CASCADE;
  DROP TABLE "_articles_v_blocks_calculator_embed" CASCADE;
  DROP TABLE "_articles_v_blocks_two_column" CASCADE;
  DROP TABLE "_articles_v_blocks_viral_hook_banner" CASCADE;
  DROP TABLE "_articles_v_blocks_tool_embed" CASCADE;
  DROP TABLE "_articles_v_blocks_people_also_ask_items" CASCADE;
  DROP TABLE "_articles_v_blocks_people_also_ask" CASCADE;
  DROP TABLE "_articles_v_blocks_text" CASCADE;
  DROP TABLE "_articles_v_blocks_list_items" CASCADE;
  DROP TABLE "_articles_v_blocks_list" CASCADE;
  DROP TABLE "_articles_v_blocks_callout" CASCADE;
  DROP TABLE "_articles_v_blocks_table_rows" CASCADE;
  DROP TABLE "_articles_v_blocks_table" CASCADE;
  DROP TABLE "_articles_v_version_faq" CASCADE;
  DROP TABLE "_articles_v_version_sources" CASCADE;
  DROP TABLE "_articles_v_version_semantic_entities" CASCADE;
  DROP TABLE "_articles_v" CASCADE;
  DROP TABLE "_articles_v_texts" CASCADE;
  DROP TABLE "_articles_v_rels" CASCADE;
  DROP TABLE "pages_blocks_hero" CASCADE;
  DROP TABLE "pages_blocks_calculator_embed" CASCADE;
  DROP TABLE "pages_blocks_two_column" CASCADE;
  DROP TABLE "pages_blocks_viral_hook_banner" CASCADE;
  DROP TABLE "pages_blocks_tool_embed" CASCADE;
  DROP TABLE "pages_blocks_people_also_ask_items" CASCADE;
  DROP TABLE "pages_blocks_people_also_ask" CASCADE;
  DROP TABLE "pages_blocks_text" CASCADE;
  DROP TABLE "pages_blocks_list_items" CASCADE;
  DROP TABLE "pages_blocks_list" CASCADE;
  DROP TABLE "pages_blocks_callout" CASCADE;
  DROP TABLE "pages_blocks_table_rows" CASCADE;
  DROP TABLE "pages_blocks_table" CASCADE;
  DROP TABLE "pages" CASCADE;
  DROP TABLE "pages_texts" CASCADE;
  DROP TABLE "_pages_v_blocks_hero" CASCADE;
  DROP TABLE "_pages_v_blocks_calculator_embed" CASCADE;
  DROP TABLE "_pages_v_blocks_two_column" CASCADE;
  DROP TABLE "_pages_v_blocks_viral_hook_banner" CASCADE;
  DROP TABLE "_pages_v_blocks_tool_embed" CASCADE;
  DROP TABLE "_pages_v_blocks_people_also_ask_items" CASCADE;
  DROP TABLE "_pages_v_blocks_people_also_ask" CASCADE;
  DROP TABLE "_pages_v_blocks_text" CASCADE;
  DROP TABLE "_pages_v_blocks_list_items" CASCADE;
  DROP TABLE "_pages_v_blocks_list" CASCADE;
  DROP TABLE "_pages_v_blocks_callout" CASCADE;
  DROP TABLE "_pages_v_blocks_table_rows" CASCADE;
  DROP TABLE "_pages_v_blocks_table" CASCADE;
  DROP TABLE "_pages_v" CASCADE;
  DROP TABLE "_pages_v_texts" CASCADE;
  DROP TABLE "redirects" CASCADE;
  DROP TABLE "tool_usage" CASCADE;
  DROP TABLE "personas_rules" CASCADE;
  DROP TABLE "personas" CASCADE;
  DROP TABLE "profiles" CASCADE;
  DROP TABLE "profiles_rels" CASCADE;
  DROP TABLE "indexing_status" CASCADE;
  DROP TABLE "pseo_templates" CASCADE;
  DROP TABLE "pseo_datasets" CASCADE;
  DROP TABLE "pseo_pages" CASCADE;
  DROP TABLE "leads" CASCADE;
  DROP TABLE "subscribers_interests" CASCADE;
  DROP TABLE "subscribers" CASCADE;
  DROP TABLE "push_subscriptions" CASCADE;
  DROP TABLE "push_history" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_jobs_log" CASCADE;
  DROP TABLE "payload_jobs" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "settings_nav" CASCADE;
  DROP TABLE "settings_footer_links" CASCADE;
  DROP TABLE "settings_social" CASCADE;
  DROP TABLE "settings" CASCADE;
  DROP TABLE "_settings_v_version_nav" CASCADE;
  DROP TABLE "_settings_v_version_footer_links" CASCADE;
  DROP TABLE "_settings_v_version_social" CASCADE;
  DROP TABLE "_settings_v" CASCADE;
  DROP TABLE "indexing" CASCADE;
  DROP TABLE "social_media_profiles" CASCADE;
  DROP TABLE "social_media" CASCADE;
  DROP TABLE "ad_management_slots" CASCADE;
  DROP TABLE "ad_management_affiliates_target_slots" CASCADE;
  DROP TABLE "ad_management_affiliates" CASCADE;
  DROP TABLE "ad_management" CASCADE;
  DROP TABLE "lead_gen_offers" CASCADE;
  DROP TABLE "lead_gen" CASCADE;
  DROP TABLE "lead_gen_rels" CASCADE;
  DROP TABLE "audience" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_categories_kind";
  DROP TYPE "public"."enum__categories_v_version_kind";
  DROP TYPE "public"."enum_authors_schema_type";
  DROP TYPE "public"."enum_tools_inputs_type";
  DROP TYPE "public"."enum_tools_tool_type";
  DROP TYPE "public"."enum_tools_icon";
  DROP TYPE "public"."enum_tools_gradient";
  DROP TYPE "public"."enum_tools_status";
  DROP TYPE "public"."enum__tools_v_version_inputs_type";
  DROP TYPE "public"."enum__tools_v_version_tool_type";
  DROP TYPE "public"."enum__tools_v_version_icon";
  DROP TYPE "public"."enum__tools_v_version_gradient";
  DROP TYPE "public"."enum__tools_v_version_status";
  DROP TYPE "public"."enum_articles_blocks_hero_overlay";
  DROP TYPE "public"."enum_articles_blocks_calculator_embed_variant";
  DROP TYPE "public"."enum_articles_blocks_two_column_image_side";
  DROP TYPE "public"."enum_articles_blocks_text_style";
  DROP TYPE "public"."enum_articles_blocks_list_style";
  DROP TYPE "public"."enum_articles_blocks_callout_tone";
  DROP TYPE "public"."enum_articles_ai_provider";
  DROP TYPE "public"."enum_articles_status";
  DROP TYPE "public"."enum__articles_v_blocks_hero_overlay";
  DROP TYPE "public"."enum__articles_v_blocks_calculator_embed_variant";
  DROP TYPE "public"."enum__articles_v_blocks_two_column_image_side";
  DROP TYPE "public"."enum__articles_v_blocks_text_style";
  DROP TYPE "public"."enum__articles_v_blocks_list_style";
  DROP TYPE "public"."enum__articles_v_blocks_callout_tone";
  DROP TYPE "public"."enum__articles_v_version_ai_provider";
  DROP TYPE "public"."enum__articles_v_version_status";
  DROP TYPE "public"."enum_pages_blocks_hero_overlay";
  DROP TYPE "public"."enum_pages_blocks_calculator_embed_variant";
  DROP TYPE "public"."enum_pages_blocks_two_column_image_side";
  DROP TYPE "public"."enum_pages_blocks_text_style";
  DROP TYPE "public"."enum_pages_blocks_list_style";
  DROP TYPE "public"."enum_pages_blocks_callout_tone";
  DROP TYPE "public"."enum_pages_status";
  DROP TYPE "public"."enum__pages_v_blocks_hero_overlay";
  DROP TYPE "public"."enum__pages_v_blocks_calculator_embed_variant";
  DROP TYPE "public"."enum__pages_v_blocks_two_column_image_side";
  DROP TYPE "public"."enum__pages_v_blocks_text_style";
  DROP TYPE "public"."enum__pages_v_blocks_list_style";
  DROP TYPE "public"."enum__pages_v_blocks_callout_tone";
  DROP TYPE "public"."enum__pages_v_version_status";
  DROP TYPE "public"."enum_redirects_type";
  DROP TYPE "public"."enum_personas_rules_match_type";
  DROP TYPE "public"."enum_indexing_status_engine";
  DROP TYPE "public"."enum_indexing_status_status";
  DROP TYPE "public"."enum_pseo_templates_status";
  DROP TYPE "public"."enum_pseo_datasets_status";
  DROP TYPE "public"."enum_pseo_pages_status";
  DROP TYPE "public"."enum_subscribers_interests";
  DROP TYPE "public"."enum_subscribers_source";
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  DROP TYPE "public"."enum_payload_jobs_log_state";
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  DROP TYPE "public"."enum_settings_social_platform";
  DROP TYPE "public"."enum__settings_v_version_social_platform";
  DROP TYPE "public"."enum_social_media_profiles_platform";
  DROP TYPE "public"."enum_social_media_twitter_card_style";
  DROP TYPE "public"."enum_ad_management_slots_placement";
  DROP TYPE "public"."enum_ad_management_slots_format";
  DROP TYPE "public"."enum_ad_management_affiliates_target_slots";
  DROP TYPE "public"."enum_lead_gen_offers_offer_type";
  DROP TYPE "public"."enum_lead_gen_offers_placement";
  DROP TYPE "public"."enum_audience_csv_import_status";`)
}
