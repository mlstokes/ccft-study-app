-- CCFT Study App Schema — Foundation
-- Content Outline structure (stable, from CCFT Content Outline PDF)
-- Study Materials catalog (from CCFT Study Material Reference List)
-- Everything else (sections, flashcards, questions, progress) deferred
-- until we've actually ingested content and seen its real shape.

-- ============================================================
-- CONTENT OUTLINE
-- ============================================================

create table domains (
  id text primary key,           -- e.g. 'D1', 'D2'
  code text not null,            -- e.g. '1', '2'
  name text not null,            -- e.g. 'Screening and Ongoing Assessment'
  exam_items integer not null,   -- number of scored items on exam
  exam_weight numeric not null,  -- percentage weight (e.g. 8, 14, 24)
  sort_order integer not null
);

create table tasks (
  id text primary key,           -- e.g. '1.1', '2.1'
  domain_id text not null references domains(id),
  code text not null,
  name text not null,
  sort_order integer not null
);

create table abilities (
  id text primary key,           -- e.g. '1.1.1', '2.2.3'
  task_id text not null references tasks(id),
  domain_id text not null references domains(id),
  code text not null,
  name text not null,
  sort_order integer not null
);

-- ============================================================
-- STUDY MATERIALS CATALOG
-- ============================================================

create table study_materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text,
  type text not null check (type in ('PDF', 'VIDEO', 'WEBLINK')),
  source_url text,
  primary_domain_id text references domains(id),
  created_at timestamptz not null default now()
);

-- Many-to-many: materials can apply to multiple domains
create table study_material_domains (
  study_material_id uuid not null references study_materials(id) on delete cascade,
  domain_id text not null references domains(id),
  primary key (study_material_id, domain_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_tasks_domain on tasks(domain_id);
create index idx_abilities_task on abilities(task_id);
create index idx_abilities_domain on abilities(domain_id);
