import learningWorker, { LearningIntake } from './index.js';

export { LearningIntake };

const API_PATHS = new Set([
  '/api/learning-status',
  '/api/learning-intake',
  '/api/learning-feedback',
  '/api/learning-insights'
]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!API_PATHS.has(url.pathname)) {
      return new Response(JSON.stringify({ error: 'not-found' }), {
        status: 404,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff'
        }
      });
    }
    return learningWorker.fetch(request, env, ctx);
  }
};
