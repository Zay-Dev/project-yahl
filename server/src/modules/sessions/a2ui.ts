import type { AskUserMultipleChoicePayload } from "../../types";

type A2uiEnvelope =
  | { createSurface: { catalogId: string; surfaceId: string }; version: "v0.8" }
  | { updateComponents: { components: unknown[]; surfaceId: string }; version: "v0.8" }
  | { updateDataModel: { path: string; surfaceId: string; value: unknown }; version: "v0.8" };

const basicCatalogId = "https://a2ui.org/specification/v0_8/basic_catalog.json";

export const toA2uiMultipleChoice = (
  surfaceId: string,
  question: AskUserMultipleChoicePayload,
): A2uiEnvelope[] => {
  const options = question.options.map((option) => ({
    label: option.label,
    value: option.id,
  }));

  return [
    {
      createSurface: {
        catalogId: basicCatalogId,
        surfaceId,
      },
      version: "v0.8",
    },
    {
      updateComponents: {
        components: [
          {
            children: ["title", "description", "choices", "submit"],
            component: "Column",
            id: "root",
          },
          {
            component: "Text",
            id: "title",
            text: question.title,
            variant: "h3",
          },
          {
            component: "Text",
            id: "description",
            text: question.description || "",
            variant: "caption",
          },
          {
            component: "ChoicePicker",
            id: "choices",
            options,
            value: { path: "/answerIds" },
            variant: question.allowMultiple ? "inclusive" : "mutuallyExclusive",
          },
          {
            action: {
              event: {
                context: { answerIds: { path: "/answerIds" } },
                name: "submitAnswer",
              },
            },
            child: "submitLabel",
            component: "Button",
            id: "submit",
            variant: "primary",
          },
          {
            component: "Text",
            id: "submitLabel",
            text: "Submit answer",
          },
        ],
        surfaceId,
      },
      version: "v0.8",
    },
    {
      updateDataModel: {
        path: "/answerIds",
        surfaceId,
        value: [],
      },
      version: "v0.8",
    },
  ];
};
