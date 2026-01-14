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
    // Reset state when src changes
    setIsLoaded(false);
    setShowImage(false);

    // Small delay to trigger animation
    const timer = setTimeout(() => {
      setShowImage(true);
    }, 100);

    return () => clearTimeout(timer);
  }, [src]);

  if (!src) {
    return null;
  }

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl
        transition-all duration-500 ease-out
        ${showImage && isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
        ${className}
      `}
    >
      {/* Glow effect */}
      <div
        className="absolute inset-0 blur-xl opacity-50"
        style={{
          background: 'linear-gradient(135deg, rgba(74, 144, 217, 0.4), rgba(126, 200, 227, 0.4))',
        }}
      />

      {/* Image container with glass effect */}
      <div className="relative glass p-2 rounded-xl">
        <img
          src={src}
          alt={alt}
          onLoad={() => setIsLoaded(true)}
          className="w-full h-auto max-h-48 object-contain rounded-lg"
        />

        {/* Shine animation overlay */}
        <div
          className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden"
          style={{
            background: 'linear-gradient(105deg, transparent 40%, rgba(255, 255, 255, 0.2) 50%, transparent 60%)',
            animation: showImage && isLoaded ? 'shine 1s ease-out forwards' : 'none',
          }}
        />
      </div>

      {/* Loading placeholder */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center glass rounded-xl">
          <div className="w-8 h-8 border-2 border-[#7ec8e3] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
