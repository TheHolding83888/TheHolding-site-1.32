import { LearningIntake } from './index.js';

export { LearningIntake };

export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  }
};
