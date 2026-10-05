-- Unknown historic scores stay NULL. Never backfill a neutral estimate from other emotions.
alter table public.diary_entries
  add column neutral numeric
  constraint diary_entries_neutral_range check (neutral between 0 and 100);

comment on column public.diary_entries.neutral is
  'Independent 0-100 neutral intensity; NULL means unknown or not analysed. Not calm, not a balancing percentage.';

create index diary_entries_owner_neutral_ranking_idx
  on public.diary_entries(user_id, neutral desc, date desc)
  where neutral is not null;

notify pgrst, 'reload schema';
