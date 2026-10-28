CREATE SCHEMA "avatars";
--> statement-breakpoint
CREATE TABLE "avatars"."skins" (
	"player_id" text PRIMARY KEY NOT NULL,
	"skin" text NOT NULL,
	"chosen_at" bigint NOT NULL
);
