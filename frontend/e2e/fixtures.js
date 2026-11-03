/** Capture browser errors before entry and provide complete synthetic local data. */
import { test as base, expect } from '@playwright/test';

export const localUser = {
  id: '4e1c2d6a-7b8f-4a91-9d21-0f5a6c3b8e42', displayName: 'Mina Chen',
  username: 'Mina', password: 'demo-only', role: 'user', createdAt: '2026-01-10T09:00:00.000Z',
};
export const localSession = { userId: localUser.id, username: localUser.username, displayName: localUser.displayName, role: localUser.role };
export const localPost = {
  id: '8b3a9b30-2ebd-48bd-94f8-4b9bd8a02c51', title: 'A Quiet Morning',
  content: 'Synthetic writing only.', authorId: localUser.id, authorName: localUser.displayName,
  authorRole: localUser.role, createdAt: localUser.createdAt, updatedAt: localUser.createdAt,
};
export const test = base.extend({
  browserErrors: [async ({ page }, use) => {
    const errors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await use(errors);
    expect(errors).toEqual([]);
  }, { auto: true }],
});
export { expect };
