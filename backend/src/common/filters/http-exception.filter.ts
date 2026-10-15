import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';

/** Postgres error codes we translate into client errors. */
const PG_CLIENT_ERRORS: Record<string, number> = {
  P0001: HttpStatus.BAD_REQUEST, // RAISE EXCEPTION in our integrity triggers
  '23514': HttpStatus.BAD_REQUEST, // check_violation
  '23503': HttpStatus.BAD_REQUEST, // foreign_key_violation
  '22P02': HttpStatus.BAD_REQUEST, // invalid_text_representation (bad uuid etc.)
  '23505': HttpStatus.CONFLICT, // unique_violation
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    let payload: unknown =
      exception instanceof HttpException ? exception.getResponse() : { statusCode: status, message: 'Internal server error' };
    if (exception instanceof QueryFailedError) {
      const code = (exception.driverError as { code?: string } | undefined)?.code ?? '';
      const mapped = PG_CLIENT_ERRORS[code];
      if (mapped) {
        status = mapped;
        const message = code === '23505' ? 'A record with the same unique value already exists' : exception.message;
        payload = { statusCode: status, message };
      }
    }
    if (status >= 500) this.logger.error(exception instanceof Error ? exception.stack : exception);
    res.status(status).json(typeof payload === 'string' ? { statusCode: status, message: payload } : payload);
  }
}
