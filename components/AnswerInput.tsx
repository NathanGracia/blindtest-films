'use client';

import { useState, useRef, useEffect } from 'react';
import { Attempt } from '@/types';

interface AnswerInputProps {
  onSubmit: (answer: string) => void;
  attempts: Attempt[];
  disabled: boolean;
}

export default function AnswerInput({ onSubmit, attempts, disabled }: AnswerInputProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [attempts]);

  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  }, [disabled]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSubmit(input.trim());
      setInput('');
    }
  };

  return (
    <div className="flex flex-col h-full glass rounded-xl overflow-hidden">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-2 p-4 min-h-[200px] max-h-[300px]"
      >
        {attempts.length === 0 ? (
          <p className="text-white/40 text-center italic">
            Tape ta proposition ci-dessous...
          </p>
        ) : (
          attempts.map((attempt, index) => (
            <div
              key={index}
              className={`flex items-start gap-2 ${
                attempt.isCorrect ? 'animate-pulse' : ''
              }`}
            >
              <span
                className={`px-2 py-1 rounded text-sm font-bold ${
                  attempt.isCorrect
                    ? 'bg-[#7fba00]/30 text-[#7fba00] border border-[#7fba00]/50'
                    : 'bg-white/10 text-white/60 border border-white/20'
                }`}
              >
                {attempt.isCorrect ? '✓' : '✗'}
              </span>
              <span
                className={`${
                  attempt.isCorrect ? 'text-[#7fba00] font-bold' : 'text-white/70'
                }`}
              >
                {attempt.text}
              </span>
            </div>
          ))
        )}
      </div>
      <form onSubmit={handleSubmit} className="flex border-t border-white/20">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={disabled}
          placeholder={disabled ? 'En attente...' : 'Quel est ce film ?'}
          className="input-aero flex-1 px-4 py-3 text-white rounded-none border-0"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="btn-aero px-6 py-3 text-white rounded-none border-0 border-l border-white/20 disabled:opacity-50"
        >
          Envoyer
        </button>
      </form>
    </div>
  );
}
