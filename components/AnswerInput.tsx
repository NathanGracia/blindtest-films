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
            className="glass absolute top-full left-0 right-0 z-50 overflow-hidden overflow-y-auto"
            style={{
              marginTop: 6,
              maxHeight: 252,
              borderRadius: 10,
              scrollbarWidth: 'none',
            }}
          >
            {filteredSuggestions.map((suggestion, index) => {
              const isSelected = index === selectedIndex;

              return (
                <div
                  key={index}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => selectSuggestion(suggestion)}
                  className="cursor-pointer transition-all duration-100"
                  style={{
                    padding: '7px 12px 7px 14px',
                    borderLeft: isSelected
                      ? '3px solid #7ec8e3'
                      : '3px solid transparent',
                    background: isSelected
                      ? 'linear-gradient(90deg, rgba(126,200,227,0.12) 0%, rgba(126,200,227,0.04) 100%)'
                      : 'transparent',
                    borderBottom: index < filteredSuggestions.length - 1
                      ? '1px solid rgba(255,255,255,0.04)'
                      : 'none',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  <div
                    className="text-sm leading-tight truncate"
                    style={{
                      color: isSelected ? '#ffffff' : 'rgba(255,255,255,0.88)',
                      fontWeight: isSelected ? 600 : 400,
                      letterSpacing: isSelected ? '0.01em' : undefined,
                      textShadow: isSelected ? '0 0 12px rgba(126,200,227,0.4)' : undefined,
                    }}
                  >
                    {suggestion.title}
                  </div>
                  {suggestion.titleVF && (
                    <div
                      className="text-xs leading-tight truncate mt-0.5"
                      style={{ color: isSelected ? 'rgba(126,200,227,0.7)' : 'rgba(255,255,255,0.35)' }}
                    >
                      {suggestion.titleVF}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
