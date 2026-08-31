import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ROADMAP_PROMPT } from '@/lib/roadmapPrompt';
import { Upload, Sparkles, Copy, Check } from 'lucide-react';

export function ImportRoadmap({ onFileImported }: { onFileImported: (file: File) => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(ROADMAP_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileImported(e.target.files[0]);
      e.target.value = '';
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header Info */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Import or Generate Roadmap</h1>
        <p className="text-sm text-muted-foreground">Upload an existing markdown file or use our AI prompt assistant to create one instantly.</p>
      </div>

      {/* Upload Box */}
      <div className="relative border-2 border-dashed border-muted-foreground/30 rounded-2xl p-8 text-center hover:border-primary/60 transition-all bg-card/60 shadow-sm group cursor-pointer">
        <input 
          type="file" 
          onChange={handleFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div className="flex flex-col items-center justify-center space-y-4 pointer-events-none">
          <div className="p-4 bg-primary/10 rounded-2xl text-primary group-hover:scale-110 transition-transform">
            <Upload className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">Upload .md File</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Drag and drop your roadmap markdown file here, or click to browse from your device.
            </p>
          </div>
          <Button variant="secondary" size="sm" className="pointer-events-none mt-2">
            Select File
          </Button>
        </div>
      </div>

      {/* AI Prompt Assistant */}
      <div className="p-6 bg-card border rounded-2xl shadow-sm space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <Sparkles className="w-4 h-4" />
            <span>Generate Roadmap with AI</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Don't have a markdown file? Copy the prompt below, paste it into any AI chatbot (like ChatGPT or Claude), save the generated response as a <code className="text-primary font-mono text-sm">.md</code> file, and upload it above.
          </p>
        </div>

        <div className="p-4 bg-muted/50 border rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Ready-to-use Prompt</span>
            <Button variant="outline" size="sm" onClick={handleCopy} className="h-8 text-xs gap-1.5">
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy Prompt'}
            </Button>
          </div>
          <div className="p-3 bg-background border rounded-xl font-mono text-sm text-muted-foreground select-all leading-relaxed max-h-40 overflow-y-auto">
            {ROADMAP_PROMPT}
          </div>
        </div>
      </div>
    </div>
  );
}