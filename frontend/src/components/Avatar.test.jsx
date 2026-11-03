/** Verify sourced avatar rendering and unsupported/absent role behavior. */
import { it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar } from './Avatar.jsx';

it.each(['admin', 'Admin'])('uses the source crown and admin accent for %s', (role) => {
  render(<Avatar role={role} />);
  expect(screen.getByRole('img', { name: 'Admin avatar' })).toHaveTextContent('👑');
  expect(screen.getByRole('img')).toHaveClass('bg-secondary-600', 'h-10');
});
it.each(['user', 'ADMIN', '', undefined])('uses ordinary book without granting admin behavior for %s', (role) => {
  render(<Avatar role={role} />);
  expect(screen.getByRole('img', { name: 'User avatar' })).toHaveTextContent('📚');
  expect(screen.getByRole('img')).toHaveClass('bg-primary-500');
});
it.each([['sm', 'h-8'], ['md', 'h-10'], ['lg', 'h-12']])('renders supported size %s', (size, height) => {
  render(<Avatar role="user" size={size} />);
  expect(screen.getByRole('img')).toHaveClass(height);
});

it('falls back to medium for an unsupported size while reporting invalid props', () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  render(<Avatar role="user" size="unknown" />);
  expect(screen.getByRole('img')).toHaveClass('h-10');
  expect(error).toHaveBeenCalled();
});
