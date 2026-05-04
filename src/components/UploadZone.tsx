"use client";

import React, { useRef, useState } from "react";
import { Plus, Send, Loader2, X } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface UploadZoneProps {
  onImageSelect: (file: File | null, text: string) => void;
  isAnalyzing: boolean;
}

export function UploadZone({ onImageSelect, isAnalyzing }: UploadZoneProps) {
  const [prompt, setPrompt] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      alert("Please upload an image or video file");
      return;
    }
    
    if (preview) URL.revokeObjectURL(preview);
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setSelectedFile(file);
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleSubmit = () => {
    if (selectedFile || prompt.trim()) {
      onImageSelect(selectedFile, prompt.trim());
      setPreview(null);
      setSelectedFile(null);
      setPrompt("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isAnalyzing) handleSubmit();
    }
  };

  return (
    <div className="relative w-full max-w-3xl mx-auto flex flex-col items-center">
      {preview && (
        <div className="absolute bottom-[calc(100%+16px)] left-0 bg-sidebar/80 p-2 rounded-2xl border border-border backdrop-blur-sm shadow-xl flex items-center gap-4 animate-in slide-in-from-bottom-2 duration-300">
          <div className="relative">
            {selectedFile?.type.startsWith("video/") ? (
              <video
                src={preview}
                title={selectedFile?.name ?? "Selected video preview"}
                className="w-20 h-20 object-cover rounded-lg border border-border/50"
              />
            ) : (
              <Image
                src={preview}
                alt={selectedFile?.name ? `Preview of ${selectedFile.name}` : "Selected image preview"}
                title={selectedFile?.name ?? "Selected image preview"}
                width={80}
                height={80}
                unoptimized
                className="w-20 h-20 object-cover rounded-lg border border-border/50"
              />
            )}
            <button
              type="button"
              aria-label="Remove selected file"
              title="Remove selected file"
              onClick={() => { setPreview(null); setSelectedFile(null); }}
              className="absolute -top-2 -right-2 bg-muted-foreground/30 hover:bg-muted-foreground/60 backdrop-blur-md text-foreground rounded-full p-1 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="text-sm text-muted-foreground mr-4 font-medium truncate max-w-50">
            {selectedFile?.name}
          </div>
        </div>
      )}

      <div className="w-full bg-sidebar rounded-[24px] border border-border/50 shadow-sm focus-within:bg-card focus-within:ring-1 focus-within:ring-border/50 transition-colors duration-200 flex flex-col p-2">
        <Textarea 
          placeholder={isAnalyzing ? "Analyzing media..." : "Upload media to scan..."}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isAnalyzing}
          className="min-h-12.5 max-h-50 border-0 focus-visible:ring-0 resize-none bg-transparent py-3 px-4 text-base placeholder:text-muted-foreground"
          rows={1}
        />
        <div className="flex items-center justify-between px-2 pt-2 pb-1">
          <div className="flex items-center gap-1">
            <label htmlFor="upload-media-input" className="sr-only">
              Upload image or video
            </label>
            <input
              id="upload-media-input"
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              title="Upload image or video"
              aria-label="Upload image or video"
              accept="image/*,video/mp4,video/webm,video/quicktime"
              onChange={onFileInput} 
            />
            <Button 
              variant="ghost" 
              size="icon" 
              type="button"
              aria-label="Choose file"
              title="Choose file"
              className="rounded-full h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={isAnalyzing}
            >
              <Plus className="w-5 h-5" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              type="button"
              aria-label={isAnalyzing ? "Analyzing" : "Submit"}
              title={isAnalyzing ? "Analyzing" : "Submit"}
              className="rounded-full h-10 w-10 text-foreground bg-primary/10 hover:bg-primary/20 hover:text-primary transition-colors disabled:opacity-50"
              disabled={isAnalyzing || (!selectedFile && !prompt.trim())}
              onClick={handleSubmit}
            >
              {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : <Send className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>
      <div className="text-xs text-muted-foreground text-center mt-3">
        DeepScan can make mistakes. Consider verifying critical information.
      </div>
    </div>
  );
}
