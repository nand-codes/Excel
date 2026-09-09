import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({ id, label, error, hint, optional, className, children }: FieldProps) {
  return (
    <div className={cn('min-w-0', className)}>
      <label className="field-label" htmlFor={id}>
        {label}
        {optional ? <span className="text-muted font-normal"> (optional)</span> : null}
      </label>
      {children}
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="text-muted mt-1 block text-[11.5px]">{hint}</span>
      ) : null}
    </div>
  );
}

const CONTROL_CLASSES =
  'w-full rounded-ctl bg-field border border-line-strong px-3 text-[13px] text-ink ' +
  'placeholder:text-placeholder transition-[border-color,box-shadow] duration-150 ' +
  'focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent-ring focus-visible:shadow-none ' +
  'disabled:opacity-60';

export const controlClasses = CONTROL_CLASSES;

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function TextInput({ invalid, className, ...props }: TextInputProps) {
  return (
    <input
      className={cn(CONTROL_CLASSES, 'h-9', invalid && 'border-sys-red focus:border-sys-red', className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function TextArea({ invalid, className, rows = 3, ...props }: TextAreaProps) {
  return (
    <textarea
      rows={rows}
      className={cn(
        CONTROL_CLASSES,
        'resize-y py-2.5 leading-relaxed',
        invalid && 'border-sys-red focus:border-sys-red',
        className
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
}

export function Checkbox({ label, className, id, ...props }: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'rounded-ctl border-line hover:bg-hover flex cursor-pointer items-center gap-2.5 border px-3 py-2.5 text-[13px] transition-colors',
        className
      )}
    >
      <input
        id={id}
        type="checkbox"
        className="accent-accent h-4 w-4 shrink-0 cursor-pointer"
        {...props}
      />
      <span className="text-ink-soft select-none">{label}</span>
    </label>
  );
}
