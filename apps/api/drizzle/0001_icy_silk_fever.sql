CREATE TABLE "context" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "thought_context" (
	"thought_id" uuid NOT NULL,
	"context_id" uuid NOT NULL,
	CONSTRAINT "thought_context_thought_id_context_id_pk" PRIMARY KEY("thought_id","context_id")
);
--> statement-breakpoint
ALTER TABLE "thought_context" ADD CONSTRAINT "thought_context_thought_id_thought_id_fk" FOREIGN KEY ("thought_id") REFERENCES "public"."thought"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thought_context" ADD CONSTRAINT "thought_context_context_id_context_id_fk" FOREIGN KEY ("context_id") REFERENCES "public"."context"("id") ON DELETE cascade ON UPDATE no action;