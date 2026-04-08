import { treaty } from '@elysiajs/eden';
import { app } from '@/backend/elysia/app';

type App = typeof app;

const getBaseUrl = () => {
  if (typeof process !== 'undefined') {
    return process.env.BASE_URL || 'http://localhost:3000';
  }

  return 'http://localhost:3000';
};

export const api =
  typeof process !== 'undefined'
    ? treaty(app).api
    : treaty<App>(getBaseUrl()).api;


