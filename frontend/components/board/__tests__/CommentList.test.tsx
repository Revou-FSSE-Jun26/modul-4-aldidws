import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { CommentList, type Comment } from '@/components/board/CommentList';

const makeComment = (n: number): Comment => ({
  id: `comment-${n}`,
  authorName: `Author ${n}`,
  body: `Comment body ${n}`,
  createdAt: '2024-01-15T10:00:00.000Z',
});

const THREE_COMMENTS: Comment[] = [makeComment(1), makeComment(2), makeComment(3)];

describe('CommentList', () => {
  it('renders the correct number of list items', () => {
    render(<CommentList comments={THREE_COMMENTS} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('renders each comment body text', () => {
    render(<CommentList comments={THREE_COMMENTS} />);
    for (const comment of THREE_COMMENTS) {
      expect(screen.getByText(comment.body)).toBeInTheDocument();
    }
  });

  it('renders empty-state message when comments array is empty', () => {
    render(<CommentList comments={[]} />);
    expect(screen.getByText(/no comments yet/i)).toBeInTheDocument();
  });

  it('does not render list items when comments is empty', () => {
    render(<CommentList comments={[]} />);
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('renders the footer slot when provided', () => {
    render(
      <CommentList
        comments={[]}
        footer={<button>Add comment</button>}
      />
    );
    expect(
      screen.getByRole('button', { name: /add comment/i })
    ).toBeInTheDocument();
  });
});
