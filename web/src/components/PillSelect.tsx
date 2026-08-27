import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

export interface Option {
  value: string;
  label: string;
  badge?: string;
  cost?: number;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
  wide?: boolean;
  placeholder?: string;
}

export function PillSelect({
  value,
  options,
  onChange,
  disabled,
  wide,
  placeholder = '请选择',
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-normal text-sky-600 outline-none transition sm:text-sm',
          wide && 'w-[124px] justify-between sm:w-[160px]',
          open ? 'bg-sky-50' : 'hover:bg-neutral-100',
          disabled && 'cursor-not-allowed text-neutral-400 hover:bg-transparent'
        )}
      >
        <span className={cn('whitespace-nowrap flex items-center gap-1', wide && 'min-w-0 truncate text-left')}>
          <span className="truncate">{selected?.label ?? placeholder}</span>
          {selected?.cost ? (
            <span className="shrink-0 rounded bg-sky-100/80 px-1 py-0.2 text-[10px] font-medium leading-tight text-sky-700">
              {selected.cost}分
            </span>
          ) : null}
        </span>
        <ChevronDown size={14} className={cn('shrink-0 transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open && !disabled && (
        <div
          className={cn(
            'fixed inset-x-3 top-[calc(100%+0.75rem)] z-[60] max-h-[min(60vh,320px)] overflow-y-auto rounded-[18px] border border-neutral-200 bg-white p-1.5 shadow-[0_18px_50px_rgba(15,23,42,.20)] no-scrollbar',
            'sm:absolute sm:inset-x-auto sm:top-10 sm:max-h-64',
            wide ? 'sm:min-w-[220px]' : 'sm:min-w-[132px]'
          )}
          style={{ maxWidth: 'calc(100vw - 1.5rem)' }}
        >
          {options.map((opt) => {
            const isCur = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={opt.disabled}
                onClick={() => {
                  if (!opt.disabled) {
                    onChange(opt.value);
                    setOpen(false);
                  }
                }}
                className={cn(
                  'flex h-10 w-full items-center justify-between gap-2 rounded-[12px] px-3 text-left text-[13px] transition sm:h-9 sm:text-sm',
                  isCur ? 'bg-neutral-100 font-medium text-neutral-950' : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-950',
                  opt.disabled && 'cursor-not-allowed text-neutral-300 hover:bg-transparent'
                )}
              >
                <span className="truncate">{opt.label}</span>
                {opt.cost ? (
                  <span className={cn(
                    'shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium',
                    opt.cost >= 3 ? 'bg-purple-100 text-purple-700' : opt.cost === 2 ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700'
                  )}>
                    {opt.cost} 积分
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
