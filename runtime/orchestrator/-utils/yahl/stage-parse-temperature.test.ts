import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { compileStage } from "./parse";
import { resolveEffectiveStageTemperature, stripLeadingTemperature } from "./stage-parse";

describe("stripLeadingTemperature", () => {
  it("strips prefix and returns temperature", () => {
    const { temperature, text } = stripLeadingTemperature("@temperature(0.6) {\n  a = 1;\n}");

    assert.equal(temperature, 0.6);
    assert.equal(text, "{\n  a = 1;\n}");
  });

  it("ignores temperature when CONTEXT is on the first line (xor)", () => {
    const { temperature, text } = stripLeadingTemperature(
      "@temperature(0.9) CONTEXT: {\n  return 1;\n}",
    );

    assert.equal(temperature, undefined);
    assert.equal(text, "CONTEXT: {\n  return 1;\n}");
  });

  it("still strips decorator when CONTEXT xor applies", () => {
    const { text } = stripLeadingTemperature("@temperature(0.1) for each i of [1..2] CONTEXT: {\n}");
    assert.match(text, /CONTEXT:/);
    assert.doesNotMatch(text, /@temperature/);
  });
});

describe("resolveEffectiveStageTemperature", () => {
  it("prefers explicit override then spec field", () => {
    const stage = compileStage({ logic: "x = 1;", temperature: 0.4 }, 1);

    assert.equal(
      resolveEffectiveStageTemperature(stage, { temperature: 0.9 }),
      0.9,
    );
    assert.equal(resolveEffectiveStageTemperature(stage), 0.4);
  });

  it("reads @temperature decorator when spec field is absent", () => {
    const stage = compileStage({ logic: "x = 1;" }, 1);
    const lines = `@temperature(1.5) ${stage.lines}`;

    assert.equal(
      resolveEffectiveStageTemperature({ ...stage, lines }, undefined, lines),
      1.5,
    );
  });

  it("uses loopMeta temperature as last fallback", () => {
    const stage = compileStage({ logic: "x = 1;" }, 1);

    assert.equal(
      resolveEffectiveStageTemperature(stage, { loopMeta: { temperature: 0.15 } }),
      0.15,
    );
  });
});

describe("compileStage temperature", () => {
  it("sets temperature on loop stage without embedding decorator", () => {
    const stage = compileStage({
      logic: "c += i;",
      loopSetup: "for each i of [1..2]",
      temperature: 0.3,
    }, 1);

    assert.equal(stage.temperature, 0.3);
    assert.equal(stage.type, "loop");
    assert.doesNotMatch(stage.lines, /@temperature/);
    assert.match(stage.lines, /^for each i of \[1..2\]/);
  });

  it("sets temperature on plain stage", () => {
    const stage = compileStage({
      logic: "y = 2;",
      temperature: 0.55,
    }, 1);

    assert.equal(stage.temperature, 0.55);
    assert.equal(stage.type, "plain");
  });
});
