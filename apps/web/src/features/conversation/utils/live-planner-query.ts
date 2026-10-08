/**
 * @file Reads the planner form's live values, including text the student typed but has not
 * sent, laid over the page's query. A chip fill starts from this so nothing typed is lost.
 * @module @caa/web/features/conversation/utils/live-planner-query
 * @requirement FR-08
 * @requirement NFR-02
 */

/**
 * Overlays the form's current field values on a copy of the page query.
 *
 * @param current - The page's query.
 * @param form - The planner form in the page, or `null` when it is not shown.
 * @returns The query with every field the form has set to what the form holds now.
 */
export function readLivePlannerQuery(
  current: URLSearchParams,
  form: HTMLFormElement | null,
): URLSearchParams {
  const params = new URLSearchParams(current);
  if (form === null) {
    return params;
  }
  for (const element of Array.from(form.elements)) {
    const name = element.getAttribute('name');
    if (name !== null) {
      params.delete(name);
    }
  }
  new FormData(form).forEach((value, key) => {
    if (typeof value === 'string') {
      params.append(key, value);
    }
  });
  return params;
}
