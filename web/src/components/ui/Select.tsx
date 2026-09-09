import * as RadixSelect from '@radix-ui/react-select';

import { IconCheck, IconChevronDown } from '@/components/icons';
import { cn } from '@/lib/cn';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  invalid?: boolean;
  className?: string;
  size?: 'sm' | 'md';
  ariaLabel?: string;
  /** Form fields stretch; toolbar filters size to their content. */
  fullWidth?: boolean;
}

/**
 * Radix select styled as a macOS pop-up button. Radix is used rather than a native
 * `<select>` so the menu matches the rest of the appearance in both themes.
 */
export function Select({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  invalid,
  className,
  size = 'md',
  ariaLabel,
  fullWidth = true,
}: SelectProps) {
  return (
    <RadixSelect.Root value={value} onValueChange={onChange}>
      <RadixSelect.Trigger
        id={id}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        className={cn(
          'rounded-ctl bg-field border-line-strong text-ink flex items-center justify-between gap-2 border px-3',
          fullWidth ? 'w-full' : 'w-auto',
          'focus:border-accent focus:ring-accent-ring focus-visible:shadow-none text-left transition-[border-color,box-shadow] duration-150 focus:ring-3 focus:outline-none',
          'data-[placeholder]:text-placeholder',
          size === 'sm' ? 'h-[30px] text-[12.5px]' : 'h-9 text-[13px]',
          invalid && 'border-sys-red focus:border-sys-red',
          className
        )}
      >
        <RadixSelect.Value placeholder={placeholder} className="truncate" />
        <RadixSelect.Icon className="text-muted shrink-0">
          <IconChevronDown size={14} />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={6}
          className={cn(
            'bg-elevated/95 border-line rounded-card shadow-mac-lg z-50 max-h-[320px] overflow-hidden border backdrop-blur-2xl',
            'data-[state=open]:animate-[fadeIn_120ms_var(--ease-mac)]'
          )}
        >
          <RadixSelect.Viewport className="p-1.5">
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                className={cn(
                  'rounded-[6px] text-ink flex cursor-pointer items-center justify-between gap-3 px-2.5 py-1.5 text-[13px] select-none',
                  'data-[highlighted]:bg-accent data-[highlighted]:text-white data-[highlighted]:outline-none'
                )}
              >
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator>
                  <IconCheck size={14} />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
