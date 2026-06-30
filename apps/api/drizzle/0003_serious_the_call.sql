CREATE TABLE "idea_thought" (
	"idea_id" uuid NOT NULL,
	"thought_id" uuid NOT NULL,
	CONSTRAINT "idea_thought_idea_id_thought_id_pk" PRIMARY KEY("idea_id","thought_id")
);
--> statement-breakpoint
CREATE TABLE "idea" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thesis" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "idea_thought" ADD CONSTRAINT "idea_thought_idea_id_idea_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."idea"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_thought" ADD CONSTRAINT "idea_thought_thought_id_thought_id_fk" FOREIGN KEY ("thought_id") REFERENCES "public"."thought"("id") ON DELETE cascade ON UPDATE no action;