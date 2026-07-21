import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { DeepSeekError, DeepSeekRateLimitError, DeepSeekRequestError, DeepSeekTimeoutError } from './adapters/deepseek.client';

/**
 * loading-agent-llm resilience protocol — maps typed `DeepSeekError`
 * subclasses (thrown by `DeepSeekClient`/`DeepSeekJsonAdapter` through
 * `PlanningAgentService`) to meaningful HTTP responses on
 * `PlanningAgentController`, instead of Nest's generic 500:
 *   - `DeepSeekRateLimitError` (429)          → 429, with `Retry-After` when known
 *   - `DeepSeekTimeoutError`                  → 504 (Gateway Timeout)
 *   - `DeepSeekRequestError`, upstream 5xx or a network-level failure
 *     (i.e. retries were exhausted)           → 503 (Service Unavailable)
 *   - `DeepSeekRequestError`, upstream 4xx (non-retryable, e.g. 401/404)
 *     → 502 (Bad Gateway) — our own request to DeepSeek was rejected;
 *     still not the generic 500.
 */
@Catch(DeepSeekError)
export class DeepSeekExceptionFilter implements ExceptionFilter {
  catch(exception: DeepSeekError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const mapped = this.resolve(exception);

    if (mapped.retryAfterSeconds !== undefined) {
      response.setHeader('Retry-After', String(mapped.retryAfterSeconds));
    }

    response.status(mapped.status).json({ statusCode: mapped.status, message: mapped.message });
  }

  private resolve(exception: DeepSeekError): { status: number; message: string; retryAfterSeconds?: number } {
    if (exception instanceof DeepSeekRateLimitError) {
      return {
        status: HttpStatus.TOO_MANY_REQUESTS,
        message: 'DeepSeek rate-limited the request. Please retry later.',
        retryAfterSeconds: exception.retryAfterMs !== undefined ? Math.ceil(exception.retryAfterMs / 1000) : undefined,
      };
    }

    if (exception instanceof DeepSeekTimeoutError) {
      return { status: HttpStatus.GATEWAY_TIMEOUT, message: 'DeepSeek did not respond in time.' };
    }

    if (exception instanceof DeepSeekRequestError) {
      const upstreamStatus = exception.status;
      const isNonRetryableUpstreamClientError = upstreamStatus !== undefined && upstreamStatus < 500;

      if (isNonRetryableUpstreamClientError) {
        return {
          status: HttpStatus.BAD_GATEWAY,
          message: `DeepSeek rejected the request (upstream status ${upstreamStatus}).`,
        };
      }

      return { status: HttpStatus.SERVICE_UNAVAILABLE, message: 'DeepSeek is unavailable after retries were exhausted.' };
    }

    return { status: HttpStatus.SERVICE_UNAVAILABLE, message: 'DeepSeek is unavailable.' };
  }
}
