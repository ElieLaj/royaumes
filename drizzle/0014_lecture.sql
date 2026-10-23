CREATE TABLE "notifications"."read_marks" (
	"player_id" text PRIMARY KEY NOT NULL,
	"read_until" bigint DEFAULT 0 NOT NULL
);
