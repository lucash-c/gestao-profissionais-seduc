import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

import { HttpError } from './http-error.js';

export const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json({
    error: 'NOT_FOUND',
    message: 'Recurso não encontrado.',
  });
};

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  if (error instanceof HttpError) {
    response.status(error.status).json({
      error: error.code,
      message: error.message,
    });
    return;
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Dados de entrada inválidos.',
    });
    return;
  }

  request.log.error({ error }, 'Falha não tratada na requisição');
  response.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'Não foi possível concluir a solicitação.',
  });
};
