import { NextRequest, NextResponse } from 'next/server';
import { ZodError, ZodSchema } from 'zod';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }

  static validationError(message: string, details?: unknown) {
    return new ApiError(400, 'VALIDATION_ERROR', message, details);
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static conflict(message: string) {
    return new ApiError(409, 'CONFLICT', message);
  }

  static unsupportedMediaType(message = 'Content-Type must be application/json') {
    return new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', message);
  }

  static internal(message = 'Internal server error') {
    return new ApiError(500, 'INTERNAL_SERVER_ERROR', message);
  }

  static badGateway(message = 'Bad gateway') {
    return new ApiError(502, 'BAD_GATEWAY', message);
  }
}

export function json<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}

export async function parseBody<T>(req: Request | NextRequest, schema: ZodSchema<T>): Promise<T> {
  const method = req.method.toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      throw ApiError.unsupportedMediaType('Content-Type must be application/json');
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw ApiError.badRequest('Invalid JSON in request body');
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    throw result.error;
  }

  return result.data;
}

export function parseQuery<T>(
  urlOrReq: string | Request | NextRequest | URL,
  schema: ZodSchema<T>
): T {
  let searchParams: URLSearchParams;

  if (typeof urlOrReq === 'string') {
    searchParams = new URL(urlOrReq, 'http://localhost').searchParams;
  } else if (urlOrReq instanceof URL) {
    searchParams = urlOrReq.searchParams;
  } else if ('nextUrl' in urlOrReq && urlOrReq.nextUrl) {
    searchParams = (urlOrReq as NextRequest).nextUrl.searchParams;
  } else {
    searchParams = new URL((urlOrReq as Request).url, 'http://localhost').searchParams;
  }

  const queryObj: Record<string, unknown> = {};
  for (const [key, value] of searchParams.entries()) {
    if (key in queryObj) {
      const existing = queryObj[key];
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        queryObj[key] = [existing, value];
      }
    } else {
      queryObj[key] = value;
    }
  }

  const result = schema.safeParse(queryObj);
  if (!result.success) {
    throw result.error;
  }

  return result.data;
}

export type RouteContext = {
  params: Promise<Record<string, string | string[]>>;
};

export function withErrorHandling<T = unknown>(
  handler: (req: NextRequest, context: RouteContext) => Promise<NextResponse<T>> | NextResponse<T>
) {
  return async (req: NextRequest, context: RouteContext): Promise<NextResponse> => {
    try {
      return await handler(req, context);
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        return NextResponse.json(
          {
            error: {
              code: error.code,
              message: error.message,
              ...(error.details !== undefined ? { details: error.details } : {}),
            },
          },
          { status: error.status }
        );
      }

      if (error instanceof ZodError) {
        const fieldDetails = error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));

        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid request data',
              details: fieldDetails,
            },
          },
          { status: 400 }
        );
      }

      // Log server-side only for unknown internal errors
      console.error('Unhandled API Error:', error);

      return NextResponse.json(
        {
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected server error occurred',
          },
        },
        { status: 500 }
      );
    }
  };
}
