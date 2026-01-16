import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { startKeepWarm } from './utils/keepWarm';
import { startBlogScheduler, getSchedulerStatus } from './services/blogScheduler';

// Routes
import authRoutes from './routes/auth';
import dreamsRoutes from './routes/dreams';
import analysisRoutes from './routes/analysis';
import billingRoutes from './routes/billing';
import blogRoutes from './routes/blog';

const app = express();

// Trust proxy (required for rate limiting behind reverse proxy like Render)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS - support both localhost and production URLs
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'https://ai-dream-blog.vercel.app',
  env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Stripe webhook needs raw body - must be before express.json()
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

// JSON parsing for other routes
app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dreams', dreamsRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/blog', blogRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// Start server
const PORT = parseInt(env.PORT, 10);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`);
  console.log(`Frontend URL: ${env.FRONTEND_URL}`);

  // Start keep-warm for Render free tier
  startKeepWarm(env.SERVICE_URL);

  // Start blog post scheduler
  startBlogScheduler();
});

export default app;
