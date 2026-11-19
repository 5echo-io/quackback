-- Help-center content in more than one language.
--
-- An article is written in one language (`locale`, a portal locale id such as
-- 'en', 'nb' or 'pt-br'); its translations share a `translation_group`, at most
-- one per language. Existing articles become English, which is what they were
-- searched as. A category keeps one slug and gains a name and description per
-- language in `translations` ({"nb": {"name": "...", "description": "..."}}).
--
-- The search vector is rebuilt with the text-search dictionary of the
-- article's own language, so a Norwegian article stems as Norwegian. The CASE
-- mirrors searchConfigForLocale() in the app, which picks the same dictionary
-- for the query side; the two must stay in step.
ALTER TABLE "kb_articles" ADD COLUMN IF NOT EXISTS "locale" text DEFAULT 'en' NOT NULL;
--> statement-breakpoint
ALTER TABLE "kb_articles" ADD COLUMN IF NOT EXISTS "translation_group" text;
--> statement-breakpoint
ALTER TABLE "kb_categories" ADD COLUMN IF NOT EXISTS "translations" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS "kb_articles_search_vector_idx";
--> statement-breakpoint
ALTER TABLE "kb_articles" DROP COLUMN IF EXISTS "search_vector";
--> statement-breakpoint
ALTER TABLE "kb_articles" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector(CASE "locale"
    WHEN 'nb' THEN 'norwegian'::regconfig
    WHEN 'sv' THEN 'swedish'::regconfig
    WHEN 'da' THEN 'danish'::regconfig
    WHEN 'de' THEN 'german'::regconfig
    WHEN 'fr' THEN 'french'::regconfig
    WHEN 'es' THEN 'spanish'::regconfig
    WHEN 'ru' THEN 'russian'::regconfig
    WHEN 'pt-br' THEN 'portuguese'::regconfig
    WHEN 'ar' THEN 'arabic'::regconfig
    WHEN 'zh-cn' THEN 'simple'::regconfig
    WHEN 'zh-tw' THEN 'simple'::regconfig
    ELSE 'english'::regconfig
  END, coalesce("title", '')), 'A') ||
  setweight(to_tsvector(CASE "locale"
    WHEN 'nb' THEN 'norwegian'::regconfig
    WHEN 'sv' THEN 'swedish'::regconfig
    WHEN 'da' THEN 'danish'::regconfig
    WHEN 'de' THEN 'german'::regconfig
    WHEN 'fr' THEN 'french'::regconfig
    WHEN 'es' THEN 'spanish'::regconfig
    WHEN 'ru' THEN 'russian'::regconfig
    WHEN 'pt-br' THEN 'portuguese'::regconfig
    WHEN 'ar' THEN 'arabic'::regconfig
    WHEN 'zh-cn' THEN 'simple'::regconfig
    WHEN 'zh-tw' THEN 'simple'::regconfig
    ELSE 'english'::regconfig
  END, coalesce("content", '')), 'B')
) STORED;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kb_articles_search_vector_idx" ON "kb_articles" USING gin ("search_vector");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kb_articles_locale_idx" ON "kb_articles" ("locale");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "kb_articles_translation_locale_idx" ON "kb_articles" ("translation_group", "locale")
  WHERE "translation_group" IS NOT NULL AND "deleted_at" IS NULL;
