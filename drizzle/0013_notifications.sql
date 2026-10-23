CREATE SCHEMA "notifications";
--> statement-breakpoint
CREATE TABLE "notifications"."game_members" (
	"game_id" text NOT NULL,
	"player_id" text NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "game_members_game_id_player_id_pk" PRIMARY KEY("game_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "notifications"."notifications" (
	"position" bigint NOT NULL,
	"recipient_id" text NOT NULL,
	"kind" text NOT NULL,
	"subject_id" text NOT NULL,
	"outcome" text,
	"occurred_at" bigint NOT NULL,
	CONSTRAINT "notifications_position_recipient_id_pk" PRIMARY KEY("position","recipient_id")
);
--> statement-breakpoint
CREATE TABLE "notifications"."offer_parties" (
	"offer_id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX "game_members_created_at_idx" ON "notifications"."game_members" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_recipient_idx" ON "notifications"."notifications" USING btree ("recipient_id","position");--> statement-breakpoint
CREATE INDEX "notifications_occurred_at_idx" ON "notifications"."notifications" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "offer_parties_created_at_idx" ON "notifications"."offer_parties" USING btree ("created_at");