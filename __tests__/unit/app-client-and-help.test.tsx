import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import ToolClient from '@/app/tool-client';
import ToolClientWrapper from '@/app/tool-client-wrapper';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/dynamic', () => ({
  default: () => () => <div data-testid="dynamic-tool-client">dynamic-tool-client</div>,
}));

const mockWriteText = vi.fn().mockResolvedValue(undefined);

describe('app client and help page', () => {
  beforeEach(() => {
    mockWriteText.mockClear();
    Object.defineProperty(navigator, 'clipboard', {
      writable: true,
      value: { writeText: mockWriteText },
    });
    window.history.replaceState(null, '', 'http://localhost:3000/');
  });

  it('renders dynamic tool client wrapper', () => {
    render(<ToolClientWrapper />);
    expect(screen.getByTestId('dynamic-tool-client')).toBeInTheDocument();
  });

  it('renders the cron visualizer UI with toolbar, sidebar and canvas', () => {
    render(<ToolClient />);
    expect(screen.getByTestId('cron-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('cron-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('cron-canvas')).toBeInTheDocument();
    expect(screen.getByText('Cron Job Scheduler Visualizer')).toBeInTheDocument();
    // Default state: preset expression is pre-filled
    expect((screen.getByLabelText('Cron expression') as HTMLInputElement).value).toBe(
      '*/15 9-17 * * 1-5'
    );
  });

  it('shows heatmap and next runs for the default schedule', () => {
    render(<ToolClient />);
    expect(screen.getByTestId('cron-heatmap')).toBeInTheDocument();
    expect(screen.getByTestId('next-runs')).toBeInTheDocument();
  });

  it('shows descriptive error UI for an invalid expression without crashing', () => {
    window.history.replaceState(null, '', 'http://localhost:3000/?theme=dark');
    render(<ToolClient />);
    const input = screen.getByLabelText('Cron expression') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'banana' } });
    expect(screen.getByTestId('cron-error')).toBeInTheDocument();
    // UI is still interactive afterwards
    expect(screen.getByTestId('cron-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('cron-canvas')).toBeInTheDocument();
  });

  it('copies next runs as JSON to clipboard', async () => {
    render(<ToolClient />);
    fireEvent.click(screen.getByLabelText('Copy next runs as JSON'));
    await vi.waitFor(() => expect(mockWriteText).toHaveBeenCalled());
    const written = (mockWriteText.mock.calls[0]?.[0] ?? '') as string;
    expect(() => JSON.parse(written)).not.toThrow();
  });

  it('theme toggle updates the URL', () => {
    render(<ToolClient />);
    fireEvent.click(screen.getByTestId('theme-toggle'));
    expect(new URLSearchParams(window.location.search).get('theme')).toBe('light');
  });
});
