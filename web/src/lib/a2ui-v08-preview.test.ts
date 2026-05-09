/// <reference types="node" />

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildA2uiPreviewModel } from "./a2ui-v08-preview";
import { buildA2uiPreviewModels, splitA2uiEnvelopesBySurface } from "./a2ui-v08-preview";

describe("buildA2uiPreviewModel", () => {
  it("parses all v0.8 standard component families", () => {
    const payload = [
      { createSurface: { catalogId: "std", surfaceId: "s1" }, version: "v0.8" },
      {
        updateComponents: {
          components: [
            { children: ["txt", "img", "btn", "tabs", "divider"], component: "Column", id: "root" },
            { component: "Text", id: "txt", text: "hello", variant: "h4" },
            { component: "Image", id: "img", url: "https://example.com/a.png" },
            {
              action: { open_url: { url: "https://example.com/open" }, type: "open_url" },
              child: "btnLabel",
              component: "Button",
              id: "btn",
              variant: "primary",
            },
            { component: "Text", id: "btnLabel", text: "save" },
            { component: "TextField", id: "tf", label: "Email", value: "a@b.com" },
            { component: "CheckBox", id: "cb", label: "Agree", value: true },
            { component: "Slider", id: "slider", maxValue: 10, minValue: 0, value: 3 },
            { component: "DateTimeInput", enableDate: true, enableTime: false, id: "dt", value: "2026-01-01" },
            { component: "ChoicePicker", id: "choice", options: [{ label: "A", value: "a" }], selectionValues: ["a"] },
            { child: "txt", component: "Card", id: "card1" },
            { component: "Modal", contentChild: "txt", entryPointChild: "btn", id: "modal1" },
            { axis: "horizontal", component: "Divider", id: "divider" },
            { component: "Icon", id: "icon", name: "check" },
            { children: ["txt"], component: "Row", id: "row1" },
            { children: ["txt"], component: "List", id: "list1" },
            { component: "Tabs", id: "tabs", tabItems: [{ child: "txt", title: "Main" }] },
          ],
          surfaceId: "s1",
        },
        version: "v0.8",
      },
    ];

    const model = buildA2uiPreviewModel(payload);
    assert.ok(model);
    assert.equal(model.surfaceId, "s1");
    assert.equal(model.diagnostics.missingRoot, false);
    assert.ok(model.nodes.has("choice"));
    assert.ok(model.nodes.has("tf"));
    assert.ok(model.nodes.has("modal1"));
    const button = model.nodes.get("btn");
    assert.ok(button && button.kind === "button");
    if (button && button.kind === "button") {
      assert.equal(button.actionUrl, "https://example.com/open");
    }
  });

  it("keeps preview model with diagnostics for unknown components", () => {
    const payload = [
      { createSurface: { catalogId: "std", surfaceId: "s1" }, version: "v0.8" },
      {
        updateComponents: {
          components: [
            { children: ["x"], component: "Column", id: "root" },
            { component: "UnknownWidget", id: "x" },
          ],
          surfaceId: "s1",
        },
        version: "v0.8",
      },
    ];

    const model = buildA2uiPreviewModel(payload);
    assert.ok(model);
    assert.equal(model.diagnostics.unsupportedComponentCount, 1);
    assert.equal(model.diagnostics.unsupportedComponentNames.UnknownWidget, 1);
  });

  it("splits payload into multiple surface models", () => {
    const payload = [
      { createSurface: { catalogId: "std", surfaceId: "s1" }, version: "v0.8" },
      {
        updateComponents: {
          components: [
            { children: ["txt1"], component: "Column", id: "root" },
            { component: "Text", id: "txt1", text: "surface-1" },
          ],
          surfaceId: "s1",
        },
        version: "v0.8",
      },
      { createSurface: { catalogId: "std", surfaceId: "s2" }, version: "v0.8" },
      {
        updateComponents: {
          components: [
            { children: ["txt2"], component: "Column", id: "root" },
            { component: "Text", id: "txt2", text: "surface-2" },
          ],
          surfaceId: "s2",
        },
        version: "v0.8",
      },
    ];

    const grouped = splitA2uiEnvelopesBySurface(payload);
    assert.equal(grouped.length, 2);

    const models = buildA2uiPreviewModels(payload);
    assert.equal(models.length, 2);
    assert.equal(models[0]?.surfaceId, "s1");
    assert.equal(models[1]?.surfaceId, "s2");
  });
});
