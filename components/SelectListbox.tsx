'use client';

import React, { useEffect, useRef, useState } from 'react';

type Option = { value: string; label: string };

type Props = {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  className?: string;
  placeholder?: string;
};

export default function SelectListbox({ value, onChange, options, className, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState<number>(-1);
  const ref = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value);
      setHighlighted(idx >= 0 ? idx : 0);
    } else {
      setHighlighted(-1);
    }
  }, [open, options, value]);

  const toggle = () => setOpen((v) => !v);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      e.preventDefault();
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
      buttonRef.current?.focus();
    }

    if (open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      let next = highlighted;
      if (next === -1) next = options.findIndex((o) => o.value === value);
      next = (next + dir + options.length) % options.length;
      setHighlighted(next);
      const el = document.getElementById(`select-opt-${next}`);
      el?.scrollIntoView({ block: 'nearest' });
    }

    if (open && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      if (highlighted >= 0) {
        onChange(options[highlighted].value);
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
  };

  return (
    <div ref={ref} className={`relative ${className || ''}`}>
      <button
        type="button"
        ref={buttonRef}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="input-aero w-full px-4 py-3 text-white rounded-xl flex justify-between items-center"
        onClick={toggle}
        onKeyDown={handleKeyDown}
      >
        <span className="truncate">{options.find((o) => o.value === value)?.label || placeholder || 'Select'}</span>
        <span className="ml-2 text-white/60">▾</span>
      </button>

      {open && (
        <ul
          role="listbox"
          tabIndex={-1}
          className="absolute z-50 mt-2 w-full bg-white rounded-lg shadow-lg max-h-48 overflow-auto"
        >
          {options.map((opt, idx) => (
            <li
              id={`select-opt-${idx}`}
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={`px-4 py-2 cursor-pointer ${opt.value === value ? 'bg-[#3573fb] text-white' : 'text-black'} hover:bg-[#4a90d9] hover:text-white`}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
                buttonRef.current?.focus();
              }}
              onMouseEnter={() => setHighlighted(idx)}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
