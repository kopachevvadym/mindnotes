CREATE TABLE `idea_thought` (
	`idea_id` text NOT NULL,
	`thought_id` text NOT NULL,
	PRIMARY KEY(`idea_id`, `thought_id`),
	FOREIGN KEY (`idea_id`) REFERENCES `idea`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`thought_id`) REFERENCES `thought`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `idea` (
	`id` text PRIMARY KEY NOT NULL,
	`thesis` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text,
	`started_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `thought` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`body` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade
);
