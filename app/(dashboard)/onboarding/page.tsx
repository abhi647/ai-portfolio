'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CSVUploader } from '@/components/onboarding/CSVUploader';
import { useProjectStore, useUIStore } from '@/store';
import { saveProject } from '@/lib/db';
import {
  parsePriceCSV,
  parseSectorCSV,
  parseIndexCSV,
  generateDemoData,
  type ValidationResult,
} from '@/lib/csv-validator';
import type { PriceRow, SectorMapRow, IndexRow, Project } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';

type ValidationStatus = 'idle' | 'validating' | 'success' | 'error';

interface ValidationState<T> {
  status: ValidationStatus;
  result: ValidationResult<T> | null;
  rowCount: number;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { addProject } = useProjectStore();
  const { addToast } = useUIStore();

  const [step, setStep] = useState(0);
  const [projectName, setProjectName] = useState('');
  const [benchmarkName, setBenchmarkName] = useState('NIFTY50');

  const [priceValidation, setPriceValidation] = useState<ValidationState<PriceRow>>({
    status: 'idle',
    result: null,
    rowCount: 0,
  });

  const [sectorValidation, setSectorValidation] = useState<ValidationState<SectorMapRow>>({
    status: 'idle',
    result: null,
    rowCount: 0,
  });

  const [indexValidation, setIndexValidation] = useState<ValidationState<IndexRow>>({
    status: 'idle',
    result: null,
    rowCount: 0,
  });

  const handlePriceFile = async (file: File) => {
    setPriceValidation({ status: 'validating', result: null, rowCount: 0 });

    const result = await parsePriceCSV(file, (count) => {
      setPriceValidation((prev) => ({ ...prev, rowCount: count }));
    });

    setPriceValidation({
      status: result.success ? 'success' : 'error',
      result,
      rowCount: result.data.length,
    });
  };

  const handleSectorFile = async (file: File) => {
    setSectorValidation({ status: 'validating', result: null, rowCount: 0 });

    const result = await parseSectorCSV(file, (count) => {
      setSectorValidation((prev) => ({ ...prev, rowCount: count }));
    });

    setSectorValidation({
      status: result.success ? 'success' : 'error',
      result,
      rowCount: result.data.length,
    });
  };

  const handleIndexFile = async (file: File) => {
    setIndexValidation({ status: 'validating', result: null, rowCount: 0 });

    const result = await parseIndexCSV(file, (count) => {
      setIndexValidation((prev) => ({ ...prev, rowCount: count }));
    });

    setIndexValidation({
      status: result.success ? 'success' : 'error',
      result,
      rowCount: result.data.length,
    });
  };

  const handleUseDemoData = () => {
    const demo = generateDemoData();

    setPriceValidation({
      status: 'success',
      result: { success: true, data: demo.prices, errors: [], warnings: [] },
      rowCount: demo.prices.length,
    });

    setSectorValidation({
      status: 'success',
      result: { success: true, data: demo.sectors, errors: [], warnings: [] },
      rowCount: demo.sectors.length,
    });

    setIndexValidation({
      status: 'success',
      result: { success: true, data: demo.benchmark, errors: [], warnings: [] },
      rowCount: demo.benchmark.length,
    });

    addToast({
      title: 'Demo data loaded',
      description: 'Using sample Indian equities data for demonstration',
      variant: 'success',
    });
  };

  const handleCreateProject = async () => {
    if (
      !priceValidation.result?.data ||
      !sectorValidation.result?.data ||
      !indexValidation.result?.data
    ) {
      addToast({
        title: 'Missing data',
        description: 'Please upload all required CSV files',
        variant: 'destructive',
      });
      return;
    }

    const project: Project = {
      id: `project-${Date.now()}`,
      name: projectName || 'Untitled Project',
      createdAt: Date.now(),
      settings: DEFAULT_SETTINGS,
      datasets: {
        prices: priceValidation.result.data,
        sectors: sectorValidation.result.data,
        benchmark: benchmarkName,
        benchmarkData: indexValidation.result.data,
        constituents: [
          ...new Set(priceValidation.result.data.map((row) => row.symbol)),
        ],
      },
      runs: [],
      scenarios: [],
    };

    try {
      await saveProject(project);
      addProject(project);

      addToast({
        title: 'Project created',
        description: `${project.name} has been created successfully`,
        variant: 'success',
      });

      router.push('/dashboard');
    } catch (error) {
      addToast({
        title: 'Error',
        description: 'Failed to create project',
        variant: 'destructive',
      });
    }
  };

  const canProceedToNextStep = () => {
    if (step === 0) return projectName.trim().length > 0;
    if (step === 1)
      return (
        priceValidation.status === 'success' &&
        sectorValidation.status === 'success' &&
        indexValidation.status === 'success'
      );
    if (step === 2) return benchmarkName.trim().length > 0;
    return false;
  };

  const steps = [
    {
      title: 'Project Setup',
      description: 'Name your project and choose data source',
    },
    {
      title: 'Data Upload',
      description: 'Upload your CSV files or use demo data',
    },
    {
      title: 'Benchmark',
      description: 'Select your benchmark index',
    },
    {
      title: 'Review',
      description: 'Review and create your project',
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Progress */}
      <div>
        <h2 className="text-3xl font-bold">Create New Project</h2>
        <div className="mt-4 flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={i} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  i <= step
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {i + 1}
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`h-0.5 flex-1 ${
                    i < step ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-2">
          <p className="text-sm font-medium">{steps[step].title}</p>
          <p className="text-xs text-muted-foreground">{steps[step].description}</p>
        </div>
      </div>

      {/* Step Content */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Project Information</CardTitle>
            <CardDescription>
              Give your project a name and choose how to get started
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="project-name" className="mb-2 block text-sm font-medium">
                Project Name
              </label>
              <Input
                id="project-name"
                placeholder="e.g., Indian Equities Q1 2024"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
            </div>

            <div className="rounded-lg border-2 border-dashed p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="font-medium">Try with demo data</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Explore the app with pre-loaded sample data for 10 Indian stocks
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      handleUseDemoData();
                      setStep(2);
                    }}
                  >
                    Use Demo Data
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <CSVUploader
            title="Price Data (OHLCV)"
            description="Upload CSV with columns: symbol, date, open, high, low, close, volume"
            onFileSelect={handlePriceFile}
            validationStatus={priceValidation.status}
            errors={priceValidation.result?.errors}
            warnings={priceValidation.result?.warnings}
            rowCount={priceValidation.rowCount}
          />

          <CSVUploader
            title="Sector Mapping"
            description="Upload CSV with columns: symbol, sector, industry, cap_tier"
            onFileSelect={handleSectorFile}
            validationStatus={sectorValidation.status}
            errors={sectorValidation.result?.errors}
            warnings={sectorValidation.result?.warnings}
            rowCount={sectorValidation.rowCount}
          />

          <CSVUploader
            title="Benchmark Index"
            description="Upload CSV with columns: date, close"
            onFileSelect={handleIndexFile}
            validationStatus={indexValidation.status}
            errors={indexValidation.result?.errors}
            warnings={indexValidation.result?.warnings}
            rowCount={indexValidation.rowCount}
          />
        </div>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Benchmark Selection</CardTitle>
            <CardDescription>
              Choose the benchmark index for alpha calculation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <label htmlFor="benchmark" className="mb-2 block text-sm font-medium">
                Benchmark Index Name
              </label>
              <Input
                id="benchmark"
                placeholder="e.g., NIFTY50, SENSEX"
                value={benchmarkName}
                onChange={(e) => setBenchmarkName(e.target.value)}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                This name will be used for reference in reports and charts
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Create</CardTitle>
            <CardDescription>Verify your project configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Project Name</p>
                <p className="font-medium">{projectName}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Benchmark</p>
                <p className="font-medium">{benchmarkName}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Price Records</p>
                <p className="font-medium">{priceValidation.rowCount} rows</p>
              </div>
              <div>
                <p className="text-muted-foreground">Symbols</p>
                <p className="font-medium">
                  {
                    new Set(
                      priceValidation.result?.data.map((row) => row.symbol)
                    ).size
                  }{' '}
                  stocks
                </p>
              </div>
            </div>

            <Button onClick={handleCreateProject} className="w-full" size="lg">
              Create Project
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => (step > 0 ? setStep(step - 1) : router.push('/dashboard'))}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {step === 0 ? 'Cancel' : 'Previous'}
        </Button>
        {step < 3 && (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={!canProceedToNextStep()}
          >
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
