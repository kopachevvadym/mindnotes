ALTER TABLE `idea` RENAME TO `context`;
--> statement-breakpoint
ALTER TABLE `idea_thought` RENAME TO `context_thought`;
--> statement-breakpoint
ALTER TABLE `context_thought` RENAME COLUMN `idea_id` TO `context_id`;
