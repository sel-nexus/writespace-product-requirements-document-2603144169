/** Supply synthetic complete records and a JSX-free router rendering helper. */
import { createElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

export const USER_ID = '4e1c2d6a-7b8f-4a91-9d21-0f5a6c3b8e42';
export const POST_ID = '8b3a9b30-2ebd-48bd-94f8-4b9bd8a02c51';
export const TIME = '2026-01-10T09:00:00.000Z';
export const user = { id: USER_ID, displayName: 'Mina Chen', username: 'Mina', password: 'demo-only', role: 'user', createdAt: TIME };
export const session = { userId: USER_ID, username: 'Mina', displayName: 'Mina Chen', role: 'user' };
export const post = { id: POST_ID, title: 'A Quiet Morning', content: 'First paragraph.\nSecond paragraph.', authorId: USER_ID, authorName: 'Mina Chen', authorRole: 'user', createdAt: TIME, updatedAt: TIME };

/** Render a real component with isolated in-memory navigation. */
export function renderRoute(element, route = '/register') {
  return render(createElement(MemoryRouter, { initialEntries: [route], future: { v7_startTransition: true, v7_relativeSplatPath: true } }, element));
}
