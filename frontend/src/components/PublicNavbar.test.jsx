/** Verify activated public navigation and role-preserving mobile disclosure. */
import { it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import { PublicNavbar } from './PublicNavbar.jsx';
import { renderRoute, session } from '../test/fixtures.js';

/** Observe actual navigation without replacing link behavior. */
function Location() {
  return (
    <output aria-label="Current route">
      {useLocation().pathname}
    </output>
  );
}

/** Mount a supplied identity and a visible route observer. */
function mount(identity = null) {
  return renderRoute(
    <>
      <PublicNavbar session={identity} />
      <Location />
    </>,
    '/',
  );
}

it.each([['Login', '/login'], ['Get Started', '/register']])('activates guest %s only on click', async (label, path) => {
  mount();
  const actor = userEvent.setup();
  const nav = screen.getByRole('navigation', { name: 'Public navigation' });
  expect(screen.getByLabelText('Current route')).toHaveTextContent(/^\/$/);
  expect(screen.queryByRole('link', { name: 'Go to Dashboard' })).not.toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  await actor.click(screen.getByRole('button', { name: 'Toggle navigation' }));
  await actor.click(within(nav).getByRole('link', { name: label, exact: true }));
  expect(screen.getByLabelText('Current route')).toHaveTextContent(path);
  expect(nav).toHaveClass('hidden');
});

it.each([
  ['user', '/blogs', 'User avatar'],
  ['admin', '/admin', 'Admin avatar'],
  ['Admin', '/admin', 'Admin avatar'],
  ['ADMIN', '/blogs', 'User avatar'],
])('uses the explicit role destination for %s without changing identity', async (role, path, avatar) => {
  const identity = Object.freeze({ ...session, role });
  mount(identity);
  const actor = userEvent.setup();
  expect(screen.getByText('Mina Chen')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: avatar })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Login' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Get Started' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('Current route')).toHaveTextContent(/^\/$/);
  await actor.click(screen.getByRole('button', { name: 'Toggle navigation' }));
  await actor.click(screen.getByRole('link', { name: 'Go to Dashboard' }));
  expect(screen.getByLabelText('Current route')).toHaveTextContent(path);
  expect(identity.role).toBe(role);
});

it('supports keyboard toggle, close and branding activation without storage changes', async () => {
  localStorage.setItem('unrelated', 'preserve');
  mount();
  const actor = userEvent.setup();
  const toggle = screen.getByRole('button', { name: 'Toggle navigation' });
  const nav = screen.getByRole('navigation', { name: 'Public navigation' });
  expect(toggle).toHaveAttribute('aria-controls', nav.id);
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(toggle.closest('header')).toHaveClass('sticky');
  toggle.focus();
  await actor.keyboard('{Enter}');
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await actor.keyboard(' ');
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await actor.click(toggle);
  await actor.click(screen.getByRole('link', { name: 'WriteSpace' }));
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByLabelText('Current route')).toHaveTextContent(/^\/$/);
  expect(localStorage.getItem('unrelated')).toBe('preserve');
});
