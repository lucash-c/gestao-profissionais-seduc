import type { ErrorRequestHandler, RequestHandler } from 'express';

export const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json({
    error: 'NOT_FOUND',
    message: 'Recurso não encontrado.',
  });
};

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  request.log.error({ error }, 'Falha não tratada na requisição');
  response.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'Não foi possível concluir a solicitação.',
  });
};
