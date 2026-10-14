-- =============================================================================
-- Copione — схема базы данных для Supabase
--
-- Как применить: Supabase Dashboard → SQL Editor → New query → вставьте весь
-- файл → Run. Скрипт можно запускать повторно: он ничего не удаляет из данных.
--
-- Что внутри:
--   profiles        — профили пользователей (создаются автоматически при регистрации)
--   library         — состояние тайтла у пользователя: оценка, лайк, «хочу», «смотрел/слушал»
--   entries         — дневник: каждый просмотр/прослушивание, рецензии, вайбы
--   episodes_seen   — прогресс по сериям сериалов
--   follows, entry_likes, comments, blocks, reports — социальная часть и модерация
--   lists, list_items — пользовательские списки
--   match_*         — «Мэтч»: совместный выбор фильма свайпами
--
-- Доступ к данным защищён Row Level Security: читать могут все вошедшие
-- пользователи, менять — только свои записи.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create or replace function public.escape_like(p text) returns text
language sql immutable set search_path = '' as $$
  select replace(replace(replace(coalesce(p, ''), '\', '\\'), '%', '\%'), '_', '\_');
$$;

-- -----------------------------------------------------------------------------
-- Profiles
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  display_name text not null default '',
  bio text not null default '',
  avatar_emoji text,
  fav_films jsonb not null default '[]'::jsonb,
  fav_music jsonb not null default '[]'::jsonb,
  goal_films int,
  goal_albums int,
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$'),
  constraint profiles_display_name_len check (char_length(display_name) <= 40),
  constraint profiles_bio_len check (char_length(bio) <= 300),
  constraint profiles_avatar_len check (avatar_emoji is null or char_length(avatar_emoji) <= 16),
  constraint profiles_fav_films check (
    case when jsonb_typeof(fav_films) = 'array' then jsonb_array_length(fav_films) <= 4 else false end),
  constraint profiles_fav_music check (
    case when jsonb_typeof(fav_music) = 'array' then jsonb_array_length(fav_music) <= 4 else false end),
  constraint profiles_goals check (
    (goal_films is null or goal_films between 1 and 5000)
    and (goal_albums is null or goal_albums between 1 and 5000))
);

-- A profile is created for every new auth user. The username comes from the
-- sign-up metadata; if it is taken or invalid, a unique fallback is generated.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_base text := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
  v_candidate text;
begin
  v_base := left(regexp_replace(v_base, '[^a-z0-9_]', '', 'g'), 20);
  if char_length(v_base) < 3 then
    v_base := 'user';
  end if;
  v_candidate := v_base;
  while char_length(v_candidate) < 3
     or exists (select 1 from public.profiles p where p.username = v_candidate) loop
    v_candidate := left(v_base, 15) || '_' || substr(md5(random()::text), 1, 4);
  end loop;
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    v_candidate,
    left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 40)
  );
  return new;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Library: one row per user per title
-- -----------------------------------------------------------------------------

create table if not exists public.library (
  user_id uuid not null references public.profiles (id) on delete cascade,
  media_type text not null,
  media_id text not null,
  title text not null,
  subtitle text,
  poster text,
  year int,
  genres text[] not null default '{}',
  runtime int,
  creator text,
  status text,
  rating numeric(2, 1),
  liked boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, media_type, media_id),
  constraint library_media_type check (media_type in ('movie', 'tv', 'album', 'track')),
  constraint library_media_id check (char_length(media_id) between 1 and 64),
  constraint library_snapshot check (
    char_length(title) between 1 and 300
    and (subtitle is null or char_length(subtitle) <= 300)
    and (poster is null or char_length(poster) <= 500)
    and (creator is null or char_length(creator) <= 200)
    and cardinality(genres) <= 12
    and (runtime is null or runtime between 0 and 100000)),
  constraint library_status check (status is null or status in ('want', 'done')),
  constraint library_rating check (
    rating is null or (rating between 0.5 and 5 and rating * 2 = trunc(rating * 2)))
);

create index if not exists library_media_idx on public.library (media_type, media_id);
create index if not exists library_user_updated_idx on public.library (user_id, updated_at desc);

drop trigger if exists library_touch on public.library;
create trigger library_touch before update on public.library
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Entries: the diary (each watch / listen, optionally with a review)
-- -----------------------------------------------------------------------------

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  media_type text not null,
  media_id text not null,
  season int,
  title text not null,
  subtitle text,
  poster text,
  year int,
  genres text[] not null default '{}',
  runtime int,
  creator text,
  watched_on date not null default current_date,
  rating numeric(2, 1),
  liked boolean not null default false,
  rewatch boolean not null default false,
  review text,
  spoilers boolean not null default false,
  vibes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entries_media_type check (media_type in ('movie', 'tv', 'album', 'track')),
  constraint entries_media_id check (char_length(media_id) between 1 and 64),
  constraint entries_snapshot check (
    char_length(title) between 1 and 300
    and (subtitle is null or char_length(subtitle) <= 300)
    and (poster is null or char_length(poster) <= 500)
    and (creator is null or char_length(creator) <= 200)
    and cardinality(genres) <= 12
    and (runtime is null or runtime between 0 and 100000)),
  constraint entries_season check (season is null or (media_type = 'tv' and season between 0 and 200)),
  constraint entries_rating check (
    rating is null or (rating between 0.5 and 5 and rating * 2 = trunc(rating * 2))),
  constraint entries_review_len check (review is null or char_length(review) <= 8000),
  constraint entries_vibes check (cardinality(vibes) <= 3)
);

create index if not exists entries_user_idx on public.entries (user_id, watched_on desc, created_at desc);
create index if not exists entries_media_idx on public.entries (media_type, media_id, created_at desc);
create index if not exists entries_created_idx on public.entries (created_at desc);

drop trigger if exists entries_touch on public.entries;
create trigger entries_touch before update on public.entries
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- TV progress
-- -----------------------------------------------------------------------------

create table if not exists public.episodes_seen (
  user_id uuid not null references public.profiles (id) on delete cascade,
  show_id text not null,
  season int not null,
  episode int not null,
  runtime int,
  seen_at timestamptz not null default now(),
  primary key (user_id, show_id, season, episode),
  constraint episodes_seen_numbers check (season between 0 and 200 and episode between 0 and 10000),
  constraint episodes_seen_runtime check (runtime is null or runtime between 0 and 1000)
);

create index if not exists episodes_seen_user_time_idx on public.episodes_seen (user_id, seen_at desc);

-- -----------------------------------------------------------------------------
-- Social
-- -----------------------------------------------------------------------------

create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_not_self check (follower_id <> followee_id)
);

create index if not exists follows_followee_idx on public.follows (followee_id);

create table if not exists public.entry_likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  entry_id uuid not null references public.entries (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, entry_id)
);

create index if not exists entry_likes_entry_idx on public.entry_likes (entry_id);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint comments_body_len check (char_length(body) between 1 and 1000)
);

create index if not exists comments_entry_idx on public.comments (entry_id, created_at);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

-- Reports are only readable from the Dashboard (Table Editor → reports).
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  target_type text not null,
  target_id text not null,
  reason text not null default '',
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  constraint reports_target_type check (target_type in ('entry', 'comment', 'profile')),
  constraint reports_target_id check (char_length(target_id) <= 64),
  constraint reports_reason_len check (char_length(reason) <= 500)
);

-- -----------------------------------------------------------------------------
-- Lists
-- -----------------------------------------------------------------------------

create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text not null default '',
  ranked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lists_title_len check (char_length(title) between 1 and 100),
  constraint lists_description_len check (char_length(description) <= 1000)
);

create index if not exists lists_user_idx on public.lists (user_id, updated_at desc);

drop trigger if exists lists_touch on public.lists;
create trigger lists_touch before update on public.lists
  for each row execute function public.touch_updated_at();

create table if not exists public.list_items (
  list_id uuid not null references public.lists (id) on delete cascade,
  media_type text not null,
  media_id text not null,
  title text not null,
  subtitle text,
  poster text,
  year int,
  position int,
  note text,
  added_at timestamptz not null default now(),
  primary key (list_id, media_type, media_id),
  constraint list_items_media_type check (media_type in ('movie', 'tv', 'album', 'track')),
  constraint list_items_snapshot check (
    char_length(media_id) between 1 and 64
    and char_length(title) between 1 and 300
    and (subtitle is null or char_length(subtitle) <= 300)
    and (poster is null or char_length(poster) <= 500)),
  constraint list_items_note_len check (note is null or char_length(note) <= 300)
);

create index if not exists list_items_media_idx on public.list_items (media_type, media_id);

-- New items go to the end of the list; adding/removing items bumps the list.
create or replace function public.list_items_before_insert() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.position is null then
    select coalesce(max(i.position), 0) + 1 into new.position
    from public.list_items i where i.list_id = new.list_id;
  end if;
  return new;
end
$$;

drop trigger if exists list_items_position on public.list_items;
create trigger list_items_position before insert on public.list_items
  for each row execute function public.list_items_before_insert();

create or replace function public.list_items_touch_list() returns trigger
language plpgsql set search_path = '' as $$
begin
  update public.lists set updated_at = now()
  where id = coalesce(new.list_id, old.list_id);
  return null;
end
$$;

drop trigger if exists list_items_touch on public.list_items;
create trigger list_items_touch after insert or delete on public.list_items
  for each row execute function public.list_items_touch_list();

-- -----------------------------------------------------------------------------
-- Match: choose what to watch together by swiping
-- -----------------------------------------------------------------------------

create table if not exists public.match_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  deck jsonb not null,
  created_at timestamptz not null default now(),
  constraint match_rooms_kind check (kind in ('movie', 'tv', 'mixed', 'music')),
  constraint match_rooms_code check (code ~ '^[A-Z0-9]{5}$'),
  constraint match_rooms_deck check (
    case when jsonb_typeof(deck) = 'array' then jsonb_array_length(deck) between 1 and 100 else false end)
);

create table if not exists public.match_members (
  room_id uuid not null references public.match_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists match_members_user_idx on public.match_members (user_id);

create table if not exists public.match_swipes (
  room_id uuid not null references public.match_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_key text not null,
  liked boolean not null,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id, item_key),
  constraint match_swipes_key check (char_length(item_key) <= 80)
);

-- -----------------------------------------------------------------------------
-- Visibility helpers (security definer: they read tables the caller cannot)
-- -----------------------------------------------------------------------------

-- True when either user has blocked the other.
create or replace function public.hidden_for_me(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p_user)
       or (b.blocker_id = p_user and b.blocked_id = auth.uid())
  );
$$;

create or replace function public.is_room_member(p_room uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.match_members m
    where m.room_id = p_room and m.user_id = auth.uid()
  );
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.library enable row level security;
alter table public.entries enable row level security;
alter table public.episodes_seen enable row level security;
alter table public.follows enable row level security;
alter table public.entry_likes enable row level security;
alter table public.comments enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.lists enable row level security;
alter table public.list_items enable row level security;
alter table public.match_rooms enable row level security;
alter table public.match_members enable row level security;
alter table public.match_swipes enable row level security;

drop policy if exists "profiles: read" on public.profiles;
create policy "profiles: read" on public.profiles
  for select to authenticated using (true);
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "library: read" on public.library;
create policy "library: read" on public.library
  for select to authenticated using (true);
drop policy if exists "library: insert own" on public.library;
create policy "library: insert own" on public.library
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "library: update own" on public.library;
create policy "library: update own" on public.library
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "library: delete own" on public.library;
create policy "library: delete own" on public.library
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "entries: read" on public.entries;
create policy "entries: read" on public.entries
  for select to authenticated using (true);
drop policy if exists "entries: insert own" on public.entries;
create policy "entries: insert own" on public.entries
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "entries: update own" on public.entries;
create policy "entries: update own" on public.entries
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "entries: delete own" on public.entries;
create policy "entries: delete own" on public.entries
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "episodes: read" on public.episodes_seen;
create policy "episodes: read" on public.episodes_seen
  for select to authenticated using (true);
drop policy if exists "episodes: insert own" on public.episodes_seen;
create policy "episodes: insert own" on public.episodes_seen
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "episodes: delete own" on public.episodes_seen;
create policy "episodes: delete own" on public.episodes_seen
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "follows: read" on public.follows;
create policy "follows: read" on public.follows
  for select to authenticated using (true);
drop policy if exists "follows: insert own" on public.follows;
create policy "follows: insert own" on public.follows
  for insert to authenticated with check (follower_id = auth.uid());
drop policy if exists "follows: delete own" on public.follows;
create policy "follows: delete own" on public.follows
  for delete to authenticated using (follower_id = auth.uid());

drop policy if exists "likes: read" on public.entry_likes;
create policy "likes: read" on public.entry_likes
  for select to authenticated using (true);
drop policy if exists "likes: insert own" on public.entry_likes;
create policy "likes: insert own" on public.entry_likes
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "likes: delete own" on public.entry_likes;
create policy "likes: delete own" on public.entry_likes
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "comments: read" on public.comments;
create policy "comments: read" on public.comments
  for select to authenticated using (true);
drop policy if exists "comments: insert own" on public.comments;
create policy "comments: insert own" on public.comments
  for insert to authenticated with check (
    user_id = auth.uid()
    and not public.hidden_for_me((select e.user_id from public.entries e where e.id = entry_id)));
-- The author of a comment and the author of the entry may delete it.
drop policy if exists "comments: delete own or on own entry" on public.comments;
create policy "comments: delete own or on own entry" on public.comments
  for delete to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.entries e where e.id = entry_id and e.user_id = auth.uid()));

drop policy if exists "blocks: read own" on public.blocks;
create policy "blocks: read own" on public.blocks
  for select to authenticated using (blocker_id = auth.uid());
drop policy if exists "blocks: insert own" on public.blocks;
create policy "blocks: insert own" on public.blocks
  for insert to authenticated with check (blocker_id = auth.uid());
drop policy if exists "blocks: delete own" on public.blocks;
create policy "blocks: delete own" on public.blocks
  for delete to authenticated using (blocker_id = auth.uid());

drop policy if exists "reports: insert own" on public.reports;
create policy "reports: insert own" on public.reports
  for insert to authenticated with check (reporter_id = auth.uid());

drop policy if exists "lists: read" on public.lists;
create policy "lists: read" on public.lists
  for select to authenticated using (true);
drop policy if exists "lists: insert own" on public.lists;
create policy "lists: insert own" on public.lists
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "lists: update own" on public.lists;
create policy "lists: update own" on public.lists
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "lists: delete own" on public.lists;
create policy "lists: delete own" on public.lists
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "list items: read" on public.list_items;
create policy "list items: read" on public.list_items
  for select to authenticated using (true);
drop policy if exists "list items: write own" on public.list_items;
create policy "list items: write own" on public.list_items
  for all to authenticated
  using (exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid()))
  with check (exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid()));

-- Rooms are created and joined through the RPCs below.
drop policy if exists "match rooms: members read" on public.match_rooms;
create policy "match rooms: members read" on public.match_rooms
  for select to authenticated using (public.is_room_member(id));
drop policy if exists "match rooms: host deletes" on public.match_rooms;
create policy "match rooms: host deletes" on public.match_rooms
  for delete to authenticated using (host_id = auth.uid());

drop policy if exists "match members: members read" on public.match_members;
create policy "match members: members read" on public.match_members
  for select to authenticated using (public.is_room_member(room_id));
drop policy if exists "match members: leave" on public.match_members;
create policy "match members: leave" on public.match_members
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "match swipes: members read" on public.match_swipes;
create policy "match swipes: members read" on public.match_swipes
  for select to authenticated using (public.is_room_member(room_id));
drop policy if exists "match swipes: insert own" on public.match_swipes;
create policy "match swipes: insert own" on public.match_swipes
  for insert to authenticated with check (user_id = auth.uid() and public.is_room_member(room_id));
drop policy if exists "match swipes: update own" on public.match_swipes;
create policy "match swipes: update own" on public.match_swipes
  for update to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_room_member(room_id));

-- -----------------------------------------------------------------------------
-- Views (security_invoker: they obey the caller's RLS)
-- -----------------------------------------------------------------------------

create or replace view public.entry_cards with (security_invoker = on) as
select
  e.id,
  e.user_id,
  e.media_type,
  e.media_id,
  e.season,
  e.title,
  e.subtitle,
  e.poster,
  e.year,
  e.genres,
  e.runtime,
  e.creator,
  e.watched_on,
  e.rating,
  e.liked,
  e.rewatch,
  e.review,
  e.spoilers,
  e.vibes,
  e.created_at,
  e.updated_at,
  p.username as author_username,
  p.display_name as author_display_name,
  p.avatar_emoji as author_avatar_emoji,
  (select count(*) from public.entry_likes l where l.entry_id = e.id)::int as like_count,
  (select count(*) from public.comments c where c.entry_id = e.id)::int as comment_count,
  exists (
    select 1 from public.entry_likes l where l.entry_id = e.id and l.user_id = auth.uid()
  ) as liked_by_me
from public.entries e
join public.profiles p on p.id = e.user_id
where not public.hidden_for_me(e.user_id);

create or replace view public.comment_cards with (security_invoker = on) as
select
  c.id,
  c.entry_id,
  c.user_id,
  c.body,
  c.created_at,
  p.username as author_username,
  p.display_name as author_display_name,
  p.avatar_emoji as author_avatar_emoji
from public.comments c
join public.profiles p on p.id = c.user_id
where not public.hidden_for_me(c.user_id);

-- -----------------------------------------------------------------------------
-- RPC functions used by the app
-- -----------------------------------------------------------------------------

create or replace function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = '' as $$
  select lower(coalesce(p_username, '')) ~ '^[a-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles p where p.username = lower(p_username));
$$;

-- Activity of the people I follow.
create or replace function public.feed(
  p_before timestamptz default null,
  p_limit int default 30,
  p_domain text default null
) returns setof public.entry_cards
language sql stable set search_path = '' as $$
  select ec.*
  from public.entry_cards ec
  where ec.user_id in (select f.followee_id from public.follows f where f.follower_id = auth.uid())
    and (p_before is null or ec.created_at < p_before)
    and (p_domain is null
         or (p_domain = 'film' and ec.media_type in ('movie', 'tv'))
         or (p_domain = 'music' and ec.media_type in ('album', 'track')))
  order by ec.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

-- Community numbers for a title: average, histogram, counts and vibes.
create or replace function public.title_stats(p_type text, p_id text) returns jsonb
language sql stable set search_path = '' as $$
  with lib as (
    select l.rating, l.status, l.liked
    from public.library l
    where l.media_type = p_type and l.media_id = p_id
  ),
  vib as (
    select v.vibe, count(*)::int as cnt
    from public.entries e
    cross join lateral unnest(e.vibes) as v(vibe)
    where e.media_type = p_type and e.media_id = p_id
    group by v.vibe
    order by count(*) desc, v.vibe
    limit 8
  ),
  hist as (
    select (lib.rating * 2)::int as bucket, count(*)::int as cnt
    from lib where lib.rating is not null
    group by 1
  )
  select jsonb_build_object(
    'avg', (select round(avg(lib.rating), 2) from lib where lib.rating is not null),
    'count', (select count(*) from lib where lib.rating is not null),
    'histogram', (
      select jsonb_agg(coalesce(hist.cnt, 0) order by b.bucket)
      from generate_series(1, 10) as b(bucket)
      left join hist on hist.bucket = b.bucket),
    'done', (select count(*) from lib where lib.status = 'done'),
    'want', (select count(*) from lib where lib.status = 'want'),
    'liked', (select count(*) from lib where lib.liked),
    'vibes', coalesce(
      (select jsonb_agg(jsonb_build_object('id', vib.vibe, 'count', vib.cnt) order by vib.cnt desc, vib.vibe)
       from vib),
      '[]'::jsonb),
    'vibe_entries', (
      select count(*) from public.entries e
      where e.media_type = p_type and e.media_id = p_id and cardinality(e.vibes) > 0)
  );
$$;

-- What the people I follow think about a title.
create or replace function public.title_friends(p_type text, p_id text)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_emoji text,
  rating numeric,
  liked boolean,
  status text
)
language sql stable set search_path = '' as $$
  select p.id, p.username, p.display_name, p.avatar_emoji, l.rating, l.liked, l.status
  from public.follows f
  join public.library l
    on l.user_id = f.followee_id and l.media_type = p_type and l.media_id = p_id
  join public.profiles p on p.id = f.followee_id
  where f.follower_id = auth.uid()
    and (l.rating is not null or l.liked or l.status is not null)
  order by l.rating desc nulls last, p.username
  limit 50;
$$;

create or replace function public.profile_card(p_user uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'profile', to_jsonb(p),
    'followers', (select count(*) from public.follows f where f.followee_id = p.id),
    'following', (select count(*) from public.follows f where f.follower_id = p.id),
    'is_following', exists (
      select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = p.id),
    'follows_me', exists (
      select 1 from public.follows f where f.follower_id = p.id and f.followee_id = auth.uid()),
    'is_blocked', exists (
      select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = p.id),
    'films', (select count(*) from public.library l
              where l.user_id = p.id and l.media_type = 'movie' and l.status = 'done'),
    'shows', (select count(*) from public.library l
              where l.user_id = p.id and l.media_type = 'tv' and l.status = 'done'),
    'albums', (select count(*) from public.library l
               where l.user_id = p.id and l.media_type = 'album' and l.status = 'done'),
    'tracks', (select count(*) from public.library l
               where l.user_id = p.id and l.media_type = 'track' and l.rating is not null),
    'entries_this_year', (select count(*) from public.entries e
                          where e.user_id = p.id
                            and e.watched_on >= date_trunc('year', current_date)::date)
  )
  from public.profiles p
  where p.id = p_user;
$$;

create or replace function public.search_profiles(p_query text)
returns setof public.profiles
language sql stable set search_path = '' as $$
  select p.*
  from public.profiles p
  where char_length(trim(coalesce(p_query, ''))) >= 1
    and (p.username ilike '%' || public.escape_like(lower(trim(p_query))) || '%'
         or p.display_name ilike '%' || public.escape_like(trim(p_query)) || '%')
    and not public.hidden_for_me(p.id)
  order by (p.username = lower(trim(p_query))) desc, p.username
  limit 30;
$$;

-- People worth following: recently active, not followed yet.
create or replace function public.suggested_profiles(p_limit int default 12)
returns setof public.profiles
language sql stable set search_path = '' as $$
  with active as (
    select e.user_id, count(*) as n
    from public.entries e
    where e.created_at > now() - interval '60 days'
    group by e.user_id
  )
  select p.*
  from public.profiles p
  left join active a on a.user_id = p.id
  where p.id <> auth.uid()
    and not exists (
      select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = p.id)
    and not public.hidden_for_me(p.id)
  order by coalesce(a.n, 0) desc, p.created_at desc
  limit least(greatest(coalesce(p_limit, 12), 1), 50);
$$;

-- Titles both of us rated: the raw material for the taste match score.
create or replace function public.taste_pairs(p_other uuid)
returns table (
  media_type text,
  media_id text,
  title text,
  subtitle text,
  poster text,
  year int,
  my_rating numeric,
  their_rating numeric
)
language sql stable set search_path = '' as $$
  select a.media_type, a.media_id, a.title, a.subtitle, a.poster, a.year, a.rating, b.rating
  from public.library a
  join public.library b
    on b.media_type = a.media_type and b.media_id = a.media_id and b.user_id = p_other
  where a.user_id = auth.uid()
    and a.rating is not null
    and b.rating is not null;
$$;

-- Series I have started, with the furthest episode I have seen.
create or replace function public.shows_in_progress()
returns table (
  show_id text,
  title text,
  subtitle text,
  poster text,
  year int,
  genres text[],
  runtime int,
  creator text,
  status text,
  seen_count int,
  last_season int,
  last_episode int,
  last_seen_at timestamptz
)
language sql stable set search_path = '' as $$
  with mine as (
    select
      s.show_id,
      count(*)::int as seen_count,
      max(s.seen_at) as last_seen_at,
      (array_agg(s.season order by s.season desc, s.episode desc))[1] as last_season,
      (array_agg(s.episode order by s.season desc, s.episode desc))[1] as last_episode
    from public.episodes_seen s
    where s.user_id = auth.uid()
    group by s.show_id
  )
  select m.show_id, l.title, l.subtitle, l.poster, l.year, l.genres, l.runtime, l.creator, l.status,
         m.seen_count, m.last_season, m.last_episode, m.last_seen_at
  from mine m
  join public.library l
    on l.user_id = auth.uid() and l.media_type = 'tv' and l.media_id = m.show_id
  order by m.last_seen_at desc
  limit 60;
$$;

-- Mark (or unmark) episodes as seen. Also makes sure the show is in the library.
create or replace function public.mark_episodes(p_show jsonb, p_episodes jsonb, p_seen boolean)
returns void
language plpgsql set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_show_id text := p_show ->> 'id';
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if v_show_id is null or jsonb_typeof(p_episodes) <> 'array' or jsonb_array_length(p_episodes) > 3000 then
    raise exception 'invalid arguments';
  end if;

  insert into public.library (user_id, media_type, media_id, title, subtitle, poster, year, genres, runtime, creator)
  values (
    v_uid,
    'tv',
    v_show_id,
    coalesce(nullif(p_show ->> 'title', ''), '?'),
    p_show ->> 'subtitle',
    p_show ->> 'poster',
    (p_show ->> 'year')::int,
    coalesce(array(select jsonb_array_elements_text(
      case when jsonb_typeof(p_show -> 'genres') = 'array' then p_show -> 'genres' else '[]'::jsonb end)), '{}'),
    round((p_show ->> 'runtime')::numeric)::int,
    p_show ->> 'creator'
  )
  on conflict (user_id, media_type, media_id) do nothing;

  if p_seen then
    insert into public.episodes_seen (user_id, show_id, season, episode, runtime)
    select v_uid, v_show_id, (x ->> 'season')::int, (x ->> 'episode')::int,
           round((x ->> 'runtime')::numeric)::int
    from jsonb_array_elements(p_episodes) as x
    on conflict (user_id, show_id, season, episode) do nothing;
  else
    delete from public.episodes_seen s
    using jsonb_array_elements(p_episodes) as x
    where s.user_id = v_uid
      and s.show_id = v_show_id
      and s.season = (x ->> 'season')::int
      and s.episode = (x ->> 'episode')::int;
  end if;
end
$$;

create or replace function public.user_lists(p_user uuid)
returns table (
  id uuid,
  user_id uuid,
  title text,
  description text,
  ranked boolean,
  created_at timestamptz,
  updated_at timestamptz,
  item_count int,
  covers text[]
)
language sql stable set search_path = '' as $$
  select
    l.id, l.user_id, l.title, l.description, l.ranked, l.created_at, l.updated_at,
    (select count(*) from public.list_items i where i.list_id = l.id)::int,
    coalesce((
      select array_agg(x.poster order by x.position, x.added_at)
      from (
        select i.poster, i.position, i.added_at
        from public.list_items i
        where i.list_id = l.id
        order by i.position, i.added_at
        limit 4
      ) x), '{}')
  from public.lists l
  where l.user_id = p_user
  order by l.updated_at desc;
$$;

create or replace function public.reorder_list(p_list uuid, p_keys text[]) returns void
language sql set search_path = '' as $$
  update public.list_items i
  set position = k.ord
  from unnest(p_keys) with ordinality as k(key, ord)
  where i.list_id = p_list
    and (i.media_type || ':' || i.media_id) = k.key;
$$;

create or replace function public.create_match_room(p_kind text, p_deck jsonb)
returns public.match_rooms
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_room public.match_rooms;
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  for attempt in 1..30 loop
    v_code := '';
    for i in 1..5 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    begin
      insert into public.match_rooms (code, host_id, kind, deck)
      values (v_code, v_uid, p_kind, p_deck)
      returning * into v_room;
      exit;
    exception when unique_violation then
      -- the code is taken, try another one
    end;
  end loop;
  if v_room.id is null then
    raise exception 'could not allocate a room code';
  end if;
  insert into public.match_members (room_id, user_id) values (v_room.id, v_uid);
  return v_room;
end
$$;

create or replace function public.join_match_room(p_code text)
returns public.match_rooms
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_room public.match_rooms;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select * into v_room from public.match_rooms r where r.code = upper(trim(p_code));
  if not found then
    raise exception 'room not found';
  end if;
  if not exists (select 1 from public.match_members m where m.room_id = v_room.id and m.user_id = v_uid) then
    if (select count(*) from public.match_members m where m.room_id = v_room.id) >= 8 then
      raise exception 'room is full';
    end if;
    insert into public.match_members (room_id, user_id) values (v_room.id, v_uid);
  end if;
  return v_room;
end
$$;

create or replace function public.match_room_state(p_room uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'room', to_jsonb(r),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id,
               'username', p.username,
               'display_name', p.display_name,
               'avatar_emoji', p.avatar_emoji) order by m.joined_at)
      from public.match_members m
      join public.profiles p on p.id = m.user_id
      where m.room_id = r.id), '[]'::jsonb),
    'swipes', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', s.user_id, 'key', s.item_key, 'liked', s.liked))
      from public.match_swipes s
      where s.room_id = r.id), '[]'::jsonb)
  )
  from public.match_rooms r
  where r.id = p_room;
$$;

create or replace function public.my_match_rooms()
returns table (
  id uuid,
  code text,
  kind text,
  host_id uuid,
  created_at timestamptz,
  member_count int,
  deck_size int,
  match_count int
)
language sql stable set search_path = '' as $$
  select
    r.id, r.code, r.kind, r.host_id, r.created_at,
    (select count(*) from public.match_members m2 where m2.room_id = r.id)::int,
    jsonb_array_length(r.deck),
    (select count(*) from (
       select s.item_key
       from public.match_swipes s
       where s.room_id = r.id and s.liked
       group by s.item_key
       having count(*) >= 2
          and count(*) = (select count(*) from public.match_members m3 where m3.room_id = r.id)
     ) x)::int
  from public.match_rooms r
  join public.match_members m on m.room_id = r.id and m.user_id = auth.uid()
  where r.created_at > now() - interval '30 days'
  order by r.created_at desc
  limit 20;
$$;

-- In-app account deletion (required by the App Store guidelines).
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end
$$;

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on
  public.profiles, public.library, public.entries, public.episodes_seen, public.follows,
  public.entry_likes, public.comments, public.blocks, public.reports, public.lists,
  public.list_items, public.match_rooms, public.match_members, public.match_swipes
  to authenticated;
grant select on public.entry_cards, public.comment_cards to authenticated;

revoke all on function
  public.touch_updated_at(),
  public.handle_new_user(),
  public.list_items_before_insert(),
  public.list_items_touch_list()
  from public, anon, authenticated;

revoke all on function
  public.escape_like(text),
  public.hidden_for_me(uuid),
  public.is_room_member(uuid),
  public.username_available(text),
  public.feed(timestamptz, int, text),
  public.title_stats(text, text),
  public.title_friends(text, text),
  public.profile_card(uuid),
  public.search_profiles(text),
  public.suggested_profiles(int),
  public.taste_pairs(uuid),
  public.shows_in_progress(),
  public.mark_episodes(jsonb, jsonb, boolean),
  public.user_lists(uuid),
  public.reorder_list(uuid, text[]),
  public.create_match_room(text, jsonb),
  public.join_match_room(text),
  public.match_room_state(uuid),
  public.my_match_rooms(),
  public.delete_my_account()
  from public, anon;

grant execute on function
  public.escape_like(text),
  public.hidden_for_me(uuid),
  public.is_room_member(uuid),
  public.username_available(text),
  public.feed(timestamptz, int, text),
  public.title_stats(text, text),
  public.title_friends(text, text),
  public.profile_card(uuid),
  public.search_profiles(text),
  public.suggested_profiles(int),
  public.taste_pairs(uuid),
  public.shows_in_progress(),
  public.mark_episodes(jsonb, jsonb, boolean),
  public.user_lists(uuid),
  public.reorder_list(uuid, text[]),
  public.create_match_room(text, jsonb),
  public.join_match_room(text),
  public.match_room_state(uuid),
  public.my_match_rooms(),
  public.delete_my_account()
  to authenticated;

grant execute on function public.username_available(text) to anon;
