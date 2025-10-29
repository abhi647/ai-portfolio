'use client';

import { useState } from 'react';
import { Upload, FileText, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface CSVUploaderProps {
  title: string;
  description: string;
  accept?: string;
  onFileSelect: (file: File) => void;
  onValidationComplete?: (success: boolean) => void;
  validationStatus?: 'idle' | 'validating' | 'success' | 'error';
  errors?: string[];
  warnings?: string[];
  rowCount?: number;
}

export function CSVUploader({
  title,
  description,
  accept = '.csv',
  onFileSelect,
  onValidationComplete,
  validationStatus = 'idle',
  errors = [],
  warnings = [],
  rowCount = 0,
}: CSVUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.csv')) {
        setSelectedFile(file);
        onFileSelect(file);
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      onFileSelect(file);
    }
  };

  const StatusIcon = () => {
    switch (validationStatus) {
      case 'validating':
        return <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />;
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <FileText className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <StatusIcon />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={cn(
            'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors',
            dragActive ? 'border-primary bg-primary/5' : 'border-border',
            validationStatus === 'success' && 'border-green-500 bg-green-50 dark:bg-green-950',
            validationStatus === 'error' && 'border-red-500 bg-red-50 dark:bg-red-950'
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id={`csv-upload-${title}`}
            accept={accept}
            onChange={handleFileInput}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
          <Upload className="mb-4 h-10 w-10 text-muted-foreground" />
          <p className="mb-2 text-sm font-medium">
            {selectedFile ? selectedFile.name : 'Drop your CSV file here'}
          </p>
          <p className="text-xs text-muted-foreground">or click to browse</p>
        </div>

        {validationStatus === 'validating' && (
          <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              Validating... {rowCount} rows processed
            </p>
          </div>
        )}

        {validationStatus === 'success' && (
          <div className="rounded-lg bg-green-50 p-3 dark:bg-green-950">
            <p className="text-sm font-medium text-green-900 dark:text-green-100">
              ✓ Validation successful
            </p>
            <p className="mt-1 text-xs text-green-700 dark:text-green-300">
              {rowCount} rows validated and ready to import
            </p>
          </div>
        )}

        {validationStatus === 'error' && errors.length > 0 && (
          <div className="rounded-lg bg-red-50 p-3 dark:bg-red-950">
            <p className="text-sm font-medium text-red-900 dark:text-red-100">
              ✗ Validation failed
            </p>
            <ul className="mt-2 max-h-32 space-y-1 overflow-auto text-xs text-red-700 dark:text-red-300">
              {errors.slice(0, 10).map((error, i) => (
                <li key={i}>• {error}</li>
              ))}
              {errors.length > 10 && (
                <li className="font-medium">... and {errors.length - 10} more errors</li>
              )}
            </ul>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="rounded-lg bg-yellow-50 p-3 dark:bg-yellow-950">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <div>
                <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                  Warnings ({warnings.length})
                </p>
                <ul className="mt-1 max-h-24 space-y-1 overflow-auto text-xs text-yellow-700 dark:text-yellow-300">
                  {warnings.slice(0, 5).map((warning, i) => (
                    <li key={i}>• {warning}</li>
                  ))}
                  {warnings.length > 5 && (
                    <li className="font-medium">... and {warnings.length - 5} more warnings</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
