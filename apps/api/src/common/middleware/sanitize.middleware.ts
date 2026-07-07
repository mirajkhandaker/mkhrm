import { NextFunction, Request, Response } from 'express';

const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const SCRIPT_TAG = /<script[\s\S]*?>[\s\S]*?<\/script>/gi;

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(SCRIPT_TAG, '').replace(CONTROL_CHARS, '').trim();
  }
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = sanitizeValue(val);
    }
    return out;
  }
  return value;
}

/** Trims strings and strips control chars / inline <script> tags from request bodies before validation. */
export function sanitizeRequestBody(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  next();
}
