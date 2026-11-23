import { Hono } from 'hono';
import type { Bindings, Variables } from './types';
import { getCurrentUser } from './lib/auth';
import publicRoutes from './routes/public';
import picksRoutes from './routes/picks';
import adminRoutes from './routes/admin';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use('*', async (c, next) => {
  const user = await getCurrentUser(c);
  c.set('user', user);
  await next();
});

app.route('/', publicRoutes);
app.route('/', picksRoutes);
app.route('/admin', adminRoutes);

app.onError((err, c) => {
  if (err instanceof Response) return err;
  console.error(err);
  return c.text('Error interno', 500);
});

export default app;
