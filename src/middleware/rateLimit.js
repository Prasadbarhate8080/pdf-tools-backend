import rateLimit from 'express-rate-limit';
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 15, // Max 15 requests per IP
    message: {
      status: 429,
      error: "Too many requests. Please try again after a minute.",
    },
    standardHeaders: true, // rate-limit info in headers
    legacyHeaders: false,
  });

export {apiLimiter}