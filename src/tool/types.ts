export interface CronState {
  expression: string;
  useSeconds: boolean;
  dayFieldMode: 'dom' | 'dow';
  timezone: string;
  theme: 'dark' | 'light';
  warnings: string[];
  error: string | null;
  nextRunsJSON: string;
  selectedPreset: string | null;
}
