-- ═══════════════════════════════════════════════════════════
-- DRiVE: localStorage → Supabase Migration
-- Creates: user_stories, bookmarks, story_likes tables
-- Updates: profiles trigger for new auth users
-- ═══════════════════════════════════════════════════════════

-- 1. USER STORIES TABLE
CREATE TABLE IF NOT EXISTS public.user_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL DEFAULT 'Untitled Story',
  genre text NOT NULL DEFAULT 'Fantasy',
  format text NOT NULL DEFAULT 'book',
  synopsis text DEFAULT '',
  status text DEFAULT 'draft',
  pages jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_stories ENABLE ROW LEVEL SECURITY;

-- Users can do anything with their own stories
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can CRUD own stories') THEN
    CREATE POLICY "Users can CRUD own stories" ON public.user_stories
      FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Anyone can read published stories
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read published stories') THEN
    CREATE POLICY "Anyone can read published stories" ON public.user_stories
      FOR SELECT USING (status = 'published');
  END IF;
END $$;

-- 2. BOOKMARKS TABLE
CREATE TABLE IF NOT EXISTS public.bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  story_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, story_id)
);

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own bookmarks') THEN
    CREATE POLICY "Users can manage own bookmarks" ON public.bookmarks
      FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 3. STORY LIKES TABLE
CREATE TABLE IF NOT EXISTS public.story_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  story_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, story_id)
);

ALTER TABLE public.story_likes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own likes') THEN
    CREATE POLICY "Users can manage own likes" ON public.story_likes
      FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can count likes') THEN
    CREATE POLICY "Anyone can count likes" ON public.story_likes
      FOR SELECT USING (true);
  END IF;
END $$;

-- 4. AUTO-CREATE PROFILE ON SIGNUP
-- When a new user signs up via Supabase Auth, automatically create a profiles row
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_index, social_links, library_unlocked)
  VALUES (
    NEW.id,
    'User_' || substr(NEW.id::text, 1, 8),
    floor(random() * 20)::int,
    '{}'::jsonb,
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists, then recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5. ENSURE user_subscriptions TABLE HAS CORRECT SCHEMA
-- (Already created previously, but ensure user_id has UNIQUE constraint for upserts)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_subscriptions_user_id_key'
  ) THEN
    ALTER TABLE public.user_subscriptions ADD CONSTRAINT user_subscriptions_user_id_key UNIQUE (user_id);
  END IF;
EXCEPTION WHEN others THEN
  NULL; -- Ignore if constraint already exists
END $$;
