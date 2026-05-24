-- Review Queue — human-in-the-loop validation of paragraph-level tagging
-- Claude proposes domain + thingToLearn, user accepts/edits/rejects

create table review_queue (
  id uuid primary key default gen_random_uuid(),
  material text not null,
  category text not null,          -- e.g., 'Methodology', 'Movements'
  article text not null,           -- e.g., 'Understanding CrossFit'
  section_heading text,            -- e.g., 'Aims' (null for intro/unheaded paragraphs)
  paragraph_order integer not null,
  body text not null,
  page_number integer,
  proposed_domains text[] not null default '{}',
  proposed_thing_to_learn text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'edited', 'rejected', 'skipped')),
  final_domains text[],
  final_thing_to_learn text,
  reviewer_notes text,             -- free-form notes from reviewer
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_review_queue_status on review_queue(status);
create index idx_review_queue_material on review_queue(material);
create index idx_review_queue_order on review_queue(material, article, paragraph_order);
