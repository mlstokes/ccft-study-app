-- Store crop region as percentages (0-100) for kept images
alter table review_queue add column image_crop jsonb;
-- Format: {"x": 0, "y": 25, "w": 100, "h": 50} = full width, middle 50%
