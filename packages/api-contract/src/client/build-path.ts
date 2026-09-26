/**
 * @file Fills the `:params` of an endpoint path with URL-encoded values.
 * @module @caa/api-contract/client/build-path
 * @see docs/standards/05-api-design.md
 */

/** Matches one `:param` segment. Kept in step with the `PathParamName` type. */
const PATH_PARAM_PATTERN = /:([^/]+)/g;

/** Thrown before any request is sent when a path param has no value. */
export class MissingPathParamError extends Error {
  /** Name of the param that had no value. */
  readonly paramName: string;

  /**
   * Creates the error for one missing param.
   *
   * @param paramName - Name of the missing param, without the leading `:`.
   * @param path - Path template that needed the param.
   */
  constructor(paramName: string, path: string) {
    super(`Missing path param "${paramName}" for ${path}`);
    this.name = 'MissingPathParamError';
    this.paramName = paramName;
  }
}

/**
 * Replaces every `:param` in a path template with its URL-encoded value.
 *
 * @param path - Path template, for example `/v1/students/:studentId`.
 * @param params - Value for each param. Params not in the path are ignored.
 * @returns The concrete path.
 * @throws {MissingPathParamError} When a param in the path has no value or an empty value.
 */
export function buildPath(path: string, params: Readonly<Record<string, string>>): string {
  return path.replace(PATH_PARAM_PATTERN, (_segment, name: string) => {
    const value = params[name];
    // NOTE: an empty value would collapse the segment and route to a different endpoint.
    if (value === undefined || value === '') {
      throw new MissingPathParamError(name, path);
    }
    return encodeURIComponent(value);
  });
}
