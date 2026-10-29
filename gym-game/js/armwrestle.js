'use strict';
/* Arm wrestling at the high table in the gym: tap fast to push the opponent's hand down */

class ArmMatch {
  /** opp: { name, level }; playerLevel decides how much each tap is worth. */
  constructor(gym, player, opp, playerLevel) {
    this.gym = gym;
    this.player = player;
    this.opp = opp;
    this.state = 'count';
    this.t = 0;
    this.theta = 0;
    this.effort = 0;
    this.surge = 0;
    this.surgeT = rand(2.5, 4);
    this.taps = 0;
    const r = (playerLevel + 6) / (opp.level + 6);
    this.tapPower = 0.072 * Math.sqrt(r);
    this.oppPush = 0.36 / Math.sqrt(r);
    const { x, z } = ARM_TABLE;
    this.spotP = { x: x + 0.18, z: z - 0.5 };
    this.spotO = { x: x - 0.18, z: z + 0.5 };
    const P = player;
    P.anchor = { x: this.spotP.x, z: this.spotP.z, ax: x + 0.18, az: z - 1.5, y: 0, arm: true };
    P.ch.root.position.set(this.spotP.x, 0, this.spotP.z);
    P.ch.root.rotation.y = 0;
    P.vel.set(0, 0);
    P.ch.manual = true;
    P.ch.manualSnap = false;
    const ch = new Character(Object.assign(randomOutfit(), { muscle: muscleFor(opp.level), band: opp.champ ? '#ffd34d' : null }));
    ch.setLabel(opp.name, 'سطح ' + fa(opp.level), opp.champ ? '#ffd34d' : '#7fe0ff');
    ch.root.position.set(this.spotO.x, 0, this.spotO.z);
    ch.root.rotation.y = Math.PI;
    ch.manual = true;
    gym.scene.add(ch.root);
    this.oc = ch;
    this.camSave = Object.assign({}, gym.cam);
    gym.cam.yaw = -Math.PI / 2 + 0.25;
    gym.cam.pitch = 0.2;
    gym.cam.dist = window.innerWidth < window.innerHeight ? 5.6 : 4.6;
    if (P.ch.label) P.ch.label.visible = false;
    this.pose(0);
  }

  pose(dt) {
    const t = this.gym.time;
    armWrestlePose(this.player.ch.manualPose, this.theta, this.effort, 1, t);
    armWrestlePose(this.oc.manualPose, this.theta, 0.6 + this.surge, -1, t);
    if (this.state === 'done') {
      // the loser's hand is flat on the table; the winner stands up and cheers
      const winP = this.result.win;
      const W = winP ? this.player.ch.manualPose : this.oc.manualPose;
      copyPose(W, STAND);
      W.shLX = W.shRX = -2.7;
      W.shLZ = 0.45; W.shRZ = -0.45;
      W.elL = W.elR = -0.3;
      W.y = 0.08 * Math.abs(Math.sin(this.t * 7));
    }
    this.oc.update(dt);
  }

  tap() {
    if (this.state !== 'pull') return;
    this.taps++;
    this.theta += this.tapPower;
    this.effort = Math.min(1, this.effort + 0.25);
    Sfx.play('tap');
  }

  /** Returns null while going, or { win } when someone's hand hits the table. */
  update(dt) {
    this.t += dt;
    let res = null;
    if (this.state === 'count') {
      if (this.t >= 2.4) { this.state = 'pull'; this.t = 0; }
    } else if (this.state === 'pull') {
      this.surgeT -= dt;
      if (this.surgeT <= 0) {
        this.surge = 1;
        this.surgeT = rand(3, 5);
        this.onSurge && this.onSurge();
      }
      this.surge = Math.max(0, this.surge - dt / 0.9);
      const push = this.oppPush * (1 + 1.4 * this.surge) * Math.min(1, 0.3 + this.t * 0.5);
      this.theta -= push * dt;
      this.effort = Math.max(0, this.effort - dt * 1.2);
      if (this.theta >= 1 || this.theta <= -1 || this.t > 25) {
        const win = this.theta > 0;
        this.result = { win, timeout: this.t > 25 };
        this.theta = win ? 1.1 : -1.1;
        this.state = 'done';
        this.t = 0;
        res = this.result;
      }
    }
    this.pose(dt);
    return res;
  }

  dispose() {
    this.gym.scene.remove(this.oc.root);
    const P = this.player;
    P.ch.manual = false;
    if (P.anchor && P.anchor.arm) {
      P.ch.root.position.set(P.anchor.ax, 0, P.anchor.az);
      P.anchor = null;
    }
    Object.assign(this.gym.cam, { pitch: this.camSave.pitch, dist: this.camSave.dist });
  }
}
