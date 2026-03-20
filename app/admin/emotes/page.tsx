'use client';

import { useState, useEffect, useRef } from 'react';

interface Emote {
  id: number;
  code: string;
  imageFile: string | null;
}


export default function AdminEmotesPage() {
  const [emotes, setEmotes] = useState<Emote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [newCode, setNewCode] = useState('');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newPreview, setNewPreview] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const newFileRef = useRef<HTMLInputElement>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCode, setEditCode] = useState('');
  const [saving, setSaving] = useState(false);

  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => { loadEmotes(); }, []);

  const loadEmotes = async () => {
    try {
      const res = await fetch('/api/admin/emotes');
      setEmotes(await res.json());
    } catch {
      setError('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleNewFileChange = (file: File | null) => {
    setNewFile(file);
    if (file) {
      setNewPreview(URL.createObjectURL(file));
    } else {
      setNewPreview(null);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newFile) return;
    setAdding(true);
    setError('');
    try {
      // Étape 1 : créer l'emote
      const res = await fetch('/api/admin/emotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: newCode.trim().toLowerCase() }),
      });
      const created = await res.json();
      if (!res.ok) { setError(created.error); return; }

      // Étape 2 : uploader l'image
      const formData = new FormData();
      formData.append('image', newFile);
      const uploadRes = await fetch(`/api/admin/emotes/${created.id}/image`, { method: 'POST', body: formData });
      const final = await uploadRes.json();
      if (!uploadRes.ok) { setError(final.error); return; }

      setEmotes(prev => [...prev, final].sort((a, b) => a.code.localeCompare(b.code)));
      setNewCode('');
      setNewFile(null);
      setNewPreview(null);
      if (newFileRef.current) newFileRef.current.value = '';
    } catch {
      setError('Erreur serveur');
    } finally {
      setAdding(false);
    }
  };

  const handleSave = async (id: number) => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/emotes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: editCode.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setEmotes(prev => prev.map(e => e.id === id ? data : e).sort((a, b) => a.code.localeCompare(b.code)));
      setEditingId(null);
    } catch {
      setError('Erreur serveur');
    } finally {
      setSaving(false);
    }
  };


  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer cette emote ?')) return;
    try {
      await fetch(`/api/admin/emotes/${id}`, { method: 'DELETE' });
      setEmotes(prev => prev.filter(e => e.id !== id));
    } catch {
      setError('Erreur serveur');
    }
  };

  const handleImageUpload = async (id: number, file: File) => {
    setUploadingId(id);
    setError('');
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(`/api/admin/emotes/${id}/image`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setEmotes(prev => prev.map(e => e.id === id ? data : e));
    } catch {
      setError('Erreur upload');
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Emotes ({emotes.length})</h1>

      {error && (
        <div className="glass rounded-xl p-3 bg-red-500/20 border border-red-500/30 text-red-300 text-sm">{error}</div>
      )}

      {/* Formulaire ajout */}
      <div className="glass rounded-xl p-4">
        <h2 className="text-white font-semibold mb-3">Ajouter une emote</h2>
        <form onSubmit={handleAdd} className="flex items-end gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-white/60 text-xs">Code (sans :)</label>
            <input
              type="text"
              value={newCode}
              onChange={e => setNewCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="gg, rip, fire..."
              className="input-aero px-3 py-2 text-white rounded-lg text-sm w-36"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-white/60 text-xs">Image (PNG, JPG, GIF, WebP)</label>
            <div className="flex items-center gap-2">
              {newPreview && (
                <img src={newPreview} alt="preview" className="w-8 h-8 object-contain rounded" />
              )}
              <input
                ref={newFileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={e => handleNewFileChange(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => newFileRef.current?.click()}
                className="input-aero px-3 py-2 text-white/70 hover:text-white rounded-lg text-sm transition-colors"
              >
                {newFile ? newFile.name : 'Choisir un fichier…'}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={adding || !newCode || !newFile}
            className="btn-aero px-4 py-2 text-white rounded-lg text-sm disabled:opacity-50"
          >
            {adding ? 'Ajout...' : '+ Ajouter'}
          </button>
        </form>
      </div>

      {/* Liste */}
      <div className="glass rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-white/40">Chargement...</div>
        ) : emotes.length === 0 ? (
          <div className="p-8 text-center text-white/40">Aucune emote — ajoutez-en ci-dessus</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-4 py-3 text-white/60 text-sm font-medium w-16">Aperçu</th>
                <th className="text-left px-4 py-3 text-white/60 text-sm font-medium">Code</th>
                <th className="text-left px-4 py-3 text-white/60 text-sm font-medium">Fichier</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {emotes.map(emote => (
                <tr key={emote.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    {emote.imageFile
                      ? <img src={emote.imageFile} alt={emote.code} className="w-8 h-8 object-contain" />
                      : <span className="text-white/20 text-xs">—</span>
                    }
                  </td>

                  {editingId === emote.id ? (
                    <>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={editCode}
                          onChange={e => setEditCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                          className="input-aero px-2 py-1 text-white rounded text-sm w-32"
                          autoFocus
                        />
                      </td>
                      <td className="px-4 py-2 text-white/30 text-xs">—</td>
                      <td className="px-4 py-2 flex gap-2 justify-end">
                        <button onClick={() => handleSave(emote.id)} disabled={saving}
                          className="text-xs px-3 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded transition-all">
                          {saving ? '...' : 'Sauvegarder'}
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="text-xs px-3 py-1 text-white/50 hover:text-white/80 transition-colors">
                          Annuler
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-white font-mono text-sm">:{emote.code}:</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-white/50 text-xs">{emote.imageFile?.split('/').pop() ?? '—'}</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            className="hidden"
                            ref={el => { fileInputRefs.current[emote.id] = el; }}
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) handleImageUpload(emote.id, file);
                              e.target.value = '';
                            }}
                          />
                          <button
                            onClick={() => fileInputRefs.current[emote.id]?.click()}
                            disabled={uploadingId === emote.id}
                            className="text-xs px-2 py-0.5 bg-[#4a90d9]/20 hover:bg-[#4a90d9]/30 text-[#7ec8e3] rounded transition-all disabled:opacity-50"
                          >
                            {uploadingId === emote.id ? 'Upload...' : emote.imageFile ? 'Changer' : 'Upload'}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 flex gap-2 justify-end">
                        <button onClick={() => { setEditingId(emote.id); setEditCode(emote.code); }}
                          className="text-xs px-3 py-1 text-white/50 hover:text-white/80 hover:bg-white/5 rounded transition-all">
                          Renommer
                        </button>
                        <button onClick={() => handleDelete(emote.id)}
                          className="text-xs px-3 py-1 text-red-400/60 hover:text-red-400 hover:bg-red-400/10 rounded transition-all">
                          Supprimer
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
