import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { createLoginThrottle } from "../src/middleware/loginThrottle.js";

function attempt(throttle, { ip = "1.2.3.4", status }) {
  const res = new EventEmitter();
  res.statusCode = 200;
  res.headers = {};
  res.set = (name, value) => {
    res.headers[name] = value;
  };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    res.emit("finish");
  };

  let passed = false;
  throttle({ ip }, res, () => {
    passed = true;
    res.statusCode = status;
    res.emit("finish");
  });
  return { passed, res };
}

describe("createLoginThrottle", () => {
  it("bloque après le nombre d'échecs autorisé, avec Retry-After", () => {
    const throttle = createLoginThrottle({ maxFailures: 3 });
    for (let index = 0; index < 3; index += 1) {
      expect(attempt(throttle, { status: 401 }).passed).toBe(true);
    }
    const blocked = attempt(throttle, { status: 401 });
    expect(blocked.passed).toBe(false);
    expect(blocked.res.statusCode).toBe(429);
    expect(Number(blocked.res.headers["Retry-After"])).toBeGreaterThan(0);
  });

  it("ne compte pas les connexions réussies et remet le compteur à zéro", () => {
    const throttle = createLoginThrottle({ maxFailures: 2 });
    attempt(throttle, { status: 401 });
    attempt(throttle, { status: 200 });
    attempt(throttle, { status: 401 });
    expect(attempt(throttle, { status: 401 }).passed).toBe(true);
  });

  it("isole les adresses IP entre elles", () => {
    const throttle = createLoginThrottle({ maxFailures: 1 });
    attempt(throttle, { ip: "1.1.1.1", status: 401 });
    expect(attempt(throttle, { ip: "1.1.1.1", status: 401 }).passed).toBe(false);
    expect(attempt(throttle, { ip: "2.2.2.2", status: 401 }).passed).toBe(true);
  });

  it("libère l'IP une fois la fenêtre écoulée", () => {
    let clock = 0;
    const throttle = createLoginThrottle({ maxFailures: 1, windowMs: 1000, now: () => clock });
    attempt(throttle, { status: 401 });
    expect(attempt(throttle, { status: 401 }).passed).toBe(false);
    clock = 1500;
    expect(attempt(throttle, { status: 401 }).passed).toBe(true);
  });
});
