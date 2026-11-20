import type { ToolConfig } from '@itsjust/core';

export const toolConfig = {
  id: '1795215866',
  name: 'Cron Job Scheduler Visualizer',
  version: '1.0.0',
  category: 'Developer',
  description:
    'Visualizes cron schedules as a timeline heatmap and next-run table so users can see when jobs will fire across a day/week.',
  exportFormats: ['json', 'png', 'pdf'] as ToolConfig['exportFormats'],
  features: {
    export: true,
    autoSave: true,
    undoRedo: true,
    sidebar: true,
    statusBar: true,
    darkMode: true,
  },
  theme: {
    brand: 'Cron Visualizer',
    icon: '⏰',
  },
};

export default toolConfig;

export const templateBaseVersion = '1.4.0';
