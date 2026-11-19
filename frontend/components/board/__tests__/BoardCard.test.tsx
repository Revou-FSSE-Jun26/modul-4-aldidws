import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BoardCard } from '@/components/board/BoardCard';

describe('BoardCard', () => {
  it('renders the card title', () => {
    render(<BoardCard title="Fix login bug" />);
    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
  });

  it('renders meta content when provided', () => {
    render(<BoardCard title="Any Title" meta={<span>Alice</span>} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('does not render delete button when onCardDelete is omitted', () => {
    render(<BoardCard title="Fix login bug" />);
    expect(screen.queryByRole('button', { name: /delete card/i })).toBeNull();
  });

  it('renders delete button when onCardDelete is provided', () => {
    render(<BoardCard title="Fix login bug" onCardDelete={() => {}} />);
    expect(
      screen.getByRole('button', { name: /delete card/i })
    ).toBeInTheDocument();
  });

  it('calls onCardClick when the card body button is clicked', async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();
    render(<BoardCard title="Fix login bug" onCardClick={handleClick} />);
    await user.click(screen.getByRole('button', { name: /open card/i }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
