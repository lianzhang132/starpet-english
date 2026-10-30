/**
 * Optional speaking invitations during ordinary story playback.
 *
 * This class only decides when an invitation is due. It never records audio,
 * judges an answer, changes learning progress, or awards a reward. Continuing
 * or skipping an invitation is always valid.
 */
export class StoryPauses {
  constructor(interactions = []) {
    this.interactions = (Array.isArray(interactions) ? interactions : [])
      .map((interaction, index) => ({interaction, index, at: interaction?.at}))
      .filter(({at}) => typeof at === 'number' && Number.isFinite(at) && at >= 0)
      .sort((a, b) => a.at - b.at || a.index - b.index);
    this.reset();
  }

  /** Start a new viewing session; the next sample only establishes a baseline. */
  reset(time = 0) {
    this.lastTime = Number.isFinite(time) && time >= 0 ? time : 0;
    this.hasBaseline = false;
    this.triggered = new Set();
  }

  /**
   * Return the original interaction when normal playback crosses its `at` time.
   * Call this on every timeupdate, including paused/disabled/hidden updates, so
   * a later resume cannot unexpectedly surface an invitation from the past.
   */
  sample(currentTime, {playing = true, visible = true, seeking = false, enabled = true} = {}) {
    if (typeof currentTime !== 'number' || !Number.isFinite(currentTime) || currentTime < 0) {
      this.hasBaseline = false;
      return null;
    }

    const previousTime = this.lastTime;
    const hadBaseline = this.hasBaseline;
    this.lastTime = currentTime;
    this.hasBaseline = true;
    const delta = currentTime - previousTime;

    // Large or backwards jumps are seeks, even if a platform misses seeking.
    if (!hadBaseline || !playing || !visible || seeking || !enabled || delta <= 0 || delta > 2.5) {
      return null;
    }

    const entry = this.interactions.find(({index, at}) =>
      !this.triggered.has(index) && previousTime < at && currentTime >= at);
    if (!entry) return null;

    // Track by source index, so malformed/duplicate ids cannot merge two points.
    this.triggered.add(entry.index);
    return entry.interaction;
  }
}
