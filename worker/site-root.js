import { LearningIntake } from './index.js';

export { LearningIntake };

// Production Boundary benign canary: comment-only, no runtime behavior change.
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  }
};
