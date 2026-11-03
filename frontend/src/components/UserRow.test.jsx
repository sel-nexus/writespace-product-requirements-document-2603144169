/** Verify semantic account presentation and activated/protected controls. */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { UserRow } from './UserRow.jsx';
import { user, session } from '../test/fixtures.js';

it('renders a desktop semantic row with identity, role, date and no password', async () => {
  const onDelete = vi.fn();
  const account = { ...user, createdAt: new Date(2026, 0, 10, 12).toISOString() };
  render(
    <table>
      <tbody>
        <UserRow user={account} onDelete={onDelete} />
      </tbody>
    </table>,
  );
  expect(screen.getByRole('rowheader')).toHaveAttribute('scope', 'row');
  expect(screen.getByText(user.displayName)).toBeInTheDocument();
  expect(screen.getByText(user.username)).toBeInTheDocument();
  expect(screen.getByText(user.role)).toBeInTheDocument();
  expect(screen.getByText('Jan 10, 2026', { exact: true })).toHaveAttribute('dateTime', account.createdAt);
  expect(screen.getByRole('img', { name: 'User avatar' })).toBeInTheDocument();
  expect(screen.queryByText(user.password)).not.toBeInTheDocument();
  expect(onDelete).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: `Delete ${user.username}` }));
  expect(onDelete).toHaveBeenCalledWith(user.id);
});

it.each(['admin', 'Admin', 'user'])('renders mobile card retaining %s role', (role) => {
  render(<UserRow user={{ ...user, role }} onDelete={vi.fn()} mobile />);
  const card = screen.getByRole('article', { name: `Account ${user.username}` });
  expect(within(card).getByText(role)).toBeInTheDocument();
  expect(within(card).getByText('Created')).toBeInTheDocument();
  expect(within(card).getByText(user.displayName)).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

it.each(['bootstrap-id', 'bootstrap-name', 'self', 'read-only'])('disables %s delete without fabricated tooltip', async (mode) => {
  const account = mode === 'bootstrap-id' ? { ...user, id: 'admin' }
    : mode === 'bootstrap-name' ? { ...user, username: ' ADMIN ' } : user;
  const onDelete = vi.fn();
  render(
    <UserRow user={account} session={mode === 'self' ? session : null}
      disabled={mode === 'read-only'} onDelete={onDelete} mobile />,
  );
  const button = screen.getByRole('button');
  expect(button).toBeDisabled();
  expect(button).not.toHaveAttribute('title');
  await userEvent.click(button);
  expect(onDelete).not.toHaveBeenCalled();
});

it('shows an honest unavailable creation date for the nonpersisted bootstrap', () => {
  render(<UserRow user={{ id: 'admin', displayName: 'Admin', username: 'admin', role: 'admin' }} onDelete={vi.fn()} mobile />);
  expect(screen.getByText('—')).toBeInTheDocument();
  expect(screen.getByRole('button')).toBeDisabled();
});
