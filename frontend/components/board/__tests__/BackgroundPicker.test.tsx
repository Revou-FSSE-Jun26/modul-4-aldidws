import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BackgroundPicker } from '@/components/board/BackgroundPicker';
import { BOARD_BACKGROUNDS, DEFAULT_BG_ID } from '@/lib/board-backgrounds';

describe('BackgroundPicker', () => {
  it('renders 6 background swatches with accessible radio role', () => {
    render(<BackgroundPicker value={DEFAULT_BG_ID} onChange={() => {}} />);
    // The picker is closed initially; open it via the trigger button.
    fireEvent.click(screen.getByRole('button', { name: /change background/i }));

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(6);

    for (const bg of BOARD_BACKGROUNDS) {
      expect(screen.getByRole('radio', { name: bg.name })).toBeInTheDocument();
    }
  });

  it('marks the selected background as aria-checked', () => {
    render(<BackgroundPicker value="teal" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /change background/i }));

    const teal = screen.getByRole('radio', { name: 'Teal' });
    expect(teal).toHaveAttribute('aria-checked', 'true');
    const mint = screen.getByRole('radio', { name: 'Mint' });
    expect(mint).toHaveAttribute('aria-checked', 'false');
  });

  it('selecting a swatch calls onChange with its id', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<BackgroundPicker value="mint" onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /change background/i }));
    await user.click(screen.getByRole('radio', { name: 'Lagoon' }));
    expect(onChange).toHaveBeenCalledWith('lagoon');
  });

  it('supports keyboard arrow navigation between swatches', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<BackgroundPicker value="mint" onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /change background/i }));

    // "Mint" (index 0) is focused after opening (selected by default).
    const mint = screen.getByRole('radio', { name: 'Mint' });
    expect(mint).toHaveFocus();

    // ArrowRight moves to Teal (index 1).
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Teal' })).toHaveFocus();

    // ArrowDown from Teal (index 1) moves 3 columns down -> Sage (index 4) in a 3-col grid.
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'Sage' })).toHaveFocus();

    // Enter selects Sage.
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('sage');
  });

  it('Escape closes the picker and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<BackgroundPicker value="mint" onChange={() => {}} />);
    const trigger = screen.getByRole('button', { name: /change background/i });
    await user.click(trigger);
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes on outside click', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <BackgroundPicker value="mint" onChange={() => {}} />
        <button type="button">outside</button>
      </div>,
    );
    await user.click(screen.getByRole('button', { name: /change background/i }));
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'outside' }));
    await waitFor(() =>
      expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument(),
    );
  });
});
