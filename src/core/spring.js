/**
 * Silkframe — damped spring physics.
 * Semi-implicit Euler integrated at a fixed 240 Hz sub-step, so the motion is
 * identical on 60 Hz, 120 Hz and 144 Hz displays and stays stable even with
 * very stiff settings.
 */

const STEP = 1 / 240;

export class Spring {
  constructor(value = 0, { stiffness = 170, damping = 26, mass = 1, precision = 0.01 } = {}) {
    this.value = value;
    this.target = value;
    this.velocity = 0;
    this.stiffness = stiffness;
    this.damping = damping;
    this.mass = mass;
    this.precision = precision;
  }

  /** Hard-set value and target (no motion). */
  set(v) {
    this.value = this.target = v;
    this.velocity = 0;
    return this;
  }

  to(target) {
    this.target = target;
    return this;
  }

  /** Advance by dt seconds. Returns the new value. */
  step(dt) {
    if (this.resting) {
      this.value = this.target;
      this.velocity = 0;
      return this.value;
    }
    let remaining = Math.min(dt, 0.064);
    while (remaining > 1e-6) {
      const h = Math.min(STEP, remaining);
      const force = -this.stiffness * (this.value - this.target) - this.damping * this.velocity;
      this.velocity += (force / this.mass) * h;
      this.value += this.velocity * h;
      remaining -= h;
    }
    return this.value;
  }

  get resting() {
    return Math.abs(this.velocity) < this.precision && Math.abs(this.value - this.target) < this.precision;
  }
}

/** Convenience: a group of named springs sharing a config. */
export function springs(initial, config) {
  const group = {};
  for (const key of Object.keys(initial)) group[key] = new Spring(initial[key], config);
  return {
    s: group,
    step(dt) {
      let resting = true;
      for (const key in group) {
        group[key].step(dt);
        if (!group[key].resting) resting = false;
      }
      return resting;
    },
    get(key) {
      return group[key].value;
    },
  };
}

/** Classic presets (stiffness / damping) */
export const presets = {
  gentle: { stiffness: 120, damping: 14 },
  wobbly: { stiffness: 180, damping: 12 },
  stiff: { stiffness: 260, damping: 26 },
  slow: { stiffness: 80, damping: 20 },
  molasses: { stiffness: 50, damping: 18 },
  snappy: { stiffness: 420, damping: 32 },
};
