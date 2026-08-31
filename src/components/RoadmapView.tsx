import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ROADMAP_PROMPT } from '@/lib/roadmapPrompt';
import { Upload, Sparkles, Copy, Check, FileText } from 'lucide-react';

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

  const sampleMarkdown = `# Machine Learning Learning Roadmap

## Introduction to Machine Learning
- What is Machine Learning and AI
- Types of Machine Learning (Supervised, Unsupervised, Reinforcement)
- Setting up Python Environment (Jupyter, Pandas, NumPy)

## Supervised Learning Fundamentals
- Linear Regression and Logistic Regression
- Decision Trees and Random Forests
- Evaluation Metrics (Accuracy, Precision, Recall, F1-Score)`;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      {/* Header Info */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Import or Generate Roadmap</h1>
        <p className="text-base text-muted-foreground">Upload an existing markdown file or use our AI prompt assistant to create one instantly.</p>
      </div>

      {/* Upload Box */}
      <div className="relative border-2 border-dashed border-muted-foreground/30 rounded-2xl p-12 text-center hover:border-primary/60 transition-all bg-card/60 shadow-md group cursor-pointer">
        <input 
          type="file" 
          onChange={handleFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div className="flex flex-col items-center justify-center space-y-5 pointer-events-none">
          <div className="p-5 bg-primary/10 rounded-2xl text-primary group-hover:scale-110 transition-transform">
            <Upload className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Upload .md File</h2>
            <p className="text-base text-muted-foreground max-w-md mx-auto">
              Drag and drop your roadmap markdown file here, or click to browse from your device.
            </p>
          </div>
          <Button variant="ghost" size="sm" className="pointer-events-none mt-3">
            Select File
          </Button>
        </div>
      </div>

      {/* AI Prompt Assistant */}
      <div className="p-8 bg-card border rounded-2xl shadow-md space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5 text-primary font-semibold text-base">
            <Sparkles className="w-5 h-5" />
            <span>Generate Roadmap with AI</span>
          </div>
          <p className="text-base text-muted-foreground leading-relaxed">
            Don't have a markdown file? Copy the prompt below, paste it into any AI chatbot (like ChatGPT or Claude), save the generated response as a <code className="text-primary font-mono text-base">.md</code> file, and upload it above.
          </p>
        </div>

        {/* Ready-to-use Prompt Box */}
        <div className="p-6 bg-muted/50 border rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-base font-medium text-foreground">Ready-to-use Prompt</span>
            <Button variant="outline" size="sm" onClick={handleCopy} className="h-9 text-xs gap-2">
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Prompt'}
            </Button>
          </div>
          <div className="p-4 bg-background border rounded-xl font-mono text-sm text-foreground leading-relaxed select-text">
            {ROADMAP_PROMPT}
          </div>
        </div>

        {/* Expected Format Example Box */}
        <div className="p-6 bg-muted/50 border rounded-xl space-y-4">
          <div className="flex items-center gap-2.5 text-base font-medium text-foreground">
            <FileText className="w-5 h-5 text-primary" />
            <span>Expected Markdown Format Example</span>
          </div>
          <div className="p-4 bg-background border rounded-xl font-mono text-sm text-foreground leading-relaxed select-text whitespace-pre-wrap">
            {sampleMarkdown}
          </div>
        </div>
      </div>
    </div>
  );
}