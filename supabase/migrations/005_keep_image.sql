-- Track which pages have images worth keeping for the final app
alter table review_queue add column keep_image boolean not null default false;
