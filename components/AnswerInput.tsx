'use client';

import { useState, useRef, useEffect } from 'react';
import { Attempt } from '@/types';
import { normalizeAnswer } from '@/lib/utils';

interface TrackSuggestion {
  title: string;
  titleVF: string | null;
  acceptedAnswers: string[];
  categoryId: string;
}

interface AnswerInputProps {
  onSubmit: (answer: string) => void;
  attempts: Attempt[];
  disabled: boolean;
  availableAnswers?: TrackSuggestion[];
}

export default function AnswerInput({ onSubmit, attempts, disabled, availableAnswers }: AnswerInputProps) {
  const [input, setInput] = useState('');
  const [filteredSuggestions, setFilteredSuggestions] = useState<TrackSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (selectedIndex >= 0 && dropdownRef.current) {
      const selected = dropdownRef.current.children[selectedIndex] as HTMLElement;
      selected?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  const handleInputChange = (value: string) => {
    setInput(value);

    if (!availableAnswers || value.trim().length < 2) {
      setShowDropdown(false);
      return;
    }

    const normalized = normalizeAnswer(value);
    const matches = availableAnswers
      .filter(track => {
        // Rechercher dans le titre VO
        const titleNorm = normalizeAnswer(track.title);
        if (titleNorm.includes(normalized)) return true;

        // Rechercher dans le titre VF
        if (track.titleVF) {
          const titleVFNorm = normalizeAnswer(track.titleVF);
          if (titleVFNorm.includes(normalized)) return true;
        }

        // Rechercher dans les réponses acceptées
        return track.acceptedAnswers.some(answer => {
          const answerNorm = normalizeAnswer(answer);
          return answerNorm.includes(normalized);
        });
      })
      .slice(0, 8);

    setFilteredSuggestions(matches);
    setShowDropdown(matches.length > 0);
    setSelectedIndex(matches.length > 0 ? 0 : -1);
  };

  const selectSuggestion = (suggestion: TrackSuggestion) => {
    setInput(suggestion.title);
    setShowDropdown(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || filteredSuggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Tab':
        e.preventDefault();
        selectSuggestion(filteredSuggestions[selectedIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        setShowDropdown(false);
        break;
      case 'Enter':
        e.preventDefault();
        selectSuggestion(filteredSuggestions[selectedIndex]);
        break;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSubmit(input.trim());
      setInput('');
      setShowDropdown(false);
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
      <div className="relative">
        <form onSubmit={handleSubmit} className="flex border-t border-white/20">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={disabled ? 'En attente...' : 'Quel est ce film ?'}
            className="input-aero flex-1 px-4 py-3 text-white rounded-none border-0"
            autoComplete="off"
            aria-autocomplete="list"
            aria-controls="autocomplete-dropdown"
            aria-expanded={showDropdown}
          />
          <button
            type="submit"
            disabled={disabled || !input.trim()}
            className="btn-aero px-6 py-3 text-white rounded-none border-0 border-l border-white/20 disabled:opacity-50"
          >
            Envoyer
          </button>
        </form>

        {showDropdown && filteredSuggestions.length > 0 && (
          <div
            ref={dropdownRef}
            id="autocomplete-dropdown"
            role="listbox"
            className="absolute top-full left-0 right-0 mt-1 glass rounded-lg overflow-hidden max-h-[240px] overflow-y-auto z-50"
          >
            {filteredSuggestions.map((suggestion, index) => {
              const displayText = suggestion.titleVF
                ? `${suggestion.title} - ${suggestion.titleVF}`
                : suggestion.title;

              return (
                <div
                  key={index}
                  role="option"
                  aria-selected={index === selectedIndex}
                  onClick={() => selectSuggestion(suggestion)}
                  className={`px-4 py-3 cursor-pointer transition-colors ${
                    index === selectedIndex
                      ? 'bg-[#4a90d9]/40 border-l-4 border-[#4a90d9] text-white font-semibold'
                      : index === 0 && selectedIndex === -1
                        ? 'bg-[#4a90d9]/20 border-l-2 border-[#4a90d9]/50 text-white'
                        : 'hover:bg-white/10 text-white/90'
                  }`}
                >
                  {displayText}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
