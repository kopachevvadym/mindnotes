import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
}

/** Повноцінна емодзі-клавіатура (emoji-mart, у стилі Slack) у поповері. */
export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label="Обрати емодзі"
        className="shrink-0 rounded-md border border-border px-2 py-1.5 text-xl leading-none transition-colors hover:bg-accent/50 data-[state=open]:bg-accent/50"
      >
        {value}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={8}
          className="z-50 overflow-hidden rounded-lg shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0"
        >
          <Picker
            data={data}
            set="native"
            theme="light"
            locale="uk"
            previewPosition="none"
            onEmojiSelect={(emoji: { native: string }) => {
              onChange(emoji.native);
              setOpen(false);
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
