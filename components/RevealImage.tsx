'use client';

import { useState, useEffect } from 'react';

interface RevealImageProps {
  src: string | null;
  alt: string;
  className?: string;
}

export default function RevealImage({ src, alt, className = '' }: RevealImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [showImage, setShowImage] = useState(false);

  useEffect(() => {
    setIsLoaded(false);
    setShowImage(false);
    const timer = setTimeout(() => setShowImage(true), 100);
    return () => clearTimeout(timer);
  }, [src]);

  if (!src) return null;

  const visible = showImage && isLoaded;

  return (
    <div className={`relative transition-all duration-500 ease-out ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'} ${className}`}>
      {/* Halo derrière l'image */}
      <div className="absolute inset-0 rounded-xl blur-md opacity-40" style={{ background: 'radial-gradient(ellipse at center, rgba(126,200,227,0.6), transparent 70%)' }} />

      {/* Image */}
      <img
        src={src}
        alt={alt}
        onLoad={() => setIsLoaded(true)}
        className="relative w-full h-full object-cover rounded-xl shadow-lg"
      />

      {/* Gloss vitré */}
      <div
        className="absolute inset-x-0 top-0 rounded-t-xl pointer-events-none"
        style={{
          height: '45%',
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.22) 0%, transparent 100%)',
        }}
      />

      {/* Spinner */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center glass rounded-xl">
          <div className="w-8 h-8 border-2 border-[#7ec8e3] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
