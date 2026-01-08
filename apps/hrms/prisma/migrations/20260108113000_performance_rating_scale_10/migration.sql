-- Convert performance review ratings from a 1–5 scale to a 1–10 scale.
-- Existing values in the 1–5 range are multiplied by 2 (e.g. 3 → 6).
-- Values outside 1–5 (including 0/null) are left unchanged.

UPDATE "PerformanceReview"
SET
  "overallRating" = CASE WHEN "overallRating" BETWEEN 1 AND 5 THEN "overallRating" * 2 ELSE "overallRating" END,
  "qualityOfWork" = CASE WHEN "qualityOfWork" BETWEEN 1 AND 5 THEN "qualityOfWork" * 2 ELSE "qualityOfWork" END,
  "productivity" = CASE WHEN "productivity" BETWEEN 1 AND 5 THEN "productivity" * 2 ELSE "productivity" END,
  "communication" = CASE WHEN "communication" BETWEEN 1 AND 5 THEN "communication" * 2 ELSE "communication" END,
  "teamwork" = CASE WHEN "teamwork" BETWEEN 1 AND 5 THEN "teamwork" * 2 ELSE "teamwork" END,
  "initiative" = CASE WHEN "initiative" BETWEEN 1 AND 5 THEN "initiative" * 2 ELSE "initiative" END,
  "attendance" = CASE WHEN "attendance" BETWEEN 1 AND 5 THEN "attendance" * 2 ELSE "attendance" END,
  "ratingPrecision" = CASE WHEN "ratingPrecision" BETWEEN 1 AND 5 THEN "ratingPrecision" * 2 ELSE "ratingPrecision" END,
  "ratingTransparency" = CASE WHEN "ratingTransparency" BETWEEN 1 AND 5 THEN "ratingTransparency" * 2 ELSE "ratingTransparency" END,
  "ratingReliability" = CASE WHEN "ratingReliability" BETWEEN 1 AND 5 THEN "ratingReliability" * 2 ELSE "ratingReliability" END,
  "ratingInitiative" = CASE WHEN "ratingInitiative" BETWEEN 1 AND 5 THEN "ratingInitiative" * 2 ELSE "ratingInitiative" END,
  "selfRatingPrecision" = CASE WHEN "selfRatingPrecision" BETWEEN 1 AND 5 THEN "selfRatingPrecision" * 2 ELSE "selfRatingPrecision" END,
  "selfRatingTransparency" = CASE WHEN "selfRatingTransparency" BETWEEN 1 AND 5 THEN "selfRatingTransparency" * 2 ELSE "selfRatingTransparency" END,
  "selfRatingReliability" = CASE WHEN "selfRatingReliability" BETWEEN 1 AND 5 THEN "selfRatingReliability" * 2 ELSE "selfRatingReliability" END,
  "selfRatingInitiative" = CASE WHEN "selfRatingInitiative" BETWEEN 1 AND 5 THEN "selfRatingInitiative" * 2 ELSE "selfRatingInitiative" END;

