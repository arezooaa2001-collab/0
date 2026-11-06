-- EchoWords Cloud: private English vocabulary library.
-- Every row and every audio file belongs to exactly one user and is invisible to everyone else.

-- ─────────────────────────────────────────────────────────────
-- 1. Vocabulary table
-- ─────────────────────────────────────────────────────────────
create table if not exists public.words (
  id                 uuid primary key,
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,

  -- The original recording (immutable after insert, see trigger below).
  audio_path         text not null unique,
  audio_mime         text not null,
  audio_bytes        integer not null check (audio_bytes > 0 and audio_bytes <= 10485760),
  audio_sha256       text not null check (audio_sha256 ~ '^[0-9a-f]{64}$'),
  duration_ms        integer not null check (duration_ms > 0),

  -- What the learner wanted to say and how.
  accent             text not null default 'auto' check (accent in ('auto', 'us', 'uk')),
  hint               text check (char_length(hint) <= 200),

  -- The final English text shown in the library (null until known).
  transcript         text check (char_length(transcript) <= 500),
  transcript_edited  boolean not null default false,

  -- Raw result from the speech-to-text provider, kept separately so that
  -- a manual correction never loses what the machine heard.
  stt_status         text not null default 'pending'
                     check (stt_status in ('pending', 'processing', 'done', 'unclear', 'failed')),
  stt_transcript     text,
  stt_confidence     real check (stt_confidence is null or (stt_confidence >= 0 and stt_confidence <= 1)),
  stt_reason         text,
  stt_provider       text,
  stt_error          text,

  favorite           boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint words_audio_path_owner check (split_part(audio_path, '/', 1) = user_id::text)
);

create index if not exists words_user_created_idx on public.words (user_id, created_at desc);

-- Original-audio metadata can never be changed after the row is created.
create or replace function public.words_protect_original()
returns trigger
language plpgsql
as $$
begin
  if new.id           is distinct from old.id
  or new.user_id      is distinct from old.user_id
  or new.audio_path   is distinct from old.audio_path
  or new.audio_mime   is distinct from old.audio_mime
  or new.audio_bytes  is distinct from old.audio_bytes
  or new.audio_sha256 is distinct from old.audio_sha256
  or new.duration_ms  is distinct from old.duration_ms
  or new.created_at   is distinct from old.created_at then
    raise exception 'The original recording of a word cannot be changed.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists words_protect_original on public.words;
create trigger words_protect_original
  before update on public.words
  for each row execute function public.words_protect_original();

-- Row Level Security: each user sees and changes only their own words.
alter table public.words enable row level security;

drop policy if exists "words: owner can read"   on public.words;
drop policy if exists "words: owner can insert" on public.words;
drop policy if exists "words: owner can update" on public.words;
drop policy if exists "words: owner can delete" on public.words;

create policy "words: owner can read"   on public.words for select to authenticated using (user_id = auth.uid());
create policy "words: owner can insert" on public.words for insert to authenticated with check (user_id = auth.uid());
create policy "words: owner can update" on public.words for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "words: owner can delete" on public.words for delete to authenticated using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- 2. Private audio bucket
--    Path layout: <user_id>/<word_id>.<ext>
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recordings', 'recordings', false, 10485760,
  array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/wav', 'audio/x-m4a']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "recordings: owner can read"   on storage.objects;
drop policy if exists "recordings: owner can upload" on storage.objects;
drop policy if exists "recordings: owner can delete" on storage.objects;

create policy "recordings: owner can read" on storage.objects for select to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "recordings: owner can upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "recordings: owner can delete" on storage.objects for delete to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = auth.uid()::text);

-- Deliberately NO update policy: an uploaded original recording can never be overwritten.
