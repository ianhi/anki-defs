import React, { useState, useCallback, useEffect } from 'react';
import imageCompression from 'browser-image-compression';

const COMPRESSION_OPTIONS = {
  maxWidthOrHeight: 1500,
  useWebWorker: true,
  fileType: 'image/jpeg' as const,
};

async function compressFile(file: File | Blob): Promise<Blob> {
  // imageCompression expects File; wrap Blob if needed
  const f = file instanceof File ? file : new File([file], 'paste.jpg', { type: file.type });
  return imageCompression(f, COMPRESSION_OPTIONS);
}

export function useImageInput(onImage: (blob: Blob) => void) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    async (file: File | Blob) => {
      try {
        const compressed = await compressFile(file);
        onImage(compressed);
      } catch {
        // Caller handles errors via its own error state
      }
    },
    [onImage]
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) await handleFile(file);
    },
    [handleFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file?.type.startsWith('image/')) {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  // Document-level paste listener so it works from any step
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (blob) handleFile(blob);
          return;
        }
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [handleFile]);

  return {
    handleFileSelect,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    isDragging,
  };
}
