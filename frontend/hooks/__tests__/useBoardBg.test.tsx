import '@testing-library/jest-dom';
import { render, screen, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { useBoardBg } from '@/hooks/useBoardBg';
import { BoardBgWrapper, useOptionalBoardBgContext } from '@/components/board/BoardBgWrapper';

describe('useBoardBg', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns the default "mint" when nothing is stored', () => {
    const { result } = renderHook(() => useBoardBg());
    expect(result.current.bgId).toBe('mint');
  });

  it('reads the global "board-bg" key when set', () => {
    localStorage.setItem('board-bg', 'teal');
    const { result } = renderHook(() => useBoardBg());
    expect(result.current.bgId).toBe('teal');
  });

  it('prefers the per-board key over the global one', () => {
    localStorage.setItem('board-bg', 'teal');
    localStorage.setItem('board-bg-b-1', 'forest');
    const { result } = renderHook(() => useBoardBg('b-1'));
    expect(result.current.bgId).toBe('forest');
  });

  it('setBgId persists to the per-board key when boardId is given', () => {
    const { result } = renderHook(() => useBoardBg('b-1'));
    act(() => result.current.setBgId('lagoon'));
    expect(result.current.bgId).toBe('lagoon');
    expect(localStorage.getItem('board-bg-b-1')).toBe('lagoon');
    // The global key is untouched.
    expect(localStorage.getItem('board-bg')).toBeNull();
  });

  it('setBgId persists to the global key when no boardId is given', () => {
    const { result } = renderHook(() => useBoardBg());
    act(() => result.current.setBgId('sage'));
    expect(localStorage.getItem('board-bg')).toBe('sage');
  });

  it('sets data-board-bg on the wrapper element passed in', () => {
    function Harness() {
      const ref = useRef<HTMLDivElement>(null);
      const { bgId, setBgId } = useBoardBg(undefined, ref);
      return (
        <div ref={ref}>
          <span>{bgId}</span>
          <button type="button" onClick={() => setBgId('midnight')}>
            set
          </button>
        </div>
      );
    }
    render(<Harness />);
    // Default mint is applied via the effect.
    const wrapper = screen.getByText('mint').parentElement as HTMLElement;
    expect(wrapper).toHaveAttribute('data-board-bg', 'mint');

    act(() => {
      screen.getByRole('button', { name: 'set' }).click();
    });
    expect(wrapper).toHaveAttribute('data-board-bg', 'midnight');
  });
});

describe('BoardBgWrapper', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('applies board-bg class and data-board-bg attribute', () => {
    const { container } = render(
      <BoardBgWrapper>
        <p>content</p>
      </BoardBgWrapper>,
    );
    const el = container.firstChild as HTMLElement;
    expect(el.classList.contains('board-bg')).toBe(true);
    expect(el).toHaveAttribute('data-board-bg', 'mint');
  });

  it('exposes bgId and setBgId through the context', () => {
    let ctxValue: ReturnType<typeof useOptionalBoardBgContext> = null;
    function Child() {
      ctxValue = useOptionalBoardBgContext();
      return null;
    }
    render(
      <BoardBgWrapper boardId="b-2">
        <Child />
      </BoardBgWrapper>,
    );
    expect(ctxValue).not.toBeNull();
    expect(ctxValue!.bgId).toBe('mint');
    act(() => ctxValue!.setBgId('teal'));
    expect(localStorage.getItem('board-bg-b-2')).toBe('teal');
  });

  it('useOptionalBoardBgContext returns null outside the wrapper', () => {
    let ctxValue: unknown = 'unset';
    function Child() {
      ctxValue = useOptionalBoardBgContext();
      return null;
    }
    render(<Child />);
    expect(ctxValue).toBeNull();
  });
});
