import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

import { IconX } from '@/components/icons';
import { cn } from '@/lib/cn';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Replaces the default title block, for headers with an avatar. */
  header?: ReactNode;
  footer?: ReactNode;
  width?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const WIDTHS = {
  sm: 'max-w-[420px]',
  md: 'max-w-[560px]',
  lg: 'max-w-[720px]',
};

/** macOS sheet: dimmed blurred backdrop, rounded card, drops in from the top. */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  header,
  footer,
  width = 'md',
  children,
}: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[3px] data-[state=open]:animate-[fadeIn_140ms_var(--ease-mac)]" />
        <Dialog.Content
          className={cn(
            'bg-elevated border-line rounded-sheet shadow-sheet fixed top-1/2 left-1/2 z-50 w-[calc(100vw-32px)]',
            '-translate-x-1/2 -translate-y-1/2 border',
            'flex max-h-[calc(100vh-48px)] flex-col overflow-hidden',
            'data-[state=open]:animate-[sheetIn_180ms_var(--ease-spring)]',
            WIDTHS[width]
          )}
        >
          <div className="border-divider flex items-start justify-between gap-4 border-b px-5 py-4">
            {header ?? (
              <div className="min-w-0">
                <Dialog.Title className="font-display text-ink text-[17px] font-bold">
                  {title}
                </Dialog.Title>
                {description ? (
                  <Dialog.Description className="text-muted mt-1 text-[12.5px]">
                    {description}
                  </Dialog.Description>
                ) : null}
              </div>
            )}
            <Dialog.Close
              className="text-muted hover:bg-hover hover:text-ink rounded-ctl -mt-1 -mr-1 flex h-8 w-8 shrink-0 items-center justify-center transition-colors"
              aria-label="Close"
            >
              <IconX size={16} />
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

          {footer ? (
            <div className="border-divider bg-card/60 flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3.5">
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Hidden title for sheets that supply their own header, so screen readers still get a name. */
export function SheetTitle({ children }: { children: ReactNode }) {
  return <Dialog.Title className="sr-only">{children}</Dialog.Title>;
}

export const SheetClose = Dialog.Close;
