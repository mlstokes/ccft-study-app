-- CCFT Study App — Content Sections Schema
-- Extends foundation schema (001) with full content model.
-- Vault is upstream — this schema mirrors the vault note shapes
-- in CCFT/Materials/ and CCFT/Sections/.

-- ============================================================
-- EXTEND STUDY MATERIALS
-- ============================================================

-- Add fields that exist in vault material notes but were deferred
-- from 001 until we saw the actual data shape.
alter table study_materials
  add column video_url text,
  add column ingest_status text not null default 'pending'
    check (ingest_status in ('pending', 'ingested', 'external', 'failed')),
  add column ingest_date date,
  add column section_count integer not null default 0,
  add column is_supplemental boolean not null default false;

-- Course tags on materials (L1, L2, Kids, Aging, CCFT)
create table study_material_courses (
  study_material_id uuid not null references study_materials(id) on delete cascade,
  course text not null check (course in ('L1', 'L2', 'Kids', 'Aging', 'CCFT')),
  primary key (study_material_id, course)
);

-- ============================================================
-- CONTENT SECTIONS
-- ============================================================

-- Each row is a paragraph-level chunk of study material.
-- Body text uses the exact source wording — no paraphrasing.
create table content_sections (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references study_materials(id) on delete cascade,
  section_order integer not null,
  body text not null,
  split_logic text,           -- how this chunk was split from the source
  created_at timestamptz not null default now(),

  unique (material_id, section_order)
);

-- Section ↔ Domain (many-to-many)
-- Sections may narrow from the parent material's broad domain assignment.
create table content_section_domains (
  section_id uuid not null references content_sections(id) on delete cascade,
  domain_id text not null references domains(id),
  primary key (section_id, domain_id)
);

-- Section ↔ Ability (many-to-many)
-- This is the core relationship: connects study content to testable
-- abilities from the Content Outline. Enables "show me all content
-- for ability 4.2.6" and per-ability progress tracking.
create table content_section_abilities (
  section_id uuid not null references content_sections(id) on delete cascade,
  ability_id text not null references abilities(id),
  primary key (section_id, ability_id)
);

-- Course tags on sections (inherited from material, but stored
-- explicitly so sections can be filtered independently).
create table content_section_courses (
  section_id uuid not null references content_sections(id) on delete cascade,
  course text not null check (course in ('L1', 'L2', 'Kids', 'Aging', 'CCFT')),
  primary key (section_id, course)
);

-- ============================================================
-- UNIQUE CONSTRAINTS (for upsert idempotency)
-- ============================================================

-- Title is the natural key for materials (vault filenames derive from title)
alter table study_materials add constraint uq_study_materials_title unique (title);

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_content_sections_material on content_sections(material_id);
create index idx_content_sections_order on content_sections(material_id, section_order);
create index idx_section_domains_domain on content_section_domains(domain_id);
create index idx_section_abilities_ability on content_section_abilities(ability_id);
create index idx_section_courses_course on content_section_courses(course);
create index idx_material_courses_course on study_material_courses(course);
create index idx_materials_ingest_status on study_materials(ingest_status);
