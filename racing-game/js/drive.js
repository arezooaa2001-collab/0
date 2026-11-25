// کنترل طولی مشترک ماشین و موتور بازیکن (مسابقه و شهر آزاد)
// قانون‌ها: گاز همیشه بر دنده عقب اولویت دارد؛ اگر در حال عقب رفتن گاز بدهی، اول می‌ایستد و بعد جلو می‌رود؛
// ترمز در هر سرعتی کار می‌کند و ماشین بعد از ایستادن کاملاً ثابت می‌ماند (بدون سُر خوردن)
import { clamp, damp } from './utils.js';

export function pedals(r, inp, vf, dt) {
  const gas = clamp(inp.throttle || 0, 0, 1);
  const back = gas > 0.05 ? 0 : Math.max(inp.reverse || 0, inp.brakeRev || 0);
  const brakeIn = Math.max(inp.brake || 0, vf > 0.5 ? back : 0, vf < -0.5 ? gas : 0);
  const revIn = vf <= 0.5 ? back : 0;
  r.throttle = damp(r.throttle || 0, vf < -0.5 ? 0 : gas, gas > (r.throttle || 0) ? 14 : 20, dt);
  r.brake = damp(r.brake || 0, brakeIn, 16, dt);
  r.rev = gas > 0.05 || revIn === 0 ? 0 : damp(r.rev || 0, revIn, 12, dt);
  r.gasHeld = gas; r.backHeld = back;
}
// شتاب ترمز و دنده عقب و مقاومت غلتشی (بعد از شتاب موتور اضافه می‌شود)
export function pedalAcc(r, st, vf, dt, grip = 1) {
  let acc = 0;
  if (r.brake > 0.02 && Math.abs(vf) > 0.001) { const bf = st.brake * r.brake * (0.6 + 0.4 * grip); acc -= Math.sign(vf) * Math.min(bf, Math.abs(vf) / dt); }
  if (r.rev > 0.02 && vf > -9) acc -= st.acc * 0.55 * r.rev;
  if (r.gasHeld < 0.05 && r.rev < 0.05 && Math.abs(vf) > 0.05) acc -= Math.sign(vf) * Math.min(0.85 + Math.abs(vf) * 0.012, Math.abs(vf) / dt);
  return acc;
}
export function settle(r, vfOld, vf) {
  if (vfOld > 0 && vf < 0 && r.rev < 0.05) vf = 0;
  if (vfOld < 0 && vf > 0 && r.gasHeld < 0.05) vf = 0;
  if (Math.abs(vf) < 0.3 && r.gasHeld < 0.05 && r.rev < 0.05) vf = 0;
  return vf;
}
