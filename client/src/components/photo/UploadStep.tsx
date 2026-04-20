import React from 'react';
import { Button } from '../ui/Button';
import { Camera, Upload, ImageIcon } from 'lucide-react';

interface UploadStepProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  isDev: boolean;
  examples: string[];
  onLoadExample: (filename: string) => void;
}

export function UploadStep({
  fileInputRef,
  onFileSelect,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  isDev,
  examples,
  onLoadExample,
}: UploadStepProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 py-12 px-4 transition-colors ${
        isDragging ? 'bg-primary/10' : ''
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {isDragging ? (
        <div className="flex flex-col items-center gap-3 py-8 px-4 border-2 border-dashed border-primary rounded-lg">
          <Upload className="h-12 w-12 text-primary" />
          <p className="text-primary font-medium text-sm">Drop image here</p>
        </div>
      ) : (
        <>
          <ImageIcon className="h-16 w-16 text-muted-foreground" />
          <p className="text-muted-foreground text-sm text-center max-w-xs">
            Take a photo, upload, paste, or drag an image of a vocabulary list from your textbook.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onFileSelect}
            className="hidden"
          />
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.removeAttribute('capture');
                  fileInputRef.current.click();
                }
              }}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
            <Button
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.setAttribute('capture', 'environment');
                  fileInputRef.current.click();
                }
              }}
            >
              <Camera className="h-4 w-4 mr-2" />
              Take Photo
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">or paste from clipboard (Ctrl+V)</p>
        </>
      )}
      {isDev && examples.length > 0 && !isDragging && (
        <div className="flex flex-col items-center gap-2 pt-4 border-t border-border w-full max-w-xs">
          <p className="text-xs text-muted-foreground">Dev: load example image</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {examples.map((name) => (
              <Button
                key={name}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => onLoadExample(name)}
              >
                {name.length > 20 ? name.slice(0, 17) + '...' : name}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
