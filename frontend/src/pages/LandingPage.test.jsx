/** Verify exact discovery content, local read integrity and real guarded links. */
import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import LandingPage from './LandingPage.jsx';
import App from '../App.jsx';
import { renderRoute, post, session } from '../test/fixtures.js';
import { savePosts, setSession, STORAGE_KEYS } from '../utils/storage.js';

/** Pin browser-date expectations without changing shared test configuration. */
beforeEach(() => vi.stubEnv('TZ', 'UTC'));
/** Restore the caller's timezone after each discovery case. */
afterEach(() => vi.unstubAllEnvs());

const safety = 'Local-only demo: data and authentication are client-side. Credentials are stored in plain text. '
  + 'There is no backend, database, or network service. Do not use real or sensitive credentials.';

/** Observe the router while activating the real application. */
function Location() {
  return (
    <output aria-label="Current route">
      {useLocation().pathname}
    </output>
  );
}

/** Mount App at public entry, including its actual route guards. */
function mountApp() {
  renderRoute(
    <>
      <App />
      <Location />
    </>,
    '/',
  );
}

it('renders exact tagline, three features, empty copy and complete notice before footer', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-10T12:00:00.000Z'));
  renderRoute(<LandingPage posts={[]} />, '/');
  expect(screen.getByText('Your thoughts. Your space. Beautifully simple.')).toBeInTheDocument();
  const features = screen.getByRole('region', { name: 'Features' });
  expect(within(features).getAllByRole('article')).toHaveLength(3);
  for (const name of ['Write Freely', 'Private & Local', 'Instant & Fast']) {
    expect(within(features).getByRole('heading', { name })).toBeInTheDocument();
  }
  expect(screen.getByText('No posts yet — check back soon!')).toBeInTheDocument();
  const latest = screen.getByRole('region', { name: 'Latest from the Blog' });
  const notice = screen.getByRole('complementary', { name: 'Demo safety notice' });
  expect(notice).toHaveTextContent(safety);
  expect(screen.getByText(safety)).toBeInTheDocument();
  const footer = screen.getByRole('contentinfo');
  expect(latest.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(notice.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(footer).toHaveTextContent('© 2026 WriteSpace');
  expect(screen.queryByRole('complementary', { name: 'Featured post preview' })).not.toBeInTheDocument();
});

it('hydrates newest three complete local posts with stable ties, excerpt120 and browser dates', () => {
  const rows = [
    { ...post, title: 'Oldest', createdAt: '2026-01-01T12:00:00.000Z' },
    { ...post, id: '11111111-1111-4111-8111-111111111111', title: 'Tie first', createdAt: '2026-01-12T12:00:00.000Z' },
    { ...post, id: '22222222-2222-4222-8222-222222222222', title: 'Newest', content: 'x'.repeat(120) + 'hidden tail',
      createdAt: '2026-01-13T12:00:00.000Z' },
    { ...post, id: '33333333-3333-4333-8333-333333333333', title: 'Tie second', createdAt: '2026-01-12T12:00:00.000Z' },
  ];
  savePosts(rows);
  const bytes = localStorage.getItem(STORAGE_KEYS.posts);
  renderRoute(<LandingPage />, '/');
  const latest = screen.getByRole('region', { name: 'Latest from the Blog' });
  expect(within(latest).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent))
    .toEqual(['Newest', 'Tie first', 'Tie second']);
  expect(within(latest).getAllByRole('article')).toHaveLength(3);
  expect(screen.queryByText('Oldest')).not.toBeInTheDocument();
  expect(within(latest).getByText('x'.repeat(120))).toBeInTheDocument();
  expect(screen.queryByText(/hidden tail/)).not.toBeInTheDocument();
  const time = latest.querySelector('time');
  expect(time).toHaveAttribute('datetime', '2026-01-13T12:00:00.000Z');
  expect(time.textContent).toBe('Jan 13, 2026');
  const floating = screen.getByRole('complementary', { name: 'Featured post preview' });
  expect(floating).toHaveClass('motion-safe:animate-float', 'motion-reduce:animate-none');
  expect(within(floating).getByRole('link')).toHaveAttribute('href', `/blog/${rows[2].id}`);
  expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(bytes);
});

it('uses supplied posts without reading storage or changing frozen input and renders text safely', () => {
  const rows = Object.freeze([Object.freeze({ ...post, content: '<script>unsafe()</script>' })]);
  const get = vi.spyOn(Storage.prototype, 'getItem');
  renderRoute(<LandingPage posts={rows} />, '/');
  expect(get).not.toHaveBeenCalled();
  expect(screen.getAllByText('<script>unsafe()</script>')).toHaveLength(2);
  expect(document.querySelector('main script')).toBeNull();
  expect(rows[0].id).toBe(post.id);
});

it.each(['{broken', '{}', JSON.stringify([{ ...post, updatedAt: '' }]),
  JSON.stringify([{ ...post, createdAt: '2026-01-10' }])])('preserves invalid collection bytes %s', (raw) => {
  localStorage.setItem(STORAGE_KEYS.posts, raw);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const remove = vi.spyOn(Storage.prototype, 'removeItem');
  renderRoute(<LandingPage />, '/');
  expect(screen.getByRole('alert')).toHaveTextContent('Local data could not be read because it is invalid.');
  expect(screen.getByText('No posts yet — check back soon!')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /A Quiet Morning/ })).not.toBeInTheDocument();
  expect(write).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(raw);
});

it('shows a non-blocking warning on unavailable reads and never writes fallback', () => {
  const write = vi.spyOn(Storage.prototype, 'setItem');
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  renderRoute(<LandingPage />, '/');
  expect(screen.getByRole('alert')).toHaveTextContent('Local storage is unavailable. Existing data is unchanged;');
  expect(screen.getByRole('link', { name: 'Get Started Free' })).toHaveAttribute('href', '/register');
  expect(write).not.toHaveBeenCalled();
});

it.each([['Get Started Free', '/register'], ['Start Reading', '/login']])('activates guest %s through App', async (label, path) => {
  mountApp();
  expect(screen.getByLabelText('Current route')).toHaveTextContent(/^\/$/);
  await userEvent.setup().click(screen.getByRole('link', { name: label, exact: true }));
  expect(screen.getByLabelText('Current route')).toHaveTextContent(path);
});

it('redirects an activated guest preview to login without opening a reader or mutating posts', async () => {
  savePosts([post]);
  mountApp();
  const latest = screen.getByRole('region', { name: 'Latest from the Blog' });
  expect(screen.getByLabelText('Current route')).toHaveTextContent(/^\/$/);
  await userEvent.setup().click(within(latest).getByRole('link', { name: /A Quiet Morning/ }));
  expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
  expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
  expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe(JSON.stringify([post]));
});

it.each([['user', '/blogs'], ['admin', '/admin'], ['Admin', '/admin']])('activates Dashboard for %s through App', async (role, path) => {
  setSession({ ...session, role });
  mountApp();
  expect(screen.getByLabelText('Current route')).toHaveTextContent(/^\/$/);
  expect(screen.getAllByRole('navigation', { name: 'Public navigation' })).toHaveLength(1);
  expect(screen.queryByRole('link', { name: 'Get Started Free' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Start Reading' })).toHaveAttribute('href', '/blogs');
  await userEvent.setup().click(screen.getByRole('link', { name: 'Dashboard', exact: true }));
  expect(screen.getByLabelText('Current route')).toHaveTextContent(path);
  expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.session)).role).toBe(role);
});

it.each([['Home', '/'], ['All Blogs', '/login'], ['Login', '/login'], ['Register', '/register']])
  ('activates footer %s through real guest guards', async (label, path) => {
    mountApp();
    const footer = screen.getByRole('navigation', { name: 'Footer navigation' });
    await userEvent.setup().click(within(footer).getByRole('link', { name: label, exact: true }));
    expect(screen.getByLabelText('Current route').textContent).toBe(path);
  });

it('treats an invalid App session as a guest without repairing its bytes', () => {
  localStorage.setItem(STORAGE_KEYS.session, '{broken');
  mountApp();
  expect(screen.getByRole('alert')).toHaveTextContent('Existing data is unchanged');
  expect(screen.getByRole('link', { name: 'Get Started Free' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Dashboard', exact: true })).not.toBeInTheDocument();
  expect(localStorage.getItem(STORAGE_KEYS.session)).toBe('{broken');
});
