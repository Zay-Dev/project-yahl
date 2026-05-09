/// <reference types="node" />

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { A2uiPreviewModel } from "@/lib/a2ui-v08-preview";

import { A2uiV08Preview } from "./A2uiV08Preview";

describe("A2uiV08Preview", () => {
  it("renders mixed node kinds into static markup", () => {
    const model: A2uiPreviewModel = {
      diagnostics: {
        malformedComponentCount: 0,
        missingRoot: false,
        parseErrors: [],
        supportedComponentCount: 7,
        unsupportedComponentCount: 0,
        unsupportedComponentNames: {},
        unsupportedVersionCount: 0,
        versionCounts: { "v0.8": 1 },
      },
      nodes: new Map([
        ["root", { childIds: ["title", "btn", "tabs"], id: "root", kind: "column" }],
        ["title", { id: "title", kind: "text", text: "Hello", variant: "h3" }],
        ["btn", { actionUrl: "https://example.com/open", childId: "btnTxt", id: "btn", kind: "button", variant: "primary" }],
        ["btnTxt", { id: "btnTxt", kind: "text", text: "Submit" }],
        ["body", { id: "body", kind: "text", text: "Panel content" }],
        ["tabs", { id: "tabs", items: [{ childId: "body", title: "Main" }], kind: "tabs" }],
      ]),
      rootId: "root",
      surfaceId: "s1",
    };

    const html = renderToStaticMarkup(<A2uiV08Preview model={model} />);
    assert.ok(html.includes("Hello"));
    assert.ok(html.includes("Submit"));
    assert.ok(html.includes("Main"));
    assert.ok(html.includes("Panel content"));
    assert.ok(html.includes("href=\"https://example.com/open\""));
  });

  it("renders markdown for summary/detail body only", () => {
    const model: A2uiPreviewModel = {
      diagnostics: {
        malformedComponentCount: 0,
        missingRoot: false,
        parseErrors: [],
        supportedComponentCount: 5,
        unsupportedComponentCount: 0,
        unsupportedComponentNames: {},
        unsupportedVersionCount: 0,
        versionCounts: { "v0.8": 1 },
      },
      nodes: new Map([
        ["root", { childIds: ["title", "body", "note"], id: "root", kind: "column" }],
        ["title", { id: "title", kind: "text", text: "Daily Brief", variant: "h3" }],
        ["body", { id: "body", kind: "text", text: "- alpha\n- beta", variant: "body" }],
        ["note", { id: "note", kind: "text", text: "- keep literal", variant: "caption" }],
      ]),
      rootId: "root",
      surfaceId: "s1",
    };

    const html = renderToStaticMarkup(<A2uiV08Preview model={model} />);
    assert.ok(html.includes("<ul>"));
    assert.ok(html.includes("<li>alpha</li>"));
    assert.ok(html.includes("- keep literal"));
  });

  it("renders tbl_* layout as semantic table", () => {
    const model: A2uiPreviewModel = {
      diagnostics: {
        malformedComponentCount: 0,
        missingRoot: false,
        parseErrors: [],
        supportedComponentCount: 12,
        unsupportedComponentCount: 0,
        unsupportedComponentNames: {},
        unsupportedVersionCount: 0,
        versionCounts: { "v0.8": 1 },
      },
      nodes: new Map([
        ["root", { childIds: ["tbl_header", "tbl_row_0"], id: "root", kind: "column" }],
        ["tbl_header", { childIds: ["tbl_header_cell_0", "tbl_header_cell_1"], id: "tbl_header", kind: "row" }],
        ["tbl_header_cell_0", { childIds: ["tbl_header_text_0"], id: "tbl_header_cell_0", kind: "column" }],
        ["tbl_header_cell_1", { childIds: ["tbl_header_text_1"], id: "tbl_header_cell_1", kind: "column" }],
        ["tbl_header_text_0", { id: "tbl_header_text_0", kind: "text", text: "Title", variant: "h4" }],
        ["tbl_header_text_1", { id: "tbl_header_text_1", kind: "text", text: "Source", variant: "h4" }],
        ["tbl_row_0", { childIds: ["tbl_cell_0_0", "tbl_cell_0_1"], id: "tbl_row_0", kind: "row" }],
        ["tbl_cell_0_0", { childIds: ["tbl_cell_text_0_0"], id: "tbl_cell_0_0", kind: "column" }],
        ["tbl_cell_text_0_0", { id: "tbl_cell_text_0_0", kind: "text", text: "News item", variant: "body" }],
        ["tbl_cell_0_1", { childIds: ["tbl_cell_text_0_1"], id: "tbl_cell_0_1", kind: "column" }],
        ["tbl_cell_text_0_1", { childIds: ["tbl_btn_0_1"], id: "tbl_cell_text_0_1", kind: "column" }],
        ["tbl_btn_0_1", { actionUrl: "https://example.com", id: "tbl_btn_0_1", kind: "button", label: "Open" }],
      ]),
      rootId: "root",
      surfaceId: "s1",
    };

    const html = renderToStaticMarkup(<A2uiV08Preview model={model} />);
    assert.ok(html.includes("<table"));
    assert.ok(html.includes("<th"));
    assert.ok(html.includes("href=\"https://example.com\""));
  });
});
