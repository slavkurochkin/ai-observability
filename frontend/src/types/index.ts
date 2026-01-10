export interface User {
  id: number
  email: string
  full_name: string | null
  is_active: boolean
  created_at: string
}

export interface Evaluation {
  id: number
  user_id: number
  name: string
  description: string | null
  evaluation_type: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  config: Record<string, any>
  results: Record<string, any> | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface Benchmark {
  id: number
  user_id: number
  name: string
  description: string | null
  version: string
  created_at: string
  updated_at: string
  task_count?: number
}

export interface BenchmarkTask {
  id: number
  benchmark_id: number
  task_number: number
  prompt: string
  reference_solution: string | null
  difficulty: 'easy' | 'medium' | 'hard' | null
  metadata: Record<string, any> | null
  created_at: string
}

export interface ApiKeys {
  openai?: string
  anthropic?: string
  gemini?: string
  grok?: string
  ollama?: string
  cohere?: string
  mistral?: string
  huggingface?: string
  together?: string
  perplexity?: string
  replicate?: string
  deepseek?: string
  fireworks?: string
}

export interface VarianceRun {
  run: number
  token_count: number
  key_fact_missing: boolean
  hallucination: boolean
  omission: boolean
  failure_modes: string[]
  score: number
  structure: string
  tone: string
  prompt: string
  output: string
}

export interface VarianceReport {
  evaluation_id: number
  evaluation_name: string
  total_runs: number
  runs: VarianceRun[]
  summary: {
    variance_metrics?: {
      token_count?: {
        mean: number
        std: number
        min: number
        max: number
        distribution: number[]
      }
      score?: {
        mean: number
        std: number
        distribution: number[]
        correct_count: number
        partial_count: number
        incorrect_count: number
      }
      failure_modes?: Record<string, number>
      key_facts_presence?: Record<string, number>
      embedding_similarity?: {
        mean: number
        std: number
      }
    }
  }
}

export interface MetricThreshold {
  min?: number
  max?: number
  target?: number
  improvementDirection?: 'higher' | 'lower' | 'neutral'
}

export interface DashboardMetricConfig {
  metricKey: string
  metricLabel: string
  threshold?: MetricThreshold
  formatValue?: (value: number) => string
  unit?: string
  extractValue?: (evaluation: Evaluation) => number | null
  improvementDirection?: 'higher' | 'lower' | 'neutral'
}

export interface DashboardConfig {
  baselineEvaluationId: number | null
  currentEvaluationId: number | null
  metrics: DashboardMetricConfig[]
}

export interface NightlyRun {
  id: number
  date: string
  model: string
  suite: string
  wins: number
  losses: number
  ties: number
  win_rate: number
  total_samples: number
  run_metadata?: Record<string, any>
  created_at: string
}

export interface WinRateHistory {
  dates: string[]
  win_rates: number[]
  rolling_averages: number[]
  confidence_intervals: Array<{
    mean: number
    lower_bound: number
    upper_bound: number
    confidence_level: number
  }>
  baseline_win_rate: number | null
}

export interface RegressionAlert {
  id: number
  date: string
  model: string
  suite: string
  baseline_date: string
  baseline_win_rate: number
  current_win_rate: number
  win_rate_drop: number
  confidence_intervals_overlap: string
  consecutive_runs: number
  status: 'active' | 'resolved' | 'false_positive'
  alert_metadata?: Record<string, any>
  created_at: string
}

export interface RegressionCheck {
  regression_detected: boolean
  baseline_date: string
  baseline_win_rate: number
  current_win_rate: number
  win_rate_drop: number
  confidence_intervals_overlap: boolean
  consecutive_runs: number
  status: string
  details: Record<string, any>
}

export interface RegressionReport {
  report: string
  status: string
  regression_detected: boolean
  details: Record<string, any>
}

