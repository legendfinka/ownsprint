// Set by the `authenticate` middleware.
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export {};
