"use client";

import { Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  label?: string;
  accept?: string;
  maxSizeMB?: number;
  error?: string;
  required?: boolean;
  onChange: (file: File | null) => void;
  value?: File | null;
}

export function FileUpload({
  label = "Receipt Image",
  accept = "image/jpeg,image/png,image/gif",
  maxSizeMB = 5,
  error,
  required,
  onChange,
  value,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleFile = (file: File | null) => {
    setLocalError(null);
    if (!file) {
      setPreview(null);
      onChange(null);
      return;
    }
    const allowed = accept.split(",").map((a) => a.trim());
    if (!allowed.includes(file.type)) {
      setLocalError("Only JPG, PNG, or GIF files are allowed");
      onChange(null);
      return;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      setLocalError(`File must be under ${maxSizeMB}MB`);
      onChange(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    onChange(file);
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-[var(--t-mid)]">
        {label}
        {required && <span className="ml-0.5 text-[var(--red)]">*</span>}
      </label>
      <div
        className={cn(
          "rounded-[14px] border border-dashed border-[var(--g-border-hi)] bg-[var(--input-bg)] p-4 transition-colors hover:border-[var(--brand)]",
          (error || localError) && "border-[var(--red)]/50"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        {!value ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 py-4 text-sm text-[var(--t-mid)]"
          >
            <Upload className="h-6 w-6 text-[var(--brand)]" />
            <span>Click to upload receipt</span>
            <span className="text-xs text-[var(--t-low)]">
              JPG, PNG, GIF · Max {maxSizeMB}MB
            </span>
          </button>
        ) : (
          <div className="flex items-center gap-3">
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Receipt preview"
                className="h-16 w-16 rounded-lg border border-[var(--g-border)] object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--t-hi)]">{value.name}</p>
              <p className="text-xs text-[var(--t-low)]">
                {(value.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                handleFile(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="rounded-lg p-1.5 text-[var(--t-mid)] hover:bg-[var(--red-bg)] hover:text-[var(--red)]"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      {(error || localError) && (
        <p className="text-xs text-[var(--red)]" role="alert">
          {error || localError}
        </p>
      )}
    </div>
  );
}
