/**
 * Chappy tool schemas: strict-mode normalisation and runtime validation.
 *
 * Chappy streams with eager_input_streaming on every client tool, so the API
 * no longer buffers or validates tool inputs, and the SDK's tolerant parser can
 * hand back a silently truncated object. Every parsed input is therefore
 * validated against the tool's own JSON Schema before it runs (Task B1).
 *
 * The validator covers the subset the tool schemas use: type (incl. arrays of
 * types), enum, properties, required, additionalProperties:false, items.
 */

/** Deep-copy a schema, closing every object (additionalProperties:false) as strict mode requires. */
export function toStrictSchema(schema) {
  if (!schema || typeof schema !== "object") return schema;
  const out = Array.isArray(schema) ? schema.map(toStrictSchema) : {};
  if (Array.isArray(schema)) return out;
  for (const [k, v] of Object.entries(schema)) {
    if (k === "properties" && v && typeof v === "object") {
      out.properties = Object.fromEntries(Object.entries(v).map(([name, sub]) => [name, toStrictSchema(sub)]));
    } else if (k === "items") {
      out.items = toStrictSchema(v);
    } else {
      out[k] = v;
    }
  }
  if (out.type === "object") {
    out.properties = out.properties || {};
    out.required = Array.isArray(out.required) ? out.required : [];
    out.additionalProperties = false;
  }
  return out;
}

/**
 * The API accepts at most 20 strict tools per request (live 400 on 2026-09-28:
 * "Too many strict tools (31). The maximum number of strict tools supported is
 * 20."). Optional parameters across strict schemas are kept within 24 as a
 * conservative budget for the grammar the API compiles from them.
 */
export const STRICT_TOOL_LIMIT = 20;
export const STRICT_OPTIONAL_PARAM_BUDGET = 24;

/** Optional (not required) properties in a schema, counted recursively. */
export function countOptionalParams(schema) {
  let n = 0;
  if (schema && schema.type === "object") {
    const required = new Set(schema.required || []);
    for (const [k, v] of Object.entries(schema.properties || {})) {
      if (!required.has(k)) n++;
      n += countOptionalParams(v);
    }
  } else if (schema && schema.type === "array") {
    n += countOptionalParams(schema.items);
  }
  return n;
}

/**
 * Tool definitions for the request, sorted by name (a stable cache prefix).
 * Every tool gets a closed schema and eager_input_streaming; `strict: true`
 * goes on the tools named in strictNames (all of them when omitted), within
 * the API's limits. Tools outside it are still validated client-side before
 * they run (validateToolInput), like every other tool.
 */
export function toStrictToolDefs(tools, strictNames = null) {
  const defs = [...tools]
    .map((t) => {
      const strict = strictNames ? strictNames.has(t.name) : true;
      return Object.freeze({
        name: t.name,
        description: t.description,
        input_schema: toStrictSchema(t.input_schema),
        ...(strict ? { strict: true } : {}),
        eager_input_streaming: true,
      });
    })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const strictDefs = defs.filter((d) => d.strict);
  if (strictDefs.length > STRICT_TOOL_LIMIT) {
    throw new Error(`Chappy: ${strictDefs.length} strict tools; the API allows ${STRICT_TOOL_LIMIT}`);
  }
  const optional = strictDefs.reduce((n, d) => n + countOptionalParams(d.input_schema), 0);
  if (optional > STRICT_OPTIONAL_PARAM_BUDGET) {
    throw new Error(`Chappy: ${optional} optional params across strict tools; budget is ${STRICT_OPTIONAL_PARAM_BUDGET}`);
  }
  return Object.freeze(defs);
}

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  return typeof value;
}

function typeMatches(want, value) {
  const got = typeOf(value);
  if (want === got) return true;
  if (want === "number" && got === "integer") return true;
  return false;
}

function check(schema, value, path, errors) {
  if (!schema || typeof schema !== "object") return;
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => typeMatches(t, value))) {
      errors.push(`${path || "input"}: expected ${types.join("|")}, got ${typeOf(value)}`);
      return;
    }
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((e) => e === value)) {
    errors.push(`${path || "input"}: not one of ${schema.enum.join(", ")}`);
    return;
  }
  const kind = typeOf(value);
  if (kind === "object") {
    const props = schema.properties || {};
    for (const req of schema.required || []) {
      if (!(req in value)) errors.push(`${path ? `${path}.` : ""}${req}: required`);
    }
    for (const [k, v] of Object.entries(value)) {
      if (k in props) check(props[k], v, path ? `${path}.${k}` : k, errors);
      else if (schema.additionalProperties === false) errors.push(`${path ? `${path}.` : ""}${k}: not allowed`);
    }
  } else if (kind === "array" && schema.items) {
    value.forEach((item, i) => check(schema.items, item, `${path || "input"}[${i}]`, errors));
  }
}

/** Validate a parsed tool input against its schema. Returns { ok, errors }. */
export function validateToolInput(schema, input) {
  const errors = [];
  if (typeOf(input) !== "object") return { ok: false, errors: ["input: expected object"] };
  check(schema, input, "", errors);
  return { ok: errors.length === 0, errors };
}
