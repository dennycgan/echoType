-- Rename duplicate course titles within the same user+mode (keep oldest unchanged).
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "userId", mode, title
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
  FROM courses
)
UPDATE courses AS c
SET title = c.title || ' (' || r.rn || ')'
FROM ranked AS r
WHERE c.id = r.id AND r.rn > 1;

-- CreateIndex
CREATE UNIQUE INDEX "courses_userId_mode_title_key" ON "courses"("userId", "mode", "title");
