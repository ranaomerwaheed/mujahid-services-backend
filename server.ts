import 'dotenv/config';
import cookieParser from 'cookie-parser';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import {
  createPublicBooking,
  createPublicInquiry,
  createPublicReview,
  db,
  exportFullJsonBackup,
  getAdminNotifications,
  getAdminUserById,
  getAllAdminBlogPosts,
  getAllAdminBookings,
  getAllAdminCustomers,
  getAllAdminFaqs,
  getAllAdminGalleryItems,
  getAllAdminInquiries,
  getAllAdminPlans,
  getAllAdminProducts,
  getAllAdminProjects,
  getAllAdminServices,
  getAllAdminTestimonials,
  getCustomerBookings,
  getDashboardStats,
  getPublicBootstrap,
  getReportsData,
  getSiteSettings,
  hashPassword,
  initializeDatabase,
  restoreFromJsonBackup,
  updateSiteSettings,
  verifyPassword,
} from './server/db.ts';

initializeDatabase();

const app = express();
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT) || 3000;
const SESSION_COOKIE = 'ms_admin_session';
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  crypto.createHash('sha256').update(`mujahid-services-${process.cwd()}`).digest('hex');

const ALLOWED_ORIGINS = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin.replace(/\/+$/, ''))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.use(express.json({ limit: '12mb' }));
app.use(cookieParser());
app.use('/uploads', express.static(UPLOADS_DIR));

function signToken(rawToken: string): string {
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(rawToken).digest('hex');
  return `${rawToken}.${sig}`;
}

function verifySignedToken(signedValue: string | undefined): string | null {
  if (!signedValue || !signedValue.includes('.')) return null;
  const [rawToken, providedSig] = signedValue.split('.');
  if (!rawToken || !providedSig) return null;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(rawToken).digest('hex');
  const a = Buffer.from(providedSig, 'hex');
  const b = Buffer.from(expectedSig, 'hex');
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  return rawToken;
}

interface AuthedRequest extends Request {
  adminId?: number;
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  const rawToken = verifySignedToken(req.cookies?.[SESSION_COOKIE]);
  if (!rawToken) {
    res.status(401).json({ error: 'Authentication required. Please log in as administrator.' });
    return;
  }

  const session = db
    .prepare("SELECT admin_id, expires_at FROM admin_sessions WHERE token = ? AND expires_at > datetime('now')")
    .get(rawToken) as { admin_id: number; expires_at: string } | undefined;

  if (!session) {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
    return;
  }

  req.adminId = session.admin_id;
  next();
}

function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-()]+/g, '');
  return /^(\+92|0)?3\d{9}$/.test(cleaned) || /^\+?\d{10,14}$/.test(cleaned);
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ============================================================================
// SEO (robots.txt & dynamic sitemap.xml) + HEALTHCHECK
// ============================================================================

function getBaseUrl(req: Request): string {
  if (process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL') {
    return process.env.APP_URL.replace(/\/+$/, '');
  }
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.get('host') || `localhost:${PORT}`;
  return `${proto}://${host}`.replace(/\/+$/, '');
}

app.get('/robots.txt', (req, res) => {
  const baseUrl = getBaseUrl(req);
  res.type('text/plain').send(
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin',
      'Disallow: /api/',
      '',
      `Sitemap: ${baseUrl}/sitemap.xml`,
      '',
    ].join('\n')
  );
});

app.get('/sitemap.xml', (req, res) => {
  try {
    const baseUrl = getBaseUrl(req);
    const today = new Date().toISOString().slice(0, 10);
    const bootstrap = getPublicBootstrap();

    const staticRoutes = [
      { path: '/', priority: '1.0', freq: 'daily' },
      { path: '/services', priority: '0.9', freq: 'weekly' },
      { path: '/products', priority: '0.8', freq: 'weekly' },
      { path: '/projects', priority: '0.8', freq: 'weekly' },
      { path: '/maintenance-plans', priority: '0.8', freq: 'monthly' },
      { path: '/gallery', priority: '0.7', freq: 'weekly' },
      { path: '/blog', priority: '0.8', freq: 'weekly' },
      { path: '/about', priority: '0.7', freq: 'monthly' },
      { path: '/why-choose-us', priority: '0.7', freq: 'monthly' },
      { path: '/reviews', priority: '0.7', freq: 'weekly' },
      { path: '/faqs', priority: '0.7', freq: 'monthly' },
      { path: '/contact', priority: '0.8', freq: 'monthly' },
      { path: '/book', priority: '0.9', freq: 'weekly' },
    ];

    const serviceUrls = bootstrap.services.map((s) => ({
      path: `/services/${s.slug}`,
      priority: '0.85',
      freq: 'monthly',
    }));

    const blogUrls = bootstrap.blogPosts.map((p) => ({
      path: `/blog/${p.slug}`,
      priority: '0.75',
      freq: 'monthly',
      lastmod: p.publishedAt || today,
    }));

    const allEntries: Array<{ path: string; priority: string; freq: string; lastmod?: string }> = [
      ...staticRoutes,
      ...serviceUrls,
      ...blogUrls,
    ];

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...allEntries.map(
        (entry) =>
          `  <url><loc>${baseUrl}${entry.path}</loc><lastmod>${entry.lastmod || today}</lastmod><changefreq>${entry.freq}</changefreq><priority>${entry.priority}</priority></url>`
      ),
      '</urlset>',
    ].join('\n');

    res.type('application/xml').send(xml);
  } catch (err) {
    res.status(500).type('text/plain').send('Failed to generate sitemap');
  }
});

app.get('/api/health', (_req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ ok: true, db: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Database unavailable' });
  }
});

// ============================================================================
// PUBLIC ROUTES (Customer-facing Website)
// ============================================================================

app.get('/api/public/bootstrap', (_req, res) => {
  try {
    res.json(getPublicBootstrap());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load site data.' });
  }
});

app.post('/api/public/bookings', (req, res) => {
  try {
    const { customerName, phone, email, serviceId, serviceName, city, address, preferredDate, message } =
      req.body || {};

    if (!customerName || String(customerName).trim().length < 2) {
      res.status(400).json({ error: 'Please enter your full name.' });
      return;
    }
    if (!phone || !isValidPhone(String(phone))) {
      res.status(400).json({ error: 'Please enter a valid Pakistani phone or WhatsApp number (e.g. 03041241947).' });
      return;
    }
    if (!serviceName || String(serviceName).trim().length < 2) {
      res.status(400).json({ error: 'Please select a service.' });
      return;
    }
    if (!city || String(city).trim().length < 2) {
      res.status(400).json({ error: 'Please select or enter your city.' });
      return;
    }
    if (!address || String(address).trim().length < 5) {
      res.status(400).json({ error: 'Please provide your street or sector address.' });
      return;
    }
    if (!preferredDate || String(preferredDate).trim().length < 8) {
      res.status(400).json({ error: 'Please select a preferred appointment date.' });
      return;
    }

    const booking = createPublicBooking({
      customerName: String(customerName).trim().slice(0, 120),
      phone: String(phone).trim().slice(0, 30),
      email: email ? String(email).trim().slice(0, 120) : '',
      serviceId: serviceId ? Number(serviceId) : null,
      serviceName: String(serviceName).trim().slice(0, 120),
      city: String(city).trim().slice(0, 80),
      address: String(address).trim().slice(0, 300),
      preferredDate: String(preferredDate).trim().slice(0, 30),
      message: message ? String(message).trim().slice(0, 1000) : '',
    });

    res.status(201).json({
      bookingCode: booking.bookingCode,
      status: booking.status,
      serviceName: booking.serviceName,
      preferredDate: booking.preferredDate,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unable to submit booking.' });
  }
});

app.post('/api/public/inquiries', (req, res) => {
  try {
    const { customerName, phone, email, city, subject, message } = req.body || {};

    if (!customerName || String(customerName).trim().length < 2) {
      res.status(400).json({ error: 'Please enter your name.' });
      return;
    }
    if (!phone || !isValidPhone(String(phone))) {
      res.status(400).json({ error: 'Please enter a valid contact phone number.' });
      return;
    }
    if (!subject || String(subject).trim().length < 3) {
      res.status(400).json({ error: 'Please enter an inquiry subject.' });
      return;
    }
    if (!message || String(message).trim().length < 5) {
      res.status(400).json({ error: 'Please enter your message details.' });
      return;
    }

    const inquiry = createPublicInquiry({
      customerName: String(customerName).trim().slice(0, 120),
      phone: String(phone).trim().slice(0, 30),
      email: email ? String(email).trim().slice(0, 120) : '',
      city: city ? String(city).trim().slice(0, 80) : 'Khanewal',
      subject: String(subject).trim().slice(0, 160),
      message: String(message).trim().slice(0, 1500),
    });

    res.status(201).json({ id: inquiry.id, createdAt: inquiry.createdAt });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unable to submit inquiry.' });
  }
});

app.post('/api/public/testimonials', (req, res) => {
  try {
    const { customerName, roleOrCompany, city, serviceName, rating, reviewText } = req.body || {};
    if (!customerName || String(customerName).trim().length < 2) {
      res.status(400).json({ error: 'Please enter your name.' });
      return;
    }
    if (!reviewText || String(reviewText).trim().length < 10) {
      res.status(400).json({ error: 'Please write at least 10 characters in your review.' });
      return;
    }

    const review = createPublicReview({
      customerName: String(customerName).trim().slice(0, 100),
      roleOrCompany: roleOrCompany ? String(roleOrCompany).trim().slice(0, 120) : 'Verified Customer',
      city: city ? String(city).trim().slice(0, 80) : 'Khanewal',
      serviceName: serviceName ? String(serviceName).trim().slice(0, 100) : 'AC Repair',
      rating: Number(rating) || 5,
      reviewText: String(reviewText).trim().slice(0, 1000),
    });

    res.status(201).json({ id: review.id, status: review.status });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unable to submit review.' });
  }
});

// ============================================================================
// AUTHENTICATION ROUTES
// ============================================================================

app.post('/api/auth/login', (req, res) => {
  try {
    const { identifier, password } = req.body || {};
    if (!identifier || !password) {
      res.status(400).json({ error: 'Username/email and password are required.' });
      return;
    }

    const cleanId = String(identifier).trim().toLowerCase();
    const userRow = db
      .prepare('SELECT * FROM admin_users WHERE lower(username) = ? OR lower(email) = ?')
      .get(cleanId, cleanId) as Record<string, unknown> | undefined;

    if (!userRow || !verifyPassword(String(password), String(userRow.password_hash))) {
      res.status(401).json({ error: 'Invalid administrator credentials.' });
      return;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);

    db.prepare('INSERT INTO admin_sessions (token, admin_id, expires_at) VALUES (?, ?, ?)').run(
      rawToken,
      Number(userRow.id),
      expiresAt
    );

    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.cookie(SESSION_COOKIE, signToken(rawToken), {
      httpOnly: true,
      sameSite: isHttps ? 'none' : 'lax',
      secure: isHttps,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      user: getAdminUserById(Number(userRow.id)),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Login failed.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const rawToken = verifySignedToken(req.cookies?.[SESSION_COOKIE]);
  if (rawToken) {
    db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(rawToken);
  }
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAdmin, (req: AuthedRequest, res) => {
  const user = getAdminUserById(req.adminId!);
  if (!user) {
    res.status(401).json({ error: 'Administrator account not found.' });
    return;
  }
  res.json({ user });
});

app.post('/api/auth/change-password', requireAdmin, (req: AuthedRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current password and new password are required.' });
      return;
    }
    if (String(newPassword).length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters long.' });
      return;
    }

    const userRow = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.adminId!) as
      | Record<string, unknown>
      | undefined;
    if (!userRow || !verifyPassword(String(currentPassword), String(userRow.password_hash))) {
      res.status(403).json({ error: 'Current password is incorrect.' });
      return;
    }

    const newHash = hashPassword(String(newPassword));
    db.prepare("UPDATE admin_users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(
      newHash,
      req.adminId!
    );

    const currentToken = verifySignedToken(req.cookies?.[SESSION_COOKIE]);
    if (currentToken) {
      db.prepare('DELETE FROM admin_sessions WHERE admin_id = ? AND token != ?').run(req.adminId!, currentToken);
    }

    res.json({ ok: true, message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unable to update password.' });
  }
});

app.put('/api/auth/profile', requireAdmin, (req: AuthedRequest, res) => {
  try {
    const { fullName, email, username, role } = req.body || {};
    if (!fullName || !email || !username) {
      res.status(400).json({ error: 'Full name, email, and username are required.' });
      return;
    }
    db.prepare(
      `UPDATE admin_users
       SET full_name = ?, email = ?, username = ?, role = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      String(fullName).trim(),
      String(email).trim(),
      String(username).trim(),
      role ? String(role).trim() : 'Owner & Lead Engineer',
      req.adminId!
    );
    res.json({ user: getAdminUserById(req.adminId!) });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update profile.' });
  }
});

// ============================================================================
// PROTECTED ADMIN ROUTES
// ============================================================================

app.get('/api/admin/dashboard', requireAdmin, (_req, res) => {
  res.json(getDashboardStats());
});

app.get('/api/admin/reports', requireAdmin, (_req, res) => {
  res.json(getReportsData());
});

app.get('/api/admin/notifications', requireAdmin, (_req, res) => {
  res.json({ notifications: getAdminNotifications() });
});

app.post('/api/admin/notifications/read-all', requireAdmin, (_req, res) => {
  db.prepare('UPDATE admin_notifications SET is_read = 1 WHERE is_read = 0').run();
  res.json({ ok: true });
});

app.patch('/api/admin/notifications/:id/read', requireAdmin, (req, res) => {
  db.prepare('UPDATE admin_notifications SET is_read = 1 WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Bookings Management
app.get('/api/admin/bookings', requireAdmin, (_req, res) => {
  res.json({ bookings: getAllAdminBookings() });
});

app.patch('/api/admin/bookings/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { status, internalNotes, isRead } = req.body || {};
  const existing = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Booking not found.' });
    return;
  }

  const allowedStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
  const nextStatus = status && allowedStatuses.includes(status) ? status : existing.status;
  const nextNotes = internalNotes !== undefined ? String(internalNotes) : existing.internal_notes;
  const nextRead = isRead !== undefined ? (isRead ? 1 : 0) : existing.is_read;

  db.prepare(
    `UPDATE bookings SET status = ?, internal_notes = ?, is_read = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(nextStatus, nextNotes, nextRead, id);

  const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id) as Record<string, unknown>;
  res.json({
    booking: {
      id: Number(updated.id),
      bookingCode: String(updated.booking_code),
      customerId: Number(updated.customer_id),
      customerName: String(updated.customer_name),
      phone: String(updated.phone),
      serviceId: updated.service_id ? Number(updated.service_id) : null,
      serviceName: String(updated.service_name),
      city: String(updated.city),
      address: String(updated.address),
      preferredDate: String(updated.preferred_date),
      message: String(updated.message),
      status: String(updated.status),
      internalNotes: String(updated.internal_notes),
      isRead: Boolean(updated.is_read),
      createdAt: String(updated.created_at),
      updatedAt: String(updated.updated_at),
    },
  });
});

app.delete('/api/admin/bookings/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM bookings WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// Customers Management
app.get('/api/admin/customers', requireAdmin, (_req, res) => {
  res.json({ customers: getAllAdminCustomers() });
});

app.get('/api/admin/customers/:id/bookings', requireAdmin, (req, res) => {
  res.json({ bookings: getCustomerBookings(Number(req.params.id)) });
});

app.patch('/api/admin/customers/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { fullName, phone, email, city, address, notes } = req.body || {};
  const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Customer not found.' });
    return;
  }
  db.prepare(
    `UPDATE customers
     SET full_name = ?, phone = ?, email = ?, city = ?, address = ?, notes = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    fullName ?? existing.full_name,
    phone ?? existing.phone,
    email ?? existing.email,
    city ?? existing.city,
    address ?? existing.address,
    notes ?? existing.notes,
    id
  );
  res.json({ customers: getAllAdminCustomers() });
});

// Services Management
app.get('/api/admin/services', requireAdmin, (_req, res) => {
  res.json({ services: getAllAdminServices() });
});

app.post('/api/admin/services', requireAdmin, (req, res) => {
  const { title, slug, shortDescription, fullDescription, features, priceRange, responseWindow, imageUrl, isActive, sortOrder } =
    req.body || {};
  if (!title || !shortDescription) {
    res.status(400).json({ error: 'Service title and short description are required.' });
    return;
  }
  const finalSlug = slug ? slugify(String(slug)) : slugify(String(title));
  db.prepare(
    `INSERT INTO services (slug, title, short_description, full_description, features_json, price_range, response_window, image_url, is_active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    finalSlug,
    String(title).trim(),
    String(shortDescription).trim(),
    String(fullDescription || shortDescription).trim(),
    JSON.stringify(Array.isArray(features) ? features : []),
    String(priceRange || 'Quote on Inspection').trim(),
    String(responseWindow || 'Same-Day Dispatch').trim(),
    String(imageUrl || '/src/assets/images/service_ac_systems_1794822111871.jpg').trim(),
    isActive === false ? 0 : 1,
    Number(sortOrder || 10)
  );
  res.status(201).json({ services: getAllAdminServices() });
});

app.put('/api/admin/services/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { title, slug, shortDescription, fullDescription, features, priceRange, responseWindow, imageUrl, isActive, sortOrder } =
    req.body || {};
  const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Service not found.' });
    return;
  }
  db.prepare(
    `UPDATE services
     SET slug = ?, title = ?, short_description = ?, full_description = ?, features_json = ?, price_range = ?, response_window = ?, image_url = ?, is_active = ?, sort_order = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    slug ? slugify(String(slug)) : existing.slug,
    title !== undefined ? String(title).trim() : existing.title,
    shortDescription !== undefined ? String(shortDescription).trim() : existing.short_description,
    fullDescription !== undefined ? String(fullDescription).trim() : existing.full_description,
    features !== undefined ? JSON.stringify(Array.isArray(features) ? features : []) : existing.features_json,
    priceRange !== undefined ? String(priceRange).trim() : existing.price_range,
    responseWindow !== undefined ? String(responseWindow).trim() : existing.response_window,
    imageUrl !== undefined ? String(imageUrl).trim() : existing.image_url,
    isActive !== undefined ? (isActive ? 1 : 0) : existing.is_active,
    sortOrder !== undefined ? Number(sortOrder) : existing.sort_order,
    id
  );
  res.json({ services: getAllAdminServices() });
});

app.delete('/api/admin/services/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM services WHERE id = ?').run(Number(req.params.id));
  res.json({ services: getAllAdminServices() });
});

// Projects / Portfolio Management
app.get('/api/admin/projects', requireAdmin, (_req, res) => {
  res.json({ projects: getAllAdminProjects() });
});

app.post('/api/admin/projects', requireAdmin, (req, res) => {
  const { title, category, clientName, location, completionDate, summary, metrics, imageUrl, isPublished } =
    req.body || {};
  if (!title || !summary) {
    res.status(400).json({ error: 'Project title and summary are required.' });
    return;
  }
  db.prepare(
    `INSERT INTO projects (title, category, client_name, location, completion_date, summary, metrics, image_url, is_published)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    String(title).trim(),
    String(category || 'AC Installation').trim(),
    String(clientName || 'Commercial Client').trim(),
    String(location || 'Multan').trim(),
    String(completionDate || new Date().toISOString().slice(0, 10)),
    String(summary).trim(),
    String(metrics || '').trim(),
    String(imageUrl || '/src/assets/images/project_multan_commercial_1794822111869.jpg').trim(),
    isPublished === false ? 0 : 1
  );
  res.status(201).json({ projects: getAllAdminProjects() });
});

app.put('/api/admin/projects/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { title, category, clientName, location, completionDate, summary, metrics, imageUrl, isPublished } =
    req.body || {};
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }
  db.prepare(
    `UPDATE projects
     SET title = ?, category = ?, client_name = ?, location = ?, completion_date = ?, summary = ?, metrics = ?, image_url = ?, is_published = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    title ?? existing.title,
    category ?? existing.category,
    clientName ?? existing.client_name,
    location ?? existing.location,
    completionDate ?? existing.completion_date,
    summary ?? existing.summary,
    metrics ?? existing.metrics,
    imageUrl ?? existing.image_url,
    isPublished !== undefined ? (isPublished ? 1 : 0) : existing.is_published,
    id
  );
  res.json({ projects: getAllAdminProjects() });
});

app.delete('/api/admin/projects/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM projects WHERE id = ?').run(Number(req.params.id));
  res.json({ projects: getAllAdminProjects() });
});

// Maintenance Plans Management
app.get('/api/admin/plans', requireAdmin, (_req, res) => {
  res.json({ plans: getAllAdminPlans() });
});

app.post('/api/admin/plans', requireAdmin, (req, res) => {
  const { name, targetAudience, billingCycle, pricePkr, description, features, isPublished, sortOrder } =
    req.body || {};
  if (!name || pricePkr === undefined) {
    res.status(400).json({ error: 'Plan name and price are required.' });
    return;
  }
  db.prepare(
    `INSERT INTO maintenance_plans (name, target_audience, billing_cycle, price_pkr, description, features_json, is_published, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    String(name).trim(),
    String(targetAudience || '').trim(),
    String(billingCycle || 'Annual').trim(),
    Number(pricePkr) || 0,
    String(description || '').trim(),
    JSON.stringify(Array.isArray(features) ? features : []),
    isPublished === false ? 0 : 1,
    Number(sortOrder || 10)
  );
  res.status(201).json({ plans: getAllAdminPlans() });
});

app.put('/api/admin/plans/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { name, targetAudience, billingCycle, pricePkr, description, features, isPublished, sortOrder } =
    req.body || {};
  const existing = db.prepare('SELECT * FROM maintenance_plans WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Plan not found.' });
    return;
  }
  db.prepare(
    `UPDATE maintenance_plans
     SET name = ?, target_audience = ?, billing_cycle = ?, price_pkr = ?, description = ?, features_json = ?, is_published = ?, sort_order = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    name ?? existing.name,
    targetAudience ?? existing.target_audience,
    billingCycle ?? existing.billing_cycle,
    pricePkr !== undefined ? Number(pricePkr) : existing.price_pkr,
    description ?? existing.description,
    features !== undefined ? JSON.stringify(Array.isArray(features) ? features : []) : existing.features_json,
    isPublished !== undefined ? (isPublished ? 1 : 0) : existing.is_published,
    sortOrder !== undefined ? Number(sortOrder) : existing.sort_order,
    id
  );
  res.json({ plans: getAllAdminPlans() });
});

app.delete('/api/admin/plans/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM maintenance_plans WHERE id = ?').run(Number(req.params.id));
  res.json({ plans: getAllAdminPlans() });
});

// FAQs Management
app.get('/api/admin/faqs', requireAdmin, (_req, res) => {
  res.json({ faqs: getAllAdminFaqs() });
});

app.post('/api/admin/faqs', requireAdmin, (req, res) => {
  const { question, answer, category, sortOrder, isPublished } = req.body || {};
  if (!question || !answer) {
    res.status(400).json({ error: 'Question and answer are required.' });
    return;
  }
  db.prepare(
    `INSERT INTO faqs (question, answer, category, sort_order, is_published)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    String(question).trim(),
    String(answer).trim(),
    String(category || 'General').trim(),
    Number(sortOrder || 10),
    isPublished === false ? 0 : 1
  );
  res.status(201).json({ faqs: getAllAdminFaqs() });
});

app.put('/api/admin/faqs/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { question, answer, category, sortOrder, isPublished } = req.body || {};
  const existing = db.prepare('SELECT * FROM faqs WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'FAQ not found.' });
    return;
  }
  db.prepare(
    `UPDATE faqs SET question = ?, answer = ?, category = ?, sort_order = ?, is_published = ? WHERE id = ?`
  ).run(
    question ?? existing.question,
    answer ?? existing.answer,
    category ?? existing.category,
    sortOrder !== undefined ? Number(sortOrder) : existing.sort_order,
    isPublished !== undefined ? (isPublished ? 1 : 0) : existing.is_published,
    id
  );
  res.json({ faqs: getAllAdminFaqs() });
});

app.delete('/api/admin/faqs/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM faqs WHERE id = ?').run(Number(req.params.id));
  res.json({ faqs: getAllAdminFaqs() });
});

// Testimonials Management
app.get('/api/admin/testimonials', requireAdmin, (_req, res) => {
  res.json({ testimonials: getAllAdminTestimonials() });
});

app.post('/api/admin/testimonials', requireAdmin, (req, res) => {
  const { customerName, roleOrCompany, city, serviceName, rating, reviewText, status } = req.body || {};
  if (!customerName || !reviewText) {
    res.status(400).json({ error: 'Customer name and review text are required.' });
    return;
  }
  db.prepare(
    `INSERT INTO testimonials (customer_name, role_or_company, city, service_name, rating, review_text, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    String(customerName).trim(),
    String(roleOrCompany || 'Verified Customer').trim(),
    String(city || 'Khanewal').trim(),
    String(serviceName || 'AC Repair').trim(),
    Math.min(5, Math.max(1, Number(rating) || 5)),
    String(reviewText).trim(),
    status || 'approved'
  );
  res.status(201).json({ testimonials: getAllAdminTestimonials() });
});

app.put('/api/admin/testimonials/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { customerName, roleOrCompany, city, serviceName, rating, reviewText, status } = req.body || {};
  const existing = db.prepare('SELECT * FROM testimonials WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Review not found.' });
    return;
  }
  db.prepare(
    `UPDATE testimonials
     SET customer_name = ?, role_or_company = ?, city = ?, service_name = ?, rating = ?, review_text = ?, status = ?
     WHERE id = ?`
  ).run(
    customerName ?? existing.customer_name,
    roleOrCompany ?? existing.role_or_company,
    city ?? existing.city,
    serviceName ?? existing.service_name,
    rating !== undefined ? Number(rating) : existing.rating,
    reviewText ?? existing.review_text,
    status ?? existing.status,
    id
  );
  res.json({ testimonials: getAllAdminTestimonials() });
});

app.delete('/api/admin/testimonials/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM testimonials WHERE id = ?').run(Number(req.params.id));
  res.json({ testimonials: getAllAdminTestimonials() });
});

// Website Content & Settings Management
app.get('/api/admin/settings', requireAdmin, (_req, res) => {
  res.json({ settings: getSiteSettings() });
});

app.put('/api/admin/settings', requireAdmin, (req, res) => {
  try {
    const updated = updateSiteSettings(req.body || {});
    res.json({ settings: updated });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to save settings.' });
  }
});

// Contact Inquiries Management
app.get('/api/admin/inquiries', requireAdmin, (_req, res) => {
  res.json({ inquiries: getAllAdminInquiries() });
});

app.patch('/api/admin/inquiries/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { isRead, adminReply } = req.body || {};
  const existing = db.prepare('SELECT * FROM inquiries WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Inquiry not found.' });
    return;
  }
  const nextRead = isRead !== undefined ? (isRead ? 1 : 0) : existing.is_read;
  const nextReply = adminReply !== undefined ? String(adminReply) : String(existing.admin_reply);
  const repliedAt =
    adminReply !== undefined && String(adminReply).trim().length > 0
      ? new Date().toISOString().replace('T', ' ').slice(0, 19)
      : existing.replied_at;

  db.prepare('UPDATE inquiries SET is_read = ?, admin_reply = ?, replied_at = ? WHERE id = ?').run(
    adminReply !== undefined && String(adminReply).trim().length > 0 ? 1 : nextRead,
    nextReply,
    repliedAt,
    id
  );
  res.json({ inquiries: getAllAdminInquiries() });
});

app.delete('/api/admin/inquiries/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM inquiries WHERE id = ?').run(Number(req.params.id));
  res.json({ inquiries: getAllAdminInquiries() });
});

// Blog Posts Management
app.get('/api/admin/blog', requireAdmin, (_req, res) => {
  res.json({ blogPosts: getAllAdminBlogPosts() });
});

app.post('/api/admin/blog', requireAdmin, (req, res) => {
  const { title, slug, category, excerpt, content, author, readTime, imageUrl, isPublished, publishedAt } =
    req.body || {};
  if (!title || !content) {
    res.status(400).json({ error: 'Article title and content are required.' });
    return;
  }
  const finalSlug = slug ? slugify(String(slug)) : slugify(String(title));
  db.prepare(
    `INSERT INTO blog_posts (slug, title, category, excerpt, content, author, read_time, image_url, is_published, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    finalSlug,
    String(title).trim(),
    String(category || 'HVACR Guide').trim(),
    String(excerpt || String(content).slice(0, 160)).trim(),
    String(content).trim(),
    String(author || 'Engr. Mujahid Hussain').trim(),
    String(readTime || '4 min read').trim(),
    String(imageUrl || '/src/assets/images/gallery_inverter_pcb_1794823621561.jpg').trim(),
    isPublished === false ? 0 : 1,
    String(publishedAt || new Date().toISOString().slice(0, 10))
  );
  res.status(201).json({ blogPosts: getAllAdminBlogPosts() });
});

app.put('/api/admin/blog/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { title, slug, category, excerpt, content, author, readTime, imageUrl, isPublished, publishedAt } =
    req.body || {};
  const existing = db.prepare('SELECT * FROM blog_posts WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Article not found.' });
    return;
  }
  db.prepare(
    `UPDATE blog_posts
     SET slug = ?, title = ?, category = ?, excerpt = ?, content = ?, author = ?, read_time = ?, image_url = ?, is_published = ?, published_at = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    slug ? slugify(String(slug)) : existing.slug,
    title ?? existing.title,
    category ?? existing.category,
    excerpt ?? existing.excerpt,
    content ?? existing.content,
    author ?? existing.author,
    readTime ?? existing.read_time,
    imageUrl ?? existing.image_url,
    isPublished !== undefined ? (isPublished ? 1 : 0) : existing.is_published,
    publishedAt ?? existing.published_at,
    id
  );
  res.json({ blogPosts: getAllAdminBlogPosts() });
});

app.delete('/api/admin/blog/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM blog_posts WHERE id = ?').run(Number(req.params.id));
  res.json({ blogPosts: getAllAdminBlogPosts() });
});

// Gallery Items Management
app.get('/api/admin/gallery', requireAdmin, (_req, res) => {
  res.json({ galleryItems: getAllAdminGalleryItems() });
});

app.post('/api/admin/gallery', requireAdmin, (req, res) => {
  const { title, category, location, caption, imageUrl, isPublished, sortOrder } = req.body || {};
  if (!title || !imageUrl) {
    res.status(400).json({ error: 'Title and image URL are required.' });
    return;
  }
  db.prepare(
    `INSERT INTO gallery_items (title, category, location, caption, image_url, is_published, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    String(title).trim(),
    String(category || 'AC Installation').trim(),
    String(location || 'Multan').trim(),
    String(caption || '').trim(),
    String(imageUrl).trim(),
    isPublished === false ? 0 : 1,
    Number(sortOrder || 10)
  );
  res.status(201).json({ galleryItems: getAllAdminGalleryItems() });
});

app.put('/api/admin/gallery/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { title, category, location, caption, imageUrl, isPublished, sortOrder } = req.body || {};
  const existing = db.prepare('SELECT * FROM gallery_items WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Gallery item not found.' });
    return;
  }
  db.prepare(
    `UPDATE gallery_items
     SET title = ?, category = ?, location = ?, caption = ?, image_url = ?, is_published = ?, sort_order = ?
     WHERE id = ?`
  ).run(
    title ?? existing.title,
    category ?? existing.category,
    location ?? existing.location,
    caption ?? existing.caption,
    imageUrl ?? existing.image_url,
    isPublished !== undefined ? (isPublished ? 1 : 0) : existing.is_published,
    sortOrder !== undefined ? Number(sortOrder) : existing.sort_order,
    id
  );
  res.json({ galleryItems: getAllAdminGalleryItems() });
});

app.delete('/api/admin/gallery/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM gallery_items WHERE id = ?').run(Number(req.params.id));
  res.json({ galleryItems: getAllAdminGalleryItems() });
});

// Products Catalog Management
app.get('/api/admin/products', requireAdmin, (_req, res) => {
  res.json({ products: getAllAdminProducts() });
});

app.post('/api/admin/products', requireAdmin, (req, res) => {
  const { name, category, brand, capacityOrSpec, pricePkr, stockStatus, summary, specs, imageUrl, isPublished, sortOrder } =
    req.body || {};
  if (!name || !pricePkr) {
    res.status(400).json({ error: 'Product name and price are required.' });
    return;
  }
  db.prepare(
    `INSERT INTO products (name, category, brand, capacity_or_spec, price_pkr, stock_status, summary, specs_json, image_url, is_published, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    String(name).trim(),
    String(category || 'Inverter Air Conditioners').trim(),
    String(brand || 'OEM Certified').trim(),
    String(capacityOrSpec || '').trim(),
    String(pricePkr).trim(),
    String(stockStatus || 'In Stock').trim(),
    String(summary || '').trim(),
    JSON.stringify(Array.isArray(specs) ? specs : []),
    String(imageUrl || '/src/assets/images/product_hvac_hardware_1794825552921.jpg').trim(),
    isPublished === false ? 0 : 1,
    Number(sortOrder || 10)
  );
  res.status(201).json({ products: getAllAdminProducts() });
});

app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { name, category, brand, capacityOrSpec, pricePkr, stockStatus, summary, specs, imageUrl, isPublished, sortOrder } =
    req.body || {};
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }
  db.prepare(
    `UPDATE products
     SET name = ?, category = ?, brand = ?, capacity_or_spec = ?, price_pkr = ?, stock_status = ?, summary = ?, specs_json = ?, image_url = ?, is_published = ?, sort_order = ?
     WHERE id = ?`
  ).run(
    name ?? existing.name,
    category ?? existing.category,
    brand ?? existing.brand,
    capacityOrSpec ?? existing.capacity_or_spec,
    pricePkr ?? existing.price_pkr,
    stockStatus ?? existing.stock_status,
    summary ?? existing.summary,
    specs !== undefined ? JSON.stringify(Array.isArray(specs) ? specs : []) : existing.specs_json,
    imageUrl ?? existing.image_url,
    isPublished !== undefined ? (isPublished ? 1 : 0) : existing.is_published,
    sortOrder !== undefined ? Number(sortOrder) : existing.sort_order,
    id
  );
  res.json({ products: getAllAdminProducts() });
});

app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(Number(req.params.id));
  res.json({ products: getAllAdminProducts() });
});

// Image Upload Endpoint (Stores uploaded image locally in /uploads)
app.post('/api/admin/upload', requireAdmin, (req, res) => {
  try {
    const { dataUrl, fileName } = req.body || {};
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      res.status(400).json({ error: 'Invalid image payload.' });
      return;
    }
    const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i);
    if (!match) {
      res.status(400).json({ error: 'Only PNG, JPG, and WEBP images are supported.' });
      return;
    }
    const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 5 * 1024 * 1024) {
      res.status(400).json({ error: 'Image size must be 5MB or smaller.' });
      return;
    }
    const baseName = fileName ? slugify(path.parse(String(fileName)).name).slice(0, 32) : 'asset';
    const finalName = `${baseName || 'asset'}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, finalName), buffer);
    res.json({ url: `/uploads/${finalName}` });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Upload failed.' });
  }
});

// Database Backup & Recovery
app.get('/api/admin/backup/json', requireAdmin, (_req, res) => {
  const snapshot = exportFullJsonBackup();
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="mujahid-services-backup-${stamp}.json"`);
  res.send(JSON.stringify(snapshot, null, 2));
});

app.get('/api/admin/backup/sqlite', requireAdmin, async (_req, res) => {
  const tempFile = path.join('/tmp', `mujahid-backup-${Date.now()}.db`);
  try {
    await db.backup(tempFile);
    const stamp = new Date().toISOString().slice(0, 10);
    res.download(tempFile, `mujahid-services-${stamp}.db`, () => {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    });
  } catch (err) {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
    res.status(500).json({ error: err instanceof Error ? err.message : 'SQLite backup failed.' });
  }
});

app.post('/api/admin/restore/json', requireAdmin, (req, res) => {
  try {
    const result = restoreFromJsonBackup(req.body);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Restore failed.' });
  }
});

// ============================================================================
// VITE DEV MIDDLEWARE / PRODUCTION STATIC HOSTING
// ============================================================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    const indexHtml = path.join(distDir, 'index.html');
    if (fs.existsSync(indexHtml)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(indexHtml);
      });
    } else {
      app.get('/', (_req, res) => {
        res.json({ ok: true, service: 'Mujahid Services Backend API', health: '/api/health' });
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Mujahid Services server listening on http://localhost:${PORT}`);
  });
}

startServer();
