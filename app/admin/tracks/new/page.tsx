'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Category } from '@/types';
import FileUpload from '@/components/admin/FileUpload';
import SelectListbox from '@/components/SelectListbox';

export default function NewTrackPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState('');
  const [acceptedAnswers, setAcceptedAnswers] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [audioFile, setAudioFile] = useState('');
  const [imageFile, setImageFile] = useState('');
  const [timeLimit, setTimeLimit] = useState(30);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadCategories = async () => {
      const res = await fetch('/api/admin/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
        if (data.length > 0) {
          setCategoryId(data[0].id);
        }
      }
    };
    loadCategories();
  }, []);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    // Auto-générer les réponses acceptées si le champ est vide
    if (!acceptedAnswers) {
      const normalized = value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      setAcceptedAnswers(normalized !== value.toLowerCase() ? `${value.toLowerCase()}, ${normalized}` : value.toLowerCase());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!audioFile) {
      setError('Veuillez uploader un fichier audio');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/tracks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          acceptedAnswers: acceptedAnswers.split(',').map(a => a.trim()).filter(Boolean),
          categoryId,
          audioFile,
          imageFile: imageFile || null,
          timeLimit,
        }),
      });

      if (res.ok) {
        router.push('/admin/tracks');
      } else {
        const data = await res.json();
        setError(data.error || 'Erreur lors de la création');
      }
    } catch {
      setError('Erreur de connexion');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/tracks" className="text-white/60 hover:text-white transition-colors">
          ← Retour aux musiques
        </Link>
        <h2 className="text-2xl font-bold text-white mt-2">Nouvelle musique</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        {error && (
          <div className="p-3 rounded-lg border border-red-500/50 bg-red-500/10 text-red-400">
            {error}
          </div>
        )}

        <div className="glass rounded-xl p-6 space-y-6">
          <h3 className="text-lg font-semibold text-white">Informations</h3>

          <div>
            <label className="block text-[#7ec8e3] text-sm mb-2 font-semibold">
              Titre *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Ex: Le Roi Lion"
              className="input-aero w-full px-4 py-3 text-white rounded-xl"
              required
            />
          </div>

          <div>
            <label className="block text-[#7ec8e3] text-sm mb-2 font-semibold">
              Réponses acceptées *
            </label>
            <input
              type="text"
              value={acceptedAnswers}
              onChange={(e) => setAcceptedAnswers(e.target.value)}
              placeholder="roi lion, le roi lion, lion king"
              className="input-aero w-full px-4 py-3 text-white rounded-xl"
              required
            />
            <p className="text-white/40 text-xs mt-1">
              Séparez les réponses par des virgules. Incluez les variantes sans accents.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[#7ec8e3] text-sm mb-2 font-semibold">
                Catégorie *
              </label>
              <SelectListbox
                options={categories.map((cat) => ({ value: cat.id, label: cat.name }))}
                value={categoryId}
                onChange={(v) => setCategoryId(v)}
                className="w-full"
                placeholder="Sélectionne une catégorie"
              />
            </div>

            <div>
              <label className="block text-[#7ec8e3] text-sm mb-2 font-semibold">
                Temps limite (secondes)
              </label>
              <input
                type="number"
                value={timeLimit}
                onChange={(e) => setTimeLimit(parseInt(e.target.value) || 30)}
                min={10}
                max={120}
                className="input-aero w-full px-4 py-3 text-white rounded-xl"
              />
            </div>
          </div>
        </div>

        <div className="glass rounded-xl p-6 space-y-6">
          <h3 className="text-lg font-semibold text-white">Fichier audio *</h3>
          <FileUpload
            type="audio"
            currentFile={audioFile}
            onUpload={setAudioFile}
          />
        </div>

        <div className="glass rounded-xl p-6 space-y-6">
          <h3 className="text-lg font-semibold text-white">
            Image <span className="text-white/40 font-normal">(optionnel)</span>
          </h3>
          <FileUpload
            type="image"
            currentFile={imageFile}
            onUpload={setImageFile}
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isLoading}
            className="btn-aero-green px-6 py-3 text-white font-semibold rounded-xl disabled:opacity-50"
          >
            {isLoading ? 'Création...' : 'Créer la musique'}
          </button>
          <Link
            href="/admin/tracks"
            className="btn-aero px-6 py-3 text-white rounded-xl"
          >
            Annuler
          </Link>
        </div>
      </form>
    </div>
  );
}
