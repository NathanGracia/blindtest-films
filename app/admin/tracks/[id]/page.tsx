'use client';

import { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Category, Track } from '@/types';
import FileUpload from '@/components/admin/FileUpload';
import YoutubeDownload from '@/components/admin/YoutubeDownload';
import SelectListbox from '@/components/SelectListbox';
import TagInput from '@/components/admin/TagInput';

export default function EditTrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [track, setTrack] = useState<Track | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState('');
  const [titleVF, setTitleVF] = useState('');
  const [acceptedAnswers, setAcceptedAnswers] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [audioFile, setAudioFile] = useState('');
  const [imageFile, setImageFile] = useState('');
  const [timeLimit, setTimeLimit] = useState(30);
  const [startTime, setStartTime] = useState(0);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [audioTab, setAudioTab] = useState<'upload' | 'youtube'>('upload');

  // Reports
  const [reports, setReports] = useState<{ id: number; message: string; createdAt: string }[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [resettingReports, setResettingReports] = useState(false);

  // Audio preview
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [trackRes, catsRes] = await Promise.all([
          fetch(`/api/admin/tracks/${id}`),
          fetch('/api/admin/categories'),
        ]);

        if (catsRes.ok) {
          setCategories(await catsRes.json());
        }

        if (trackRes.ok) {
          const data = await trackRes.json();
          setTrack(data);
          setTitle(data.title);
          setTitleVF(data.titleVF || '');
          setAcceptedAnswers(data.acceptedAnswers);
          setCategoryId(data.categoryId);
          setAudioFile(data.audioFile);
          setImageFile(data.imageFile || '');
          setTimeLimit(data.timeLimit);
          setStartTime(data.startTime || 0);
        } else {
          setError('Musique non trouvée');
        }
      } catch {
        setError('Erreur de chargement');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/tracks/${id}/reports`)
      .then(r => r.ok ? r.json() : [])
      .then(setReports)
      .finally(() => setReportsLoading(false));
  }, [id]);

  const handleResetReports = async () => {
    setResettingReports(true);
    try {
      await fetch(`/api/admin/tracks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset-reports' }),
      });
      setReports([]);
      setTrack(prev => prev ? { ...prev, reportCount: 0 } : prev);
    } finally {
      setResettingReports(false);
    }
  };

  // Gestion de l'audio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setAudioDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioFile]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const playFromStartTime = () => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = startTime;
    audio.play();
    setIsPlaying(true);
  };

  const pauseAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    setIsPlaying(false);
  };

  const handleStartTimeChange = (newTime: number) => {
    setStartTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
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
      const res = await fetch(`/api/admin/tracks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          titleVF: titleVF || null,
          acceptedAnswers,
          categoryId,
          audioFile,
          imageFile: imageFile || null,
          timeLimit,
          startTime,
        }),
      });

      if (res.ok) {
        router.push('/admin/tracks');
      } else {
        const data = await res.json();
        setError(data.error || 'Erreur lors de la mise à jour');
      }
    } catch {
      setError('Erreur de connexion');
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <div className="flex items-center justify-center gap-3">
          <div className="w-6 h-6 border-2 border-[#7ec8e3] border-t-transparent rounded-full animate-spin" />
          <span className="text-white">Chargement...</span>
        </div>
      </div>
    );
  }

  if (!track) {
    return (
      <div className="glass rounded-xl p-8 text-center">
        <p className="text-red-400 mb-4">{error || 'Musique non trouvée'}</p>
        <Link href="/admin/tracks" className="btn-aero px-6 py-3 text-white rounded-xl">
          Retour aux musiques
        </Link>
      </div>
    );
  }

  const reportCount = reports.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/tracks" className="text-white/60 hover:text-white transition-colors">
            ← Retour aux musiques
          </Link>
          <h2 className="text-2xl font-bold text-white mt-2">Modifier la musique</h2>
        </div>
        <div className="flex gap-3">
          <button
            type="submit"
            form="track-edit-form"
            disabled={isLoading}
            className="btn-aero-green px-6 py-3 text-white font-semibold rounded-xl disabled:opacity-50"
          >
            {isLoading ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          <Link
            href="/admin/tracks"
            className="btn-aero px-6 py-3 text-white rounded-xl"
          >
            Annuler
          </Link>
        </div>
      </div>

      <div className="flex gap-6 items-start">
      <form id="track-edit-form" onSubmit={handleSubmit} className="space-y-6 flex-1 min-w-0">
        {error && (
          <div className="p-3 rounded-lg border border-red-500/50 bg-red-500/10 text-red-400">
            {error}
          </div>
        )}

        <div className="glass rounded-xl p-6 space-y-6">
          <h3 className="text-lg font-semibold text-white">Informations</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[#7ec8e3] text-sm mb-2 font-semibold">
                Titre VO (Version Originale) *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: The Lion King"
                className="input-aero w-full px-4 py-3 text-white rounded-xl"
                required
              />
            </div>

            <div>
              <label className="block text-[#7ec8e3] text-sm mb-2 font-semibold">
                Titre VF (Version Française)
              </label>
              <input
                type="text"
                value={titleVF}
                onChange={(e) => setTitleVF(e.target.value)}
                placeholder="Ex: Le Roi Lion"
                className="input-aero w-full px-4 py-3 text-white rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="block text-[#7ec8e3] text-sm mb-2 font-semibold">
              Réponses acceptées *
            </label>
            <TagInput
              tags={acceptedAnswers}
              onChange={setAcceptedAnswers}
              placeholder="Ajouter une réponse..."
            />
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
                className="input-aero w-full px-4 py-3 text-white rounded-xl
                  [&::-webkit-inner-spin-button]:hidden
                  [&::-webkit-outer-spin-button]:hidden
                  [-moz-appearance:textfield]"
              />
            </div>
          </div>
        </div>

        <div className="glass rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Fichier audio *</h3>
            <div className="flex rounded-lg overflow-hidden border border-white/20 text-sm">
              <button
                type="button"
                onClick={() => setAudioTab('upload')}
                className={`px-3 py-1.5 transition-colors ${audioTab === 'upload' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80'}`}
              >
                Upload
              </button>
              <button
                type="button"
                onClick={() => setAudioTab('youtube')}
                className={`px-3 py-1.5 transition-colors ${audioTab === 'youtube' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80'}`}
              >
                URL YouTube
              </button>
            </div>
          </div>
          {audioTab === 'upload' ? (
            <FileUpload
              type="audio"
              currentFile={audioFile}
              onUpload={setAudioFile}
            />
          ) : (
            <YoutubeDownload onDownload={(path) => { setAudioFile(path); setAudioTab('upload'); }} />
          )}

          {/* Preview audio avec startTime */}
          {audioFile && (
            <div className="space-y-4 pt-4 border-t border-white/10">
              <h4 className="text-md font-semibold text-[#7ec8e3]">Point de départ</h4>

              <audio ref={audioRef} src={audioFile} preload="metadata" />

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-white/60">
                  <span>Début: {formatTime(startTime)}</span>
                  <span>Durée totale: {formatTime(audioDuration)}</span>
                </div>

                {/* Slider pour le startTime */}
                <input
                  type="range"
                  min={0}
                  max={Math.max(audioDuration - 1, 0)}
                  step={0.1}
                  value={startTime}
                  onChange={(e) => handleStartTimeChange(parseFloat(e.target.value))}
                  className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#7ec8e3]"
                />

                {/* Input numérique pour plus de précision */}
                <div className="flex items-center gap-3">
                  <label className="text-white/60 text-sm">Seconde de départ:</label>
                  <input
                    type="number"
                    min={0}
                    max={Math.max(audioDuration - 1, 0)}
                    step={0.1}
                    value={startTime}
                    onChange={(e) => handleStartTimeChange(parseFloat(e.target.value) || 0)}
                    className="input-aero w-24 px-3 py-2 text-white rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* Boutons de contrôle */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={isPlaying ? pauseAudio : playFromStartTime}
                  className="btn-aero px-4 py-2 text-white rounded-lg flex items-center gap-2"
                >
                  {isPlaying ? (
                    <>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="4" width="4" height="16" />
                        <rect x="14" y="4" width="4" height="16" />
                      </svg>
                      Pause
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      Tester depuis ce point
                    </>
                  )}
                </button>

                {isPlaying && (
                  <span className="text-white/60 text-sm">
                    {formatTime(currentTime)} / {formatTime(audioDuration)}
                  </span>
                )}
              </div>

              <p className="text-white/40 text-xs">
                Définissez le moment où la musique commencera pendant le jeu. Utile pour démarrer directement au drop ou au refrain.
              </p>
            </div>
          )}
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
          {imageFile && (
            <button
              type="button"
              onClick={() => setImageFile('')}
              className="text-red-400 text-sm hover:text-red-300"
            >
              Supprimer l&apos;image
            </button>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isLoading}
            className="btn-aero-green px-6 py-3 text-white font-semibold rounded-xl disabled:opacity-50"
          >
            {isLoading ? 'Enregistrement...' : 'Enregistrer'}
          </button>
          <Link
            href="/admin/tracks"
            className="btn-aero px-6 py-3 text-white rounded-xl"
          >
            Annuler
          </Link>
        </div>
      </form>

      {/* Panneau reports */}
      <div className="w-72 shrink-0 sticky top-6">
        <div className="glass rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold" style={{ color: reportCount > 0 ? '#e8445a' : 'rgba(255,255,255,0.4)' }}>
              ⚑ Signalements {reportCount > 0 ? `(${reportCount})` : ''}
            </span>
            {reportCount > 0 && (
              <button
                onClick={handleResetReports}
                disabled={resettingReports}
                className="text-xs px-2 py-1 rounded transition-colors disabled:opacity-50"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
              >
                {resettingReports ? '...' : 'Reset'}
              </button>
            )}
          </div>

          {reportsLoading ? (
            <p className="text-white/30 text-xs">Chargement...</p>
          ) : reportCount === 0 ? (
            <p className="text-white/20 text-xs italic">Aucun signalement</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
              {reports.map(r => (
                <div key={r.id} className="text-xs" style={{ borderLeft: '2px solid rgba(232,68,90,0.4)', paddingLeft: 8 }}>
                  <p className="text-white/30 mb-0.5">
                    {new Date(r.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-white/70">{r.message || <span className="italic text-white/20">sans message</span>}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
