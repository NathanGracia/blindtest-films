'use client';

import { useState, useRef } from 'react';

interface FileUploadProps {
  type: 'audio' | 'image';
  currentFile?: string | null;
  onUpload: (path: string) => void;
}

export default function FileUpload({ type, currentFile, onUpload }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptTypes = type === 'audio'
    ? 'audio/mpeg,audio/mp3,audio/wav,audio/ogg'
    : 'image/jpeg,image/png,image/webp,image/gif';

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      await uploadFile(file);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file);
    }
  };

  const uploadFile = async (file: File) => {
    setError('');
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        onUpload(data.path);
      } else {
        const data = await res.json();
        setError(data.error || 'Erreur lors de l\'upload');
      }
    } catch {
      setError('Erreur de connexion');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
          ${isDragging
            ? 'border-[#7ec8e3] bg-[#7ec8e3]/10'
            : 'border-white/20 hover:border-white/40'
          }
          ${isUploading ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={acceptTypes}
          onChange={handleChange}
          className="hidden"
        />

        {isUploading ? (
          <div className="flex items-center justify-center gap-3">
            <div className="w-6 h-6 border-2 border-[#7ec8e3] border-t-transparent rounded-full animate-spin" />
            <span className="text-white">Upload en cours...</span>
          </div>
        ) : (
          <>
            <div className="text-3xl mb-2">
              {type === 'audio' ? '🎵' : '🖼️'}
            </div>
            <p className="text-white/70">
              Glissez un fichier ici ou cliquez pour parcourir
            </p>
            <p className="text-white/40 text-sm mt-1">
              {type === 'audio' ? 'MP3, WAV, OGG' : 'JPG, PNG, WebP, GIF'}
            </p>
          </>
        )}
      </div>

      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

      {currentFile && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
          {type === 'image' ? (
            <img
              src={currentFile}
              alt="Aperçu"
              className="w-12 h-12 rounded object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded bg-[#4a90d9]/20 flex items-center justify-center">
              <span className="text-xl">🎵</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm truncate">{currentFile}</p>
            <p className="text-white/40 text-xs">Fichier actuel</p>
          </div>
          {type === 'audio' && (
            <audio src={currentFile} controls className="h-8" />
          )}
        </div>
      )}
    </div>
  );
}
