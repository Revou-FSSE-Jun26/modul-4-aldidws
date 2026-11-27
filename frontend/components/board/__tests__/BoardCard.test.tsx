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

  it('renders meta outside the open-card button so its text stays readable', async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();
    render(
      <BoardCard title="Task" meta={<span>Overdue</span>} onCardClick={handleClick} />
    );
    const openButton = screen.getByRole('button', { name: 'Open card: Task' });
    expect(openButton).not.toContainElement(screen.getByText('Overdue'));
    await user.click(openButton);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
  it('calls onCardClick when the card body button is clicked', async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();
    render(<BoardCard title="Fix login bug" onCardClick={handleClick} />);
    await user.click(screen.getByRole('button', { name: /open card/i }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  // --- B3: priority indicator ---

  it('renders a priority indicator with data-priority attribute and capitalized text', () => {
    render(<BoardCard title="High task" priority="high" />);
    const indicator = screen.getByText('High');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveAttribute('data-priority', 'high');
  });

  it('renders no priority indicator when priority prop is omitted', () => {
    render(<BoardCard title="No priority task" />);
    expect(document.querySelector('[data-priority]')).toBeNull();
  });

  it('renders low priority indicator with correct data-priority and capitalized text', () => {
    render(<BoardCard title="Low task" priority="low" />);
    const indicator = screen.getByText('Low');
    expect(indicator).toHaveAttribute('data-priority', 'low');
  });

  it('renders medium priority indicator with correct data-priority and capitalized text', () => {
    render(<BoardCard title="Medium task" priority="medium" />);
    const indicator = screen.getByText('Medium');
    expect(indicator).toHaveAttribute('data-priority', 'medium');
  });

  // --- B1: board name ---

  describe('B1: board name', () => {
    it('renders the board name with aria-label when boardName is provided', () => {
      render(<BoardCard title="Fix login" boardName="Alpha Project" />);
      const el = screen.getByLabelText('Board: Alpha Project');
      expect(el).toBeInTheDocument();
      expect(el).toHaveTextContent('Alpha Project');
    });

    it('does not render a board name element when boardName is omitted', () => {
      render(<BoardCard title="Fix login" />);
      expect(screen.queryByLabelText(/^Board:/)).toBeNull();
    });

    it('does not render a board name element when boardName is an empty string', () => {
      render(<BoardCard title="Fix login" boardName="" />);
      expect(screen.queryByLabelText(/^Board:/)).toBeNull();
    });

    it('renders board name above the title button', () => {
      render(<BoardCard title="Fix login" boardName="Alpha Project" onCardClick={() => {}} />);
      const name = screen.getByLabelText('Board: Alpha Project');
      const btn  = screen.getByRole('button', { name: 'Open card: Fix login' });
      // board name node appears before the button in DOM order
      expect(
        name.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    });
  });

  // --- B2: card kebab action menu ---

  describe('B2: card kebab action menu', () => {
    function makeMenu(overrides?: Partial<{
      onEdit: () => void;
      onDuplicate: () => void;
      onDelete: () => void;
      isDuplicating: boolean;
    }>) {
      return {
        onEdit: jest.fn(),
        onDuplicate: jest.fn(),
        onDelete: jest.fn(),
        isDuplicating: false,
        ...overrides,
      };
    }

    it('does not render an ActionMenu when onCardMenu is omitted', () => {
      render(<BoardCard title="My Task" />);
      expect(screen.queryByRole('button', { name: /Card actions/i })).toBeNull();
    });

    it('renders a "Card actions" trigger button when onCardMenu is provided', () => {
      render(<BoardCard title="My Task" onCardMenu={makeMenu()} />);
      expect(
        screen.getByRole('button', { name: 'Card actions for My Task' }),
      ).toBeInTheDocument();
    });

    it('shows Edit, Duplicate, Delete menu items when menu is opened', async () => {
      const user = userEvent.setup();
      render(<BoardCard title="My Task" onCardMenu={makeMenu()} />);
      await user.click(screen.getByRole('button', { name: 'Card actions for My Task' }));
      expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
    });

    it('calls onEdit when Edit menu item is selected', async () => {
      const user = userEvent.setup();
      const menu = makeMenu();
      render(<BoardCard title="My Task" onCardMenu={menu} />);
      await user.click(screen.getByRole('button', { name: 'Card actions for My Task' }));
      await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
      expect(menu.onEdit).toHaveBeenCalledTimes(1);
    });

    it('calls onDuplicate when Duplicate menu item is selected', async () => {
      const user = userEvent.setup();
      const menu = makeMenu();
      render(<BoardCard title="My Task" onCardMenu={menu} />);
      await user.click(screen.getByRole('button', { name: 'Card actions for My Task' }));
      await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
      expect(menu.onDuplicate).toHaveBeenCalledTimes(1);
    });

    it('calls onDelete when Delete menu item is selected', async () => {
      const user = userEvent.setup();
      const menu = makeMenu();
      render(<BoardCard title="My Task" onCardMenu={menu} />);
      await user.click(screen.getByRole('button', { name: 'Card actions for My Task' }));
      await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
      expect(menu.onDelete).toHaveBeenCalledTimes(1);
    });

    it('disables Duplicate item when isDuplicating is true', async () => {
      const user = userEvent.setup();
      render(<BoardCard title="My Task" onCardMenu={makeMenu({ isDuplicating: true })} />);
      await user.click(screen.getByRole('button', { name: 'Card actions for My Task' }));
      expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toBeDisabled();
    });

    it('does not fire onCardClick when clicking the kebab trigger', async () => {
      const user = userEvent.setup();
      const onCardClick = jest.fn();
      render(
        <BoardCard title="My Task" onCardClick={onCardClick} onCardMenu={makeMenu()} />,
      );
      await user.click(screen.getByRole('button', { name: 'Card actions for My Task' }));
      expect(onCardClick).not.toHaveBeenCalled();
    });

    it('still renders the × delete button when onCardDelete is provided without onCardMenu', () => {
      render(<BoardCard title="My Task" onCardDelete={jest.fn()} />);
      expect(screen.getByRole('button', { name: 'Delete card: My Task' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Card actions/i })).toBeNull();
    });

    it('applies pr-10 padding to the card body button when onCardMenu is set', () => {
      render(<BoardCard title="My Task" onCardMenu={makeMenu()} onCardClick={() => {}} />);
      const bodyBtn = screen.getByRole('button', { name: 'Open card: My Task' });
      expect(bodyBtn.className).toContain('pr-10');
    });
  });

  // --- B6: isDoneColumn ---

  describe('B6: isDoneColumn', () => {
    it('adds data-done="true" to the title element when isDoneColumn is true', () => {
      render(<BoardCard title="Finished task" onCardClick={() => {}} isDoneColumn={true} />);
      const titleEl = screen.getByText('Finished task');
      expect(titleEl).toHaveAttribute('data-done', 'true');
    });

    it('does not add data-done when isDoneColumn is false', () => {
      render(<BoardCard title="Pending task" onCardClick={() => {}} isDoneColumn={false} />);
      const titleEl = screen.getByText('Pending task');
      expect(titleEl).not.toHaveAttribute('data-done');
    });

    it('does not add data-done when isDoneColumn is omitted', () => {
      render(<BoardCard title="Normal task" onCardClick={() => {}} />);
      const titleEl = screen.getByText('Normal task');
      expect(titleEl).not.toHaveAttribute('data-done');
    });

    it('adds data-done="true" on the link title when href is provided and isDoneColumn is true', () => {
      render(<BoardCard title="Done link task" href="/cards/1" isDoneColumn={true} />);
      const titleEl = screen.getByText('Done link task');
      expect(titleEl).toHaveAttribute('data-done', 'true');
    });
  });
});
