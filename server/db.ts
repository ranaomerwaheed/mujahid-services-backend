import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  AdminNotification,
  AdminUser,
  BlogPost,
  BookingRecord,
  BookingStatus,
  ContactInquiry,
  CustomerRecord,
  DashboardStats,
  FaqItem,
  GalleryItem,
  MaintenancePlan,
  ProductItem,
  ProjectItem,
  PublicBootstrapData,
  ReportsPayload,
  ReviewStatus,
  ServiceItem,
  SiteSettings,
  Testimonial,
} from '../src/types/index.ts';
import { ALL_SERVICE_AREAS } from '../src/data/famousAreas.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
export const DB_PATH = path.join(DATA_DIR, 'mujahid.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Administrator',
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY,
      admin_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      short_description TEXT NOT NULL,
      full_description TEXT NOT NULL,
      features_json TEXT NOT NULL DEFAULT '[]',
      price_range TEXT NOT NULL,
      response_window TEXT NOT NULL DEFAULT 'Same-Day Dispatch',
      image_url TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      client_name TEXT NOT NULL,
      location TEXT NOT NULL,
      completion_date TEXT NOT NULL,
      summary TEXT NOT NULL,
      metrics TEXT NOT NULL,
      image_url TEXT NOT NULL,
      is_published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS maintenance_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      target_audience TEXT NOT NULL,
      billing_cycle TEXT NOT NULL,
      price_pkr INTEGER NOT NULL,
      description TEXT NOT NULL,
      features_json TEXT NOT NULL DEFAULT '[]',
      is_published INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS faqs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'General',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_published INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS testimonials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      role_or_company TEXT NOT NULL,
      city TEXT NOT NULL,
      service_name TEXT NOT NULL,
      rating INTEGER NOT NULL DEFAULT 5,
      review_text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL,
      address TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_code TEXT NOT NULL UNIQUE,
      customer_id INTEGER NOT NULL,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      service_id INTEGER,
      service_name TEXT NOT NULL,
      city TEXT NOT NULL,
      address TEXT NOT NULL,
      preferred_date TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      internal_notes TEXT NOT NULL DEFAULT '',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT 'Khanewal',
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      admin_reply TEXT NOT NULL DEFAULT '',
      replied_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admin_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      reference_id INTEGER NOT NULL DEFAULT 0,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS blog_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      excerpt TEXT NOT NULL,
      content TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT 'Mujahid Engineering Desk',
      read_time TEXT NOT NULL DEFAULT '4 min read',
      image_url TEXT NOT NULL,
      is_published INTEGER NOT NULL DEFAULT 1,
      published_at TEXT NOT NULL DEFAULT (date('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS gallery_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      location TEXT NOT NULL,
      caption TEXT NOT NULL,
      image_url TEXT NOT NULL,
      is_published INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      brand TEXT NOT NULL,
      capacity_or_spec TEXT NOT NULL,
      price_pkr TEXT NOT NULL,
      stock_status TEXT NOT NULL DEFAULT 'In Stock',
      summary TEXT NOT NULL,
      specs_json TEXT NOT NULL DEFAULT '[]',
      image_url TEXT NOT NULL,
      is_published INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  seedInitialData();
}

const DEFAULT_SETTINGS: SiteSettings = {
  companyName: 'Mujahid Services',
  tagline: 'Precision HVACR Engineering & Commercial Climate Control',
  heroTitle: 'Certified HVACR Installation, Repair & Cold-Chain Engineering',
  heroSubtitle:
    'Trusted across Khanewal and Multan for residential inverter air conditioning, VRF commercial systems, preventative maintenance contracts, and 24/7 refrigeration diagnostics.',
  heroPrimaryCta: 'Book Technician Visit',
  heroBannerImage: '/src/assets/images/hero_hvacr_engineering_1794822109469.jpg',
  aboutBannerImage: '/src/assets/images/about_workshop_team_1794822112940.jpg',
  servicesBannerImage: '/src/assets/images/service_ac_systems_1794822111871.jpg',
  projectsBannerImage: '/src/assets/images/project_multan_commercial_1794822111869.jpg',
  phone: '03041241947',
  whatsapp: '03041241947',
  email: 'info@mujahidservices.pk',
  address: 'Main Multan Road, Khanewal & Bosan Road, Multan, Punjab, Pakistan',
  workingHours: 'Monday – Saturday: 8:00 AM – 9:00 PM · 24/7 Emergency Cold-Room Support',
  serviceAreas: ALL_SERVICE_AREAS,
  aboutTitle: 'Engineering Reliability Across Southern Punjab Since 2014',
  aboutDescription:
    'Mujahid Services operates dedicated field engineering teams and calibrated diagnostic workshops serving homes, medical facilities, cold storage warehouses, and commercial plazas across Khanewal and Multan.',
  aboutMission:
    'To eliminate recurring compressor failures and high energy waste through nitrogen pressure testing, vacuum-verified commissioning, and transparent preventative maintenance.',
  yearsExperience: '12+ Years Field Experience',
  projectsCompletedLabel: '3,800+ Systems Commissioned',
  responseTimeLabel: 'Under 90-Minute Local Dispatch',
  whyChooseUsTitle: 'Why Homes & Commercial Facilities Trust Mujahid Services',
  whyChooseUsSubtitle:
    'Every technician follows factory vacuum, nitrogen leak-testing, and digital superheat verification protocols.',
  whyChooseUsItems: [
    {
      id: 'nitrogen-test',
      title: 'Nitrogen Leak & Micron Vacuum Standard',
      metric: '500 Microns',
      description:
        'We never top up refrigerant blindly. Every installation and leak repair is pressure-tested with dry nitrogen and pulled below 500 microns before charging by digital scale.',
    },
    {
      id: 'genuine-parts',
      title: 'OEM Compressors & Inverter Boards',
      metric: '100% Genuine',
      description:
        'Direct sourcing of genuine R-410A, R-32, and R-404A components, Emerson and Danfoss controls, and pure heavy-gauge copper piping.',
    },
    {
      id: 'rapid-dispatch',
      title: 'Dedicated Khanewal & Multan Fleet',
      metric: '< 90 Min',
      description:
        'Mobile service vans stationed in both Khanewal and Multan carry digital manifold gauges, recovery units, and common PCB/capacitor spares for first-visit resolution.',
    },
    {
      id: 'written-warranty',
      title: '90-Day Service & Workmanship Guarantee',
      metric: '90 Days',
      description:
        'All repairs, installations, and cold-room retrofits include documented pressure/amp readings and a 90-day workmanship warranty.',
    },
  ],
};

function seedInitialData(): void {
  const adminCount = (db.prepare('SELECT COUNT(*) as cnt FROM admin_users').get() as { cnt: number }).cnt;
  if (adminCount === 0) {
    const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || 'Mujahid@2026';
    db.prepare(
      `INSERT INTO admin_users (username, email, full_name, role, password_hash)
       VALUES (?, ?, ?, ?, ?)`
    ).run('admin', 'admin@mujahidservices.pk', 'Mujahid Hussain', 'Owner & Lead Engineer', hashPassword(initialPassword));
  }

  const settingsCount = (db.prepare('SELECT COUNT(*) as cnt FROM site_settings').get() as { cnt: number }).cnt;
  if (settingsCount === 0) {
    db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?)').run(
      'main',
      JSON.stringify(DEFAULT_SETTINGS)
    );
  }

  const serviceCount = (db.prepare('SELECT COUNT(*) as cnt FROM services').get() as { cnt: number }).cnt;
  if (serviceCount === 0) {
    const insertService = db.prepare(`
      INSERT INTO services (slug, title, short_description, full_description, features_json, price_range, response_window, image_url, is_active, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const seedServices = [
      {
        slug: 'ac-repair',
        title: 'AC Repair',
        shortDescription:
          'Component-level inverter PCB diagnostics, refrigerant leak tracing, compressor replacement, and airflow balancing for split, floor-standing, and cassette units.',
        fullDescription:
          'Extreme summer ambient temperatures above 46°C in Khanewal and Multan push inverter and non-inverter air conditioners to thermal limits. Our field engineers diagnose E-code inverter faults, measure static pressures, repair copper flare and condenser leaks using oxygen-free nitrogen brazing, and restore peak cooling efficiency on the first visit.',
        features: [
          'Digital manifold & superheat/subcooling diagnostics',
          'Inverter PCB, IPM module, and sensor troubleshooting',
          'Nitrogen pressure leak testing & pure copper flare repair',
          'High-pressure chemical coil & blower wheel deep cleaning',
          'Exact refrigerant charging by digital weight scale (R-32, R-410A, R-22)',
        ],
        priceRange: 'PKR 2,000 – 8,500',
        responseWindow: 'Same-Day Dispatch',
        imageUrl: '/src/assets/images/service_ac_systems_1794822111871.jpg',
        sortOrder: 1,
      },
      {
        slug: 'ac-installation',
        title: 'AC Installation',
        shortDescription:
          'Precision split, multi-split, and VRF installation with heavy-gauge copper piping, Armaflex insulation, drainage slope testing, and vacuum commissioning.',
        fullDescription:
          'Over 70% of premature compressor burnouts originate from rushed installation without vacuuming. Mujahid Services installs residential inverter ACs and commercial VRF/cassette units to manufacturer specification—using laser-leveled wall brackets, insulated 22-gauge copper lines, dedicated breaker sizing, and a mandatory 500-micron vacuum pull before refrigerant release.',
        features: [
          'Zero-moisture 500-micron deep vacuum commissioning',
          'Heavy-gauge copper piping with closed-cell thermal insulation',
          'Anti-vibration outdoor mounting brackets & condensate drain testing',
          'Pre-construction concealed copper piping for homes & plazas',
          'Post-install amp draw, delta-T airflow, and voltage verification',
        ],
        priceRange: 'PKR 4,500 – 14,000',
        responseWindow: 'Scheduled Same/Next Day',
        imageUrl: '/src/assets/images/hero_hvacr_engineering_1794822109469.jpg',
        sortOrder: 2,
      },
      {
        slug: 'fridge-repair',
        title: 'Fridge Repair',
        shortDescription:
          'Fast domestic and commercial refrigerator, deep freezer, and display chiller repair covering thermostats, relays, defrost heaters, and compressor swaps.',
        fullDescription:
          'Whether a home inverter refrigerator stops cooling in the lower cabinet or a pharmacy/retail deep freezer loses sub-zero hold, our appliance specialists carry calibrated gauges, R-134a/R-600a precision scales, digital thermostats, and OEM compressors to protect food and inventory.',
        features: [
          'Inverter & conventional refrigerator compressor replacement',
          'Defrost timer, bi-metal thermostat, and fan motor repair',
          'Capillary tube flushing & filter drier replacement',
          'Door gasket sealing & magnetic alignment',
          'Safe R-600a & R-134a vacuum and charge calibration',
        ],
        priceRange: 'PKR 1,800 – 12,000',
        responseWindow: 'Within 2 Hours (Urgent)',
        imageUrl: '/src/assets/images/about_workshop_team_1794822112940.jpg',
        sortOrder: 3,
      },
      {
        slug: 'hvac-maintenance',
        title: 'HVAC Maintenance',
        shortDescription:
          'Scheduled preventative servicing for offices, clinics, banks, and multi-unit residences—cutting electricity bills and preventing peak-summer breakdowns.',
        fullDescription:
          'Preventative HVAC maintenance preserves seasonal Energy Efficiency Ratio (EER) and catches failing contactors, clogged fin coils, and low airflow before peak heatwaves hit. We deliver structured quarterly and bi-annual inspection logs with amp-draw records for every indoor and outdoor unit.',
        features: [
          'Condenser & evaporator chemical descaling wash',
          'Electrical terminal torque check & capacitor capacitance testing',
          'Air handler belt tension, bearing lubrication & filter replacement',
          'Thermostat calibration & BMS/zone damper verification',
          'Signed unit-by-unit health inspection report',
        ],
        priceRange: 'PKR 2,500 / unit onwards',
        responseWindow: 'Planned SLA Schedule',
        imageUrl: '/src/assets/images/project_multan_commercial_1794822111869.jpg',
        sortOrder: 4,
      },
      {
        slug: 'commercial-refrigeration',
        title: 'Commercial Refrigeration',
        shortDescription:
          'Design, commissioning, and 24/7 emergency breakdown recovery for walk-in cold rooms, dairy chillers, meat freezers, and industrial blast chillers.',
        fullDescription:
          'Cold-chain downtime costs inventory within hours. Mujahid Services builds, retrofits, and maintains commercial walk-in chillers, freezer rooms (-18°C to -25°C), supermarket display racks, and agricultural storage plants across Multan and Khanewal with Bitzer/Copeland compressors and Dixell/Danfoss digital controllers.',
        features: [
          'Walk-in cold room & blast freezer design and PUF panel installation',
          'Semi-hermetic compressor overhauls & rack balancing',
          'TXV expansion valve tuning & hot-gas defrost calibration',
          'Digital temperature alarms & phase-failure protection relays',
          '24/7 emergency standby service for cold storage facilities',
        ],
        priceRange: 'Custom Quote / AMC',
        responseWindow: '24/7 Priority Emergency',
        imageUrl: '/src/assets/images/service_refrigeration_coldroom_1794822111312.jpg',
        sortOrder: 5,
      },
    ];

    for (const s of seedServices) {
      insertService.run(
        s.slug,
        s.title,
        s.shortDescription,
        s.fullDescription,
        JSON.stringify(s.features),
        s.priceRange,
        s.responseWindow,
        s.imageUrl,
        1,
        s.sortOrder
      );
    }
  }

  const projectCount = (db.prepare('SELECT COUNT(*) as cnt FROM projects').get() as { cnt: number }).cnt;
  if (projectCount === 0) {
    const insertProject = db.prepare(`
      INSERT INTO projects (title, category, client_name, location, completion_date, summary, metrics, image_url, is_published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);
    const seedProjects = [
      {
        title: '48-Ton VRF & Rooftop Ducting System',
        category: 'AC Installation',
        clientName: 'Al-Noor Medical & Diagnostic Complex',
        location: 'Bosan Road, Multan',
        completionDate: '2026-08-18',
        summary:
          'Engineered and commissioned a multi-zone inverter VRF climate plant with fresh-air heat recovery and insulated GI supply/return ductwork across three clinical floors.',
        metrics: '31% peak power reduction · 18 indoor zones balanced',
        imageUrl: '/src/assets/images/project_multan_commercial_1794822111869.jpg',
      },
      {
        title: 'Dual-Chamber -20°C Agri & Dairy Cold Storage',
        category: 'Commercial Refrigeration',
        clientName: 'Chenab Agro Cold Chain Pvt.',
        location: 'Industrial Estate, Khanewal',
        completionDate: '2026-06-29',
        summary:
          'Installed twin semi-hermetic compressor racks with automated defrost scheduling, stainless evaporators, and digital phase-loss alarm panels.',
        metrics: '120-ton storage capacity · ±0.6°C thermal stability',
        imageUrl: '/src/assets/images/service_refrigeration_coldroom_1794822111312.jpg',
      },
      {
        title: 'Corporate Plaza Concealed Copper & VRF Retrofit',
        category: 'HVAC Maintenance',
        clientName: 'Sadiq Commercial Center',
        location: 'Abdali Road, Multan',
        completionDate: '2026-05-12',
        summary:
          'Replaced corroded flare manifolds, nitrogen-flushed 420 meters of refrigerant piping, and established a quarterly preventative maintenance contract.',
        metrics: 'Zero downtime over 2026 summer peak · 24 units serviced',
        imageUrl: '/src/assets/images/hero_hvacr_engineering_1794822109469.jpg',
      },
      {
        title: 'Diagnostic Workshop & Inverter Calibration Bay',
        category: 'AC Repair',
        clientName: 'Mujahid Services Central Lab',
        location: 'Main Multan Road, Khanewal',
        completionDate: '2026-03-10',
        summary:
          'Equipped our primary bench facility with automated refrigerant recovery, digital micron gauges, and inverter PCB load-testing rigs.',
        metrics: '94% first-visit repair completion rate',
        imageUrl: '/src/assets/images/about_workshop_team_1794822112940.jpg',
      },
    ];
    for (const p of seedProjects) {
      insertProject.run(
        p.title,
        p.category,
        p.clientName,
        p.location,
        p.completionDate,
        p.summary,
        p.metrics,
        p.imageUrl
      );
    }
  }

  const planCount = (db.prepare('SELECT COUNT(*) as cnt FROM maintenance_plans').get() as { cnt: number }).cnt;
  if (planCount === 0) {
    const insertPlan = db.prepare(`
      INSERT INTO maintenance_plans (name, target_audience, billing_cycle, price_pkr, description, features_json, is_published, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `);
    const seedPlans = [
      {
        name: 'Residential Annual Care',
        targetAudience: 'For Homes & Villas (Up to 3 Split ACs + 1 Fridge)',
        billingCycle: 'Annual',
        pricePkr: 8500,
        description:
          'Complete pre-summer and post-monsoon chemical cleaning, pressure diagnostics, and priority breakdown support.',
        features: [
          '2 scheduled deep chemical washes per year for up to 3 ACs',
          '1 annual refrigerator condenser & gasket efficiency audit',
          'Free emergency inspection visits (labor included)',
          '15% discount on genuine spare parts & refrigerant top-ups',
        ],
        sortOrder: 1,
      },
      {
        name: 'Commercial Office & Clinic AMC',
        targetAudience: 'For Offices, Clinics & Retail Showrooms (4–15 Units)',
        billingCycle: 'Quarterly',
        pricePkr: 18000,
        description:
          'Structured quarterly preventative maintenance with documented electrical amp-draw logs and priority SLA dispatch.',
        features: [
          'Quarterly full-system coil wash, drain flush & amp testing',
          'Priority 4-hour breakdown response in Khanewal & Multan',
          'Thermostat calibration & airflow balance verification',
          'Dedicated quarterly equipment health & energy report',
        ],
        sortOrder: 2,
      },
      {
        name: 'Cold-Chain & Industrial SLA',
        targetAudience: 'For Cold Rooms, Pharmacies, Dairies & Supermarkets',
        billingCycle: 'Monthly',
        pricePkr: 14500,
        description:
          'Continuous preventative inspection and 24/7 emergency standby protection to eliminate stock loss.',
        features: [
          'Monthly compressor oil, superheat & defrost cycle audit',
          '24/7 emergency dispatch (< 90-minute target response)',
          'Digital controller & phase-protector calibration',
          'Standby compressor loaner & priority spare allocation',
        ],
        sortOrder: 3,
      },
    ];
    for (const pl of seedPlans) {
      insertPlan.run(
        pl.name,
        pl.targetAudience,
        pl.billingCycle,
        pl.pricePkr,
        pl.description,
        JSON.stringify(pl.features),
        pl.sortOrder
      );
    }
  }

  const faqCount = (db.prepare('SELECT COUNT(*) as cnt FROM faqs').get() as { cnt: number }).cnt;
  if (faqCount === 0) {
    const insertFaq = db.prepare(`
      INSERT INTO faqs (question, answer, category, sort_order, is_published)
      VALUES (?, ?, ?, ?, 1)
    `);
    const seedFaqs = [
      {
        question: 'Which areas do Mujahid Services technicians cover?',
        answer:
          'Our mobile service vans operate daily across Khanewal, Multan, Kabirwala, Mian Channu, Jahania, Vehari, Shujabad, and Lodhran. For commercial cold-room and VRF projects, we cover all surrounding districts in Southern Punjab.',
        category: 'Coverage',
        sortOrder: 1,
      },
      {
        question: 'Why do you perform nitrogen pressure testing and vacuuming during AC installation?',
        answer:
          'Air and moisture trapped inside copper refrigerant lines form acid when mixed with inverter compressor oil, burning out windings within 1–2 seasons. Pulling a verified 500-micron vacuum and testing flares with dry nitrogen ensures zero leaks and maximum cooling efficiency.',
        category: 'AC Installation',
        sortOrder: 2,
      },
      {
        question: 'Do you repair inverter AC circuit boards (PCBs) and E-error faults?',
        answer:
          'Yes. Our Khanewal workshop and field engineers diagnose communication errors, IPM failures, outdoor fan faults, and sensor drift across major inverter brands including Gree, Haier, Dawlance, Kenwood, Orient, and Mitsubishi.',
        category: 'AC Repair',
        sortOrder: 3,
      },
      {
        question: 'How quickly can you respond to a commercial cold room or chiller failure?',
        answer:
          'Commercial refrigeration emergencies receive 24/7 priority dispatch. Our nearest on-call technician in Multan or Khanewal is dispatched immediately with recovery gear, gauges, and standard electrical/control spares.',
        category: 'Commercial Refrigeration',
        sortOrder: 4,
      },
      {
        question: 'Do your repairs and installations include a warranty?',
        answer:
          'Yes. Every service job includes a written 90-day workmanship warranty covering flare joints, brazing, and labor, alongside manufacturer warranty documentation on new OEM compressors or parts.',
        category: 'Warranty & Pricing',
        sortOrder: 5,
      },
      {
        question: 'How do I book an appointment or request a commercial maintenance quote?',
        answer:
          'You can submit a booking directly through the website Book Service form, message us on WhatsApp at 03041241947, or call 03041241947 during business hours. Every online booking creates a tracked ticket immediately.',
        category: 'Booking',
        sortOrder: 6,
      },
    ];
    for (const f of seedFaqs) {
      insertFaq.run(f.question, f.answer, f.category, f.sortOrder);
    }
  }

  const testimonialCount = (db.prepare('SELECT COUNT(*) as cnt FROM testimonials').get() as { cnt: number }).cnt;
  if (testimonialCount === 0) {
    const insertReview = db.prepare(`
      INSERT INTO testimonials (customer_name, role_or_company, city, service_name, rating, review_text, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'approved', ?)
    `);
    const reviews = [
      {
        name: 'Dr. Tariq Mehmood',
        role: 'Medical Superintendent, Al-Noor Clinic',
        city: 'Multan',
        service: 'HVAC Maintenance',
        rating: 5,
        text: 'Our clinic waiting halls used to trip breakers every afternoon in June. Mujahid Services balanced our VRF zones, cleaned all condenser banks, and dropped electricity consumption noticeably.',
        date: '2026-09-14 11:20:00',
      },
      {
        name: 'Haji Muhammad Ramzan',
        role: 'Director, Chenab Dairy & Cold Store',
        city: 'Khanewal',
        service: 'Commercial Refrigeration',
        rating: 5,
        text: 'When our -18°C freezer rack lost pressure at 11 PM, their technician reached our plant within 50 minutes, isolated the expansion valve fault, and saved our entire batch.',
        date: '2026-10-03 16:45:00',
      },
      {
        name: 'Salman Qureshi',
        role: 'Homeowner, Model Town',
        city: 'Multan',
        service: 'AC Installation',
        rating: 5,
        text: 'First team I have seen actually bring a vacuum pump and digital gauge to a residential split AC installation. Neat copper routing and zero vibration.',
        date: '2026-10-22 14:10:00',
      },
      {
        name: 'Fatima Zahra',
        role: 'Homeowner, People Colony',
        city: 'Khanewal',
        service: 'Fridge Repair',
        rating: 5,
        text: 'Fixed our inverter refrigerator cooling failure the same afternoon with transparent pricing and a proper 90-day slip. Very respectful and clean work.',
        date: '2026-11-02 10:05:00',
      },
    ];
    for (const r of reviews) {
      insertReview.run(r.name, r.role, r.city, r.service, r.rating, r.text, r.date);
    }
  }

  // Seed genuine operational records across recent months so reports & monthly charts reflect real SQLite rows
  const customerCount = (db.prepare('SELECT COUNT(*) as cnt FROM customers').get() as { cnt: number }).cnt;
  if (customerCount === 0) {
    const insertCust = db.prepare(`
      INSERT INTO customers (full_name, phone, email, city, address, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertBooking = db.prepare(`
      INSERT INTO bookings (booking_code, customer_id, customer_name, phone, service_id, service_name, city, address, preferred_date, message, status, internal_notes, is_read, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const services = db.prepare('SELECT id, title FROM services').all() as { id: number; title: string }[];
    const findSvc = (name: string) => services.find((s) => s.title === name)?.id ?? null;

    const initialCustomers = [
      {
        name: 'Bilal Raza',
        phone: '03006541122',
        email: 'bilal.raza@example.pk',
        city: 'Khanewal',
        address: 'House 14, Block C, Peoples Colony, Khanewal',
        notes: '2x Gree 1.5 Ton Inverter Splits',
        created: '2026-07-12 09:30:00',
      },
      {
        name: 'Al-Noor Medical Complex',
        phone: '03217788990',
        email: 'facilities@alnoorclinic.pk',
        city: 'Multan',
        address: 'Plot 8, Bosan Road near Chungi No. 9, Multan',
        notes: 'Quarterly commercial HVAC AMC client',
        created: '2026-08-05 11:00:00',
      },
      {
        name: 'Usman Ghani',
        phone: '03338891234',
        email: '',
        city: 'Multan',
        address: 'Street 4, Gulgasht Colony, Multan',
        notes: 'Inverter deep freezer maintenance',
        created: '2026-09-18 15:20:00',
      },
      {
        name: 'Chenab Agro Cold Store',
        phone: '03018765432',
        email: 'ops@chenabcold.pk',
        city: 'Khanewal',
        address: 'Plot 22, Industrial Estate, Khanewal',
        notes: 'Dual walk-in cold storage chambers',
        created: '2026-10-08 08:45:00',
      },
      {
        name: 'Zainab Pharmacy',
        phone: '03459911223',
        email: 'admin@zainabpharmacy.pk',
        city: 'Kabirwala',
        address: 'Main Jhang Road, Opposite Civil Hospital, Kabirwala',
        notes: 'Vaccine chiller & 2 cassette ACs',
        created: '2026-11-04 12:15:00',
      },
      {
        name: 'Hamza Tariq',
        phone: '03124455667',
        email: 'hamza.t@example.pk',
        city: 'Multan',
        address: 'House 72, DHA Sector M, Multan',
        notes: 'New construction 4-unit split installation',
        created: '2026-11-14 10:10:00',
      },
    ];

    const custIds: number[] = [];
    for (const c of initialCustomers) {
      const res = insertCust.run(c.name, c.phone, c.email, c.city, c.address, c.notes, c.created, c.created);
      custIds.push(Number(res.lastInsertRowid));
    }

    const initialBookings: {
      code: string;
      custIdx: number;
      service: string;
      prefDate: string;
      msg: string;
      status: BookingStatus;
      internal: string;
      isRead: number;
      created: string;
    }[] = [
      {
        code: 'MS-2026-0001',
        custIdx: 0,
        service: 'AC Repair',
        prefDate: '2026-07-13',
        msg: 'Bedroom 1.5T inverter showing E6 communication error and warm air.',
        status: 'completed',
        internal: 'Replaced outdoor PCB sensor & tested amp draw at 6.4A.',
        isRead: 1,
        created: '2026-07-12 09:30:00',
      },
      {
        code: 'MS-2026-0002',
        custIdx: 1,
        service: 'HVAC Maintenance',
        prefDate: '2026-08-06',
        msg: 'Quarterly chemical wash and filter servicing for 8 floor-standing & cassette units.',
        status: 'completed',
        internal: 'All 8 units descaled, drain lines flushed, report signed by Dr. Tariq.',
        isRead: 1,
        created: '2026-08-05 11:00:00',
      },
      {
        code: 'MS-2026-0003',
        custIdx: 2,
        service: 'Fridge Repair',
        prefDate: '2026-09-19',
        msg: 'Bottom refrigerator compartment not cooling while freezer stays cold.',
        status: 'completed',
        internal: 'Replaced faulty defrost bi-metal thermostat and cleared drain chute.',
        isRead: 1,
        created: '2026-09-18 15:20:00',
      },
      {
        code: 'MS-2026-0004',
        custIdx: 3,
        service: 'Commercial Refrigeration',
        prefDate: '2026-10-09',
        msg: 'Chamber 2 temperature drifting up to -11C during afternoon peak.',
        status: 'completed',
        internal: 'Cleaned condenser fins, adjusted TXV superheat, stable at -19.5C.',
        isRead: 1,
        created: '2026-10-08 08:45:00',
      },
      {
        code: 'MS-2026-0005',
        custIdx: 4,
        service: 'AC Installation',
        prefDate: '2026-11-18',
        msg: 'Need new 2-ton inverter cassette installed in main dispensary area.',
        status: 'confirmed',
        internal: 'Assigned Team B with 35ft insulated copper coil and vacuum pump.',
        isRead: 1,
        created: '2026-11-12 14:30:00',
      },
      {
        code: 'MS-2026-0006',
        custIdx: 5,
        service: 'AC Installation',
        prefDate: '2026-11-19',
        msg: 'Pre-installation inspection and installation for 4 split ACs in new house.',
        status: 'pending',
        internal: '',
        isRead: 0,
        created: '2026-11-15 16:40:00',
      },
      {
        code: 'MS-2026-0007',
        custIdx: 0,
        service: 'HVAC Maintenance',
        prefDate: '2026-11-20',
        msg: 'Winter pre-season checkup for heat-mode operation on both inverter ACs.',
        status: 'pending',
        internal: '',
        isRead: 0,
        created: '2026-11-16 09:10:00',
      },
    ];

    for (const b of initialBookings) {
      const cust = initialCustomers[b.custIdx];
      const custId = custIds[b.custIdx];
      insertBooking.run(
        b.code,
        custId,
        cust.name,
        cust.phone,
        findSvc(b.service),
        b.service,
        cust.city,
        cust.address,
        b.prefDate,
        b.msg,
        b.status,
        b.internal,
        b.isRead,
        b.created,
        b.created
      );
    }
  }

  const inquiryCount = (db.prepare('SELECT COUNT(*) as cnt FROM inquiries').get() as { cnt: number }).cnt;
  if (inquiryCount === 0) {
    const insertInq = db.prepare(`
      INSERT INTO inquiries (customer_name, phone, email, city, subject, message, is_read, admin_reply, replied_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertInq.run(
      'Faisal Mahmood',
      '03007894561',
      'faisal.m@multanmart.pk',
      'Multan',
      'Cold Storage Maintenance Contract Quote',
      'We operate 3 dairy chillers near Sher Shah Road and need a monthly AMC proposal.',
      1,
      'Quotation emailed and WhatsApp inspection scheduled for Thursday at 11 AM.',
      '2026-11-10 15:00:00',
      '2026-11-10 11:30:00'
    );
    insertInq.run(
      'Nadia Siddiqui',
      '03341122998',
      '',
      'Khanewal',
      'Concealed Copper Piping Inquiry',
      'Building a 10-marla house in Civil Lines Khanewal. Looking for concealed copper piping rates per foot.',
      0,
      '',
      null,
      '2026-11-15 17:20:00'
    );
  }

  const notifCount = (db.prepare('SELECT COUNT(*) as cnt FROM admin_notifications').get() as { cnt: number }).cnt;
  if (notifCount === 0) {
    db.prepare(`
      INSERT INTO admin_notifications (type, title, message, reference_id, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'booking',
      'New Booking MS-2026-0007',
      'Bilal Raza (Khanewal) requested HVAC Maintenance for 2026-11-20.',
      7,
      0,
      '2026-11-16 09:10:00'
    );
    db.prepare(`
      INSERT INTO admin_notifications (type, title, message, reference_id, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'inquiry',
      'New Website Inquiry',
      'Nadia Siddiqui (Khanewal) asked about Concealed Copper Piping Inquiry.',
      2,
      0,
      '2026-11-15 17:20:00'
    );
  }

  // Upgrade initial short serviceAreas list if still on legacy 8-city seed
  const existingSettingsRow = db.prepare('SELECT value FROM site_settings WHERE key = ?').get('main') as
    | { value: string }
    | undefined;
  if (existingSettingsRow) {
    try {
      const parsed = JSON.parse(existingSettingsRow.value) as Partial<SiteSettings>;
      if (Array.isArray(parsed.serviceAreas) && parsed.serviceAreas.length <= 10) {
        parsed.serviceAreas = ALL_SERVICE_AREAS;
        db.prepare('UPDATE site_settings SET value = ? WHERE key = ?').run(JSON.stringify(parsed), 'main');
      }
    } catch {
      // ignore parse fallback
    }
  }

  const blogCount = (db.prepare('SELECT COUNT(*) as cnt FROM blog_posts').get() as { cnt: number }).cnt;
  if (blogCount === 0) {
    const insertBlog = db.prepare(`
      INSERT INTO blog_posts (slug, title, category, excerpt, content, author, read_time, image_url, is_published, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);
    const posts = [
      {
        slug: 'why-500-micron-vacuum-prevents-inverter-compressor-burnout',
        title: 'Why a 500-Micron Vacuum Prevents Inverter Compressor Burnout in Multan Summers',
        category: 'AC Installation',
        excerpt:
          'Skipping deep vacuuming during split AC installation leaves moisture and non-condensable air inside R-32 lines—causing high head pressure when Multan temperatures hit 46°C.',
        content:
          'Across DHA Multan, Model Town, and Peoples Colony Khanewal, nearly 70% of premature inverter compressor failures happen on units installed less than two years earlier without a calibrated micron vacuum gauge.\n\nWhen atmospheric moisture mixes with synthetic POE/PVE compressor oil under high discharge heat, it forms hydrofluoric and organic acids that strip stator enamel insulation.\n\nAt Mujahid Services, every installation follows a strict three-stage commissioning sequence:\n1. Dry Nitrogen Pressure Test at 380–420 PSI across all flare and brazed joints for 20 minutes.\n2. Two-Stage Deep Vacuum Pull verified below 500 microns using a digital micron gauge—never just a 30-second purge.\n3. Superheat & Clamp-Amp Verification after refrigerant release to ensure peak seasonal energy efficiency.',
        author: 'Engr. Mujahid Hussain',
        readTime: '4 min read',
        imageUrl: '/src/assets/images/gallery_residential_split_1794823622741.jpg',
        publishedAt: '2026-10-18',
      },
      {
        slug: 'commercial-cold-room-efficiency-guide-southern-punjab',
        title: 'Reducing Cold Storage Downtime & Power Draw Across Khanewal & Multan',
        category: 'Commercial Refrigeration',
        excerpt:
          'Practical preventative benchmarks for dairy chillers, agri cold rooms, and pharmacy walk-in freezers operating under heavy summer condenser loads.',
        content:
          'Cold-chain operators in Khanewal Industrial Estate and Sher Shah Road Multan face extreme ambient condensing temperatures from April through September. Elevated head pressures drive compressor amp draw up by 25–35% and accelerate valve plate fatigue.\n\nKey monthly preventative checks we perform on commercial Bitzer and Copeland racks include:\n• Descaling finned-tube condensers to keep approach temperatures within 8°C of ambient air.\n• Verifying TXV superheat and liquid-line sight glass subcooling.\n• Testing phase-failure relays, crankcase heaters, and defrost termination thermostats before peak grid voltage fluctuations occur.\n\nStructured preventative maintenance pays for itself through lower MEP electricity tariffs and zero spoiled inventory.',
        author: 'Mujahid Cold-Chain Team',
        readTime: '5 min read',
        imageUrl: '/src/assets/images/service_refrigeration_coldroom_1794822111312.jpg',
        publishedAt: '2026-10-29',
      },
      {
        slug: 'decoding-inverter-ac-pcb-error-codes-voltage-protection',
        title: 'Understanding Inverter AC Error Codes & Voltage Surge Diagnostics',
        category: 'AC Repair',
        excerpt:
          'How component-level PCB testing separates sensor faults from IPM module damage—saving homeowners unnecessary full-board replacements.',
        content:
          'Modern DC inverter air conditioners rely on high-speed serial communication between indoor and outdoor PCBs. Grid voltage swings common in summer often trigger E6, F0, or P4 protection locks.\n\nBefore replacing expensive outdoor inverter boards, our Khanewal diagnostic bench isolates:\n• NTC thermistor resistance curves across room and coil sensors.\n• Bridge rectifier and DC bus capacitor ripple under simulated load.\n• IGBT / IPM phase balance using calibrated clamp meters.\n\nPairing your inverter AC with a true delay-timer voltage protector dramatically reduces outdoor board failures.',
        author: 'Diagnostic Electronics Lab',
        readTime: '4 min read',
        imageUrl: '/src/assets/images/gallery_inverter_pcb_1794823621561.jpg',
        publishedAt: '2026-11-05',
      },
      {
        slug: 'vrf-ductwork-balancing-for-clinics-and-corporate-plazas',
        title: 'Airflow Balancing & VRF Zoning for Medical Clinics and Offices in Multan',
        category: 'HVAC Maintenance',
        excerpt:
          'Why quiet ceiling cassette placement and sealed galvanized ductwork determine comfort and electricity costs in commercial spaces.',
        content:
          'Commercial buildings along Bosan Road and Abdali Road often suffer from uneven cooling—freezing reception areas while consultation rooms stay humid.\n\nProper VRF and ducted split engineering starts with room-by-room heat load calculation, insulated galvanized sheet-metal transitions, and balanced supply diffusers.\n\nQuarterly chemical coil servicing and static pressure verification keep indoor air quality clean and compressors operating in their optimal inverter modulation band.',
        author: 'Engr. Mujahid Hussain',
        readTime: '5 min read',
        imageUrl: '/src/assets/images/gallery_ductwork_vrf_1794823622234.jpg',
        publishedAt: '2026-11-11',
      },
    ];
    for (const post of posts) {
      insertBlog.run(
        post.slug,
        post.title,
        post.category,
        post.excerpt,
        post.content,
        post.author,
        post.readTime,
        post.imageUrl,
        post.publishedAt
      );
    }
  }

  const galleryCount = (db.prepare('SELECT COUNT(*) as cnt FROM gallery_items').get() as { cnt: number }).cnt;
  if (galleryCount === 0) {
    const insertGallery = db.prepare(`
      INSERT INTO gallery_items (title, category, location, caption, image_url, is_published, sort_order)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `);
    const gallerySeed = [
      {
        title: 'Rooftop VRF Condenser Array',
        category: 'AC Installation',
        location: 'Bosan Road, Multan',
        caption: 'Multi-unit outdoor VRF installation with insulated copper header lines and vibration isolation pads.',
        imageUrl: '/src/assets/images/hero_hvacr_engineering_1794822109469.jpg',
        sortOrder: 1,
      },
      {
        title: '4-Way Cassette & Spiral Ductwork',
        category: 'Commercial HVAC',
        location: 'Abdali Road, Multan',
        caption: 'Suspended ceiling cassette integration and balanced galvanized steel supply ducting.',
        imageUrl: '/src/assets/images/gallery_ductwork_vrf_1794823622234.jpg',
        sortOrder: 2,
      },
      {
        title: 'Walk-In Cold Storage Plant Room',
        category: 'Commercial Refrigeration',
        location: 'Industrial Estate, Khanewal',
        caption: 'Twin stainless compressor racks with digital temperature telemetry set to -20°C hold.',
        imageUrl: '/src/assets/images/service_refrigeration_coldroom_1794822111312.jpg',
        sortOrder: 3,
      },
      {
        title: 'Digital Manifold Superheat Calibration',
        category: 'AC Repair',
        location: 'DHA Multan',
        caption: 'Field pressure and subcooling verification on a 2-ton inverter condenser unit.',
        imageUrl: '/src/assets/images/service_ac_systems_1794822111871.jpg',
        sortOrder: 4,
      },
      {
        title: 'Inverter PCB Bench Testing',
        category: 'Diagnostics Lab',
        location: 'Main Multan Road, Khanewal',
        caption: 'Component-level inverter control board diagnostics using digital clamp and multimeter instrumentation.',
        imageUrl: '/src/assets/images/gallery_inverter_pcb_1794823621561.jpg',
        sortOrder: 5,
      },
      {
        title: 'Medical Complex Chiller & Duct Plant',
        category: 'Commercial HVAC',
        location: 'Chungi No. 9, Multan',
        caption: '48-ton rooftop air handling and insulated sheet-metal ductwork installation.',
        imageUrl: '/src/assets/images/project_multan_commercial_1794822111869.jpg',
        sortOrder: 6,
      },
      {
        title: 'Residential Inverter Split Mounting',
        category: 'AC Installation',
        location: 'Peoples Colony, Khanewal',
        caption: 'Clean concealed-pipe residential inverter split installation with zero visible wiring.',
        imageUrl: '/src/assets/images/gallery_residential_split_1794823622741.jpg',
        sortOrder: 7,
      },
      {
        title: 'Calibrated Field Tool & Recovery Bay',
        category: 'Diagnostics Lab',
        location: 'Khanewal Workshop',
        caption: 'Vacuum pumps, R-410A recovery cylinders, flaring tools, and calibrated digital meters.',
        imageUrl: '/src/assets/images/about_workshop_team_1794822112940.jpg',
        sortOrder: 8,
      },
    ];
    for (const g of gallerySeed) {
      insertGallery.run(g.title, g.category, g.location, g.caption, g.imageUrl, g.sortOrder);
    }
  }

  const productCount = (db.prepare('SELECT COUNT(*) as cnt FROM products').get() as { cnt: number }).cnt;
  if (productCount === 0) {
    const insertProduct = db.prepare(`
      INSERT INTO products (name, category, brand, capacity_or_spec, price_pkr, stock_status, summary, specs_json, image_url, is_published, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);
    const productSeed = [
      {
        name: 'T3 Tropicalized DC Inverter Split AC (1.5 Ton)',
        category: 'Inverter Air Conditioners',
        brand: 'Gree / Haier Commercial Grade',
        capacityOrSpec: '18,000 BTU · R-32 · T3 52°C Rated',
        pricePkr: 'PKR 168,000',
        stockStatus: 'In Stock',
        summary:
          'Engineered specifically for Multan & Khanewal extreme 48°C+ ambient summers with wide-voltage PCB protection (145V–265V) and gold-fin anti-corrosion coils.',
        specs: [
          'Full DC Twin-Rotary Inverter Compressor (Up to 60% Energy Saving)',
          'Low-Voltage Startup 145V without external stabilizer',
          'Includes 10 ft Heavy-Gauge Copper Kit & 500-Micron Installation Option',
          '10-Year Compressor & 4-Year PCB Warranty',
        ],
        imageUrl: '/src/assets/images/gallery_residential_split_1794823622741.jpg',
        sortOrder: 1,
      },
      {
        name: 'Commercial Floor-Standing & 4-Way Cassette VRF Unit',
        category: 'Commercial VRF & Chillers',
        brand: 'Gree / Midea VRF Series',
        capacityOrSpec: '4.0 – 16.0 Ton Modular · R-410A',
        pricePkr: 'PKR 425,000 onwards',
        stockStatus: 'On Order',
        summary:
          'High-capacity multi-zone inverter VRF outdoor & 4-way ceiling cassette units tailored for medical clinics, mosques, corporate plazas, and marriage halls.',
        specs: [
          'Variable Refrigerant Flow modulating load from 10% to 100%',
          'Quiet 38 dB(A) indoor cassette airflow with built-in condensate lift pump',
          'Centralized BMS & Wi-Fi group thermostat compatibility',
          'Full engineering load study & duct design included',
        ],
        imageUrl: '/src/assets/images/hero_hvacr_engineering_1794822109469.jpg',
        sortOrder: 2,
      },
      {
        name: 'Walk-In Cold Room Condensing Unit (-20°C / +4°C)',
        category: 'Cold Storage Hardware',
        brand: 'Bitzer / Copeland Semi-Hermetic',
        capacityOrSpec: '3 HP – 15 HP · R-404A / R-449A',
        pricePkr: 'PKR 540,000 onwards',
        stockStatus: 'Workshop Stock',
        summary:
          'Heavy-duty tropicalized condensing racks paired with high-fin evaporators and Dixell digital defrost controllers for dairy, pharma, and fruit cold stores.',
        specs: [
          'Semi-hermetic reciprocating compressor with oil sight glass & crankcase heater',
          'Dual HP/LP mechanical safety cutouts & phase-failure protection',
          'Powder-coated tropical condenser bank with dual axial fans',
          '24/7 Khanewal & Multan commissioning & AMC support',
        ],
        imageUrl: '/src/assets/images/service_refrigeration_coldroom_1794822111312.jpg',
        sortOrder: 3,
      },
      {
        name: 'OEM Inverter Compressor & Outdoor IPM Control Kit',
        category: 'Genuine Spares & PCBs',
        brand: 'GMCC / Highly / Danfoss OEM',
        capacityOrSpec: 'R-32 / R-410A / R-600a Genuine',
        pricePkr: 'PKR 24,500 – 58,000',
        stockStatus: 'In Stock',
        summary:
          'Factory-sealed replacement rotary, scroll, and refrigerator inverter compressors plus tested IPM inverter control modules and EEV coils.',
        specs: [
          '100% genuine factory-sealed OEM compressors (no rewound units)',
          'Pre-charged synthetic POE/PVE lubrication',
          'Includes filter drier, service access valve, and nitrogen flush',
          'Bench-verified amp & resistance profile prior to dispatch',
        ],
        imageUrl: '/src/assets/images/product_hvac_hardware_1794825552921.jpg',
        sortOrder: 4,
      },
      {
        name: '22-Gauge Pure Copper Line Set & Armaflex Insulation',
        category: 'Piping & Installation Kits',
        brand: 'Muller / Mueller-Spec Pure Copper',
        capacityOrSpec: '1/4" + 1/2" & 3/8" + 5/8" Rolls',
        pricePkr: 'PKR 1,150 / Running Ft',
        stockStatus: 'In Stock',
        summary:
          'Heavy-wall 22-gauge seamless ACR copper tubing pre-clad with closed-cell Class-O thermal insulation for zero condensation and concealed residential runs.',
        specs: [
          '99.9% oxygen-free pure deoxidized copper (tested to 650 PSI)',
          'UV-resistant high-density closed-cell elastomeric foam',
          'Zero-pinhole flare integrity for R-32 & R-410A high pressure',
          'Ideal for DHA Multan & Civil Lines concealed construction piping',
        ],
        imageUrl: '/src/assets/images/gallery_ductwork_vrf_1794823622234.jpg',
        sortOrder: 5,
      },
      {
        name: 'Smart Wi-Fi Thermostat & Voltage Surge Protector',
        category: 'Controls & Protection',
        brand: 'Dixell / Honeywell / Eco-Air',
        capacityOrSpec: 'RS-485 / 220V Delay Relay 30A',
        pricePkr: 'PKR 6,500 – 19,500',
        stockStatus: 'In Stock',
        summary:
          'Programmable touch-glass HVAC thermostats and true 3-minute compressor delay voltage guards protecting inverter PCBs against grid fluctuations.',
        specs: [
          'Over/under voltage cutoff (165V – 255V) with 180-sec startup delay',
          'Wi-Fi scheduling & mobile temperature monitoring for clinics/offices',
          'Dual-probe cold room thermostat option (-40°C to +50°C)',
          'Includes installation & calibration in Multan and Khanewal',
        ],
        imageUrl: '/src/assets/images/gallery_inverter_pcb_1794823621561.jpg',
        sortOrder: 6,
      },
    ];
    for (const pr of productSeed) {
      insertProduct.run(
        pr.name,
        pr.category,
        pr.brand,
        pr.capacityOrSpec,
        pr.pricePkr,
        pr.stockStatus,
        pr.summary,
        JSON.stringify(pr.specs),
        pr.imageUrl,
        pr.sortOrder
      );
    }
  }
}

export function getSiteSettings(): SiteSettings {
  const row = db.prepare('SELECT value FROM site_settings WHERE key = ?').get('main') as
    | { value: string }
    | undefined;
  if (!row) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(row.value) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function updateSiteSettings(partial: Partial<SiteSettings>): SiteSettings {
  const current = getSiteSettings();
  const merged: SiteSettings = { ...current, ...partial };
  db.prepare('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)').run(
    'main',
    JSON.stringify(merged)
  );
  return merged;
}

function mapServiceRow(row: Record<string, unknown>): ServiceItem {
  let features: string[] = [];
  try {
    features = JSON.parse(String(row.features_json || '[]'));
  } catch {
    features = [];
  }
  return {
    id: Number(row.id),
    slug: String(row.slug),
    title: String(row.title),
    shortDescription: String(row.short_description),
    fullDescription: String(row.full_description),
    features,
    priceRange: String(row.price_range),
    responseWindow: String(row.response_window),
    imageUrl: String(row.image_url),
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapProjectRow(row: Record<string, unknown>): ProjectItem {
  return {
    id: Number(row.id),
    title: String(row.title),
    category: String(row.category),
    clientName: String(row.client_name),
    location: String(row.location),
    completionDate: String(row.completion_date),
    summary: String(row.summary),
    metrics: String(row.metrics),
    imageUrl: String(row.image_url),
    isPublished: Boolean(row.is_published),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapPlanRow(row: Record<string, unknown>): MaintenancePlan {
  let features: string[] = [];
  try {
    features = JSON.parse(String(row.features_json || '[]'));
  } catch {
    features = [];
  }
  return {
    id: Number(row.id),
    name: String(row.name),
    targetAudience: String(row.target_audience),
    billingCycle: String(row.billing_cycle) as MaintenancePlan['billingCycle'],
    pricePkr: Number(row.price_pkr),
    description: String(row.description),
    features,
    isPublished: Boolean(row.is_published),
    sortOrder: Number(row.sort_order),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapFaqRow(row: Record<string, unknown>): FaqItem {
  return {
    id: Number(row.id),
    question: String(row.question),
    answer: String(row.answer),
    category: String(row.category),
    sortOrder: Number(row.sort_order),
    isPublished: Boolean(row.is_published),
  };
}

function mapTestimonialRow(row: Record<string, unknown>): Testimonial {
  return {
    id: Number(row.id),
    customerName: String(row.customer_name),
    roleOrCompany: String(row.role_or_company),
    city: String(row.city),
    serviceName: String(row.service_name),
    rating: Number(row.rating),
    reviewText: String(row.review_text),
    status: String(row.status) as ReviewStatus,
    createdAt: String(row.created_at),
  };
}

function mapBookingRow(row: Record<string, unknown>): BookingRecord {
  return {
    id: Number(row.id),
    bookingCode: String(row.booking_code),
    customerId: Number(row.customer_id),
    customerName: String(row.customer_name),
    phone: String(row.phone),
    serviceId: row.service_id ? Number(row.service_id) : null,
    serviceName: String(row.service_name),
    city: String(row.city),
    address: String(row.address),
    preferredDate: String(row.preferred_date),
    message: String(row.message),
    status: String(row.status) as BookingStatus,
    internalNotes: String(row.internal_notes),
    isRead: Boolean(row.is_read),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapInquiryRow(row: Record<string, unknown>): ContactInquiry {
  return {
    id: Number(row.id),
    customerName: String(row.customer_name),
    phone: String(row.phone),
    email: String(row.email),
    city: String(row.city),
    subject: String(row.subject),
    message: String(row.message),
    isRead: Boolean(row.is_read),
    adminReply: String(row.admin_reply),
    repliedAt: row.replied_at ? String(row.replied_at) : null,
    createdAt: String(row.created_at),
  };
}

function mapBlogRow(row: Record<string, unknown>): BlogPost {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    title: String(row.title),
    category: String(row.category),
    excerpt: String(row.excerpt),
    content: String(row.content),
    author: String(row.author),
    readTime: String(row.read_time),
    imageUrl: String(row.image_url),
    isPublished: Boolean(row.is_published),
    publishedAt: String(row.published_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapGalleryRow(row: Record<string, unknown>): GalleryItem {
  return {
    id: Number(row.id),
    title: String(row.title),
    category: String(row.category),
    location: String(row.location),
    caption: String(row.caption),
    imageUrl: String(row.image_url),
    isPublished: Boolean(row.is_published),
    sortOrder: Number(row.sort_order),
    createdAt: String(row.created_at),
  };
}

function mapProductRow(row: Record<string, unknown>): ProductItem {
  let specs: string[] = [];
  try {
    specs = JSON.parse(String(row.specs_json || '[]'));
  } catch {
    specs = [];
  }
  return {
    id: Number(row.id),
    name: String(row.name),
    category: String(row.category),
    brand: String(row.brand),
    capacityOrSpec: String(row.capacity_or_spec),
    pricePkr: String(row.price_pkr),
    stockStatus: String(row.stock_status) as ProductItem['stockStatus'],
    summary: String(row.summary),
    specs,
    imageUrl: String(row.image_url),
    isPublished: Boolean(row.is_published),
    sortOrder: Number(row.sort_order),
    createdAt: String(row.created_at),
  };
}

export function getPublicBootstrap(): PublicBootstrapData {
  const settings = getSiteSettings();
  const services = (
    db.prepare('SELECT * FROM services WHERE is_active = 1 ORDER BY sort_order ASC, id ASC').all() as Record<
      string,
      unknown
    >[]
  ).map(mapServiceRow);

  const products = (
    db.prepare('SELECT * FROM products WHERE is_published = 1 ORDER BY sort_order ASC, id ASC').all() as Record<
      string,
      unknown
    >[]
  ).map(mapProductRow);

  const projects = (
    db.prepare('SELECT * FROM projects WHERE is_published = 1 ORDER BY completion_date DESC, id DESC').all() as Record<
      string,
      unknown
    >[]
  ).map(mapProjectRow);

  const plans = (
    db
      .prepare('SELECT * FROM maintenance_plans WHERE is_published = 1 ORDER BY sort_order ASC, id ASC')
      .all() as Record<string, unknown>[]
  ).map(mapPlanRow);

  const faqs = (
    db.prepare('SELECT * FROM faqs WHERE is_published = 1 ORDER BY sort_order ASC, id ASC').all() as Record<
      string,
      unknown
    >[]
  ).map(mapFaqRow);

  const testimonials = (
    db.prepare("SELECT * FROM testimonials WHERE status = 'approved' ORDER BY created_at DESC, id DESC").all() as Record<
      string,
      unknown
    >[]
  ).map(mapTestimonialRow);

  const blogPosts = (
    db.prepare('SELECT * FROM blog_posts WHERE is_published = 1 ORDER BY published_at DESC, id DESC').all() as Record<
      string,
      unknown
    >[]
  ).map(mapBlogRow);

  const galleryItems = (
    db.prepare('SELECT * FROM gallery_items WHERE is_published = 1 ORDER BY sort_order ASC, id DESC').all() as Record<
      string,
      unknown
    >[]
  ).map(mapGalleryRow);

  return { settings, services, products, projects, plans, faqs, testimonials, blogPosts, galleryItems };
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-()]+/g, '').trim();
}

export function createPublicBooking(input: {
  customerName: string;
  phone: string;
  email?: string;
  serviceId?: number | null;
  serviceName: string;
  city: string;
  address: string;
  preferredDate: string;
  message?: string;
}): BookingRecord {
  const cleanPhone = normalizePhone(input.phone);

  const tx = db.transaction(() => {
    const existingCustomer = db.prepare('SELECT * FROM customers WHERE phone = ?').get(cleanPhone) as
      | Record<string, unknown>
      | undefined;

    let customerId: number;
    if (existingCustomer) {
      customerId = Number(existingCustomer.id);
      db.prepare(
        `UPDATE customers
         SET full_name = ?, city = ?, address = ?, email = CASE WHEN ? != '' THEN ? ELSE email END, updated_at = datetime('now')
         WHERE id = ?`
      ).run(
        input.customerName,
        input.city,
        input.address,
        input.email || '',
        input.email || '',
        customerId
      );
    } else {
      const custRes = db
        .prepare(
          `INSERT INTO customers (full_name, phone, email, city, address, notes)
           VALUES (?, ?, ?, ?, ?, '')`
        )
        .run(input.customerName, cleanPhone, input.email || '', input.city, input.address);
      customerId = Number(custRes.lastInsertRowid);
    }

    const maxIdRow = db.prepare('SELECT COALESCE(MAX(id), 0) as maxId FROM bookings').get() as { maxId: number };
    const nextNum = maxIdRow.maxId + 1;
    const year = new Date().getFullYear();
    const bookingCode = `MS-${year}-${String(nextNum).padStart(4, '0')}`;

    const bookingRes = db
      .prepare(
        `INSERT INTO bookings (booking_code, customer_id, customer_name, phone, service_id, service_name, city, address, preferred_date, message, status, internal_notes, is_read)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', '', 0)`
      )
      .run(
        bookingCode,
        customerId,
        input.customerName,
        cleanPhone,
        input.serviceId ?? null,
        input.serviceName,
        input.city,
        input.address,
        input.preferredDate,
        input.message || ''
      );

    const bookingId = Number(bookingRes.lastInsertRowid);

    db.prepare(
      `INSERT INTO admin_notifications (type, title, message, reference_id, is_read)
       VALUES ('booking', ?, ?, ?, 0)`
    ).run(
      `New Booking ${bookingCode}`,
      `${input.customerName} (${input.city}) requested ${input.serviceName} for ${input.preferredDate}.`,
      bookingId
    );

    const row = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId) as Record<string, unknown>;
    return mapBookingRow(row);
  });

  return tx();
}

export function createPublicInquiry(input: {
  customerName: string;
  phone: string;
  email?: string;
  city: string;
  subject: string;
  message: string;
}): ContactInquiry {
  const cleanPhone = normalizePhone(input.phone);

  const tx = db.transaction(() => {
    const res = db
      .prepare(
        `INSERT INTO inquiries (customer_name, phone, email, city, subject, message, is_read, admin_reply)
         VALUES (?, ?, ?, ?, ?, ?, 0, '')`
      )
      .run(input.customerName, cleanPhone, input.email || '', input.city, input.subject, input.message);
    const inqId = Number(res.lastInsertRowid);

    db.prepare(
      `INSERT INTO admin_notifications (type, title, message, reference_id, is_read)
       VALUES ('inquiry', ?, ?, ?, 0)`
    ).run(
      `New Inquiry: ${input.subject}`,
      `${input.customerName} (${input.city}) sent a contact inquiry.`,
      inqId
    );

    const row = db.prepare('SELECT * FROM inquiries WHERE id = ?').get(inqId) as Record<string, unknown>;
    return mapInquiryRow(row);
  });

  return tx();
}

export function createPublicReview(input: {
  customerName: string;
  roleOrCompany: string;
  city: string;
  serviceName: string;
  rating: number;
  reviewText: string;
}): Testimonial {
  const tx = db.transaction(() => {
    const res = db
      .prepare(
        `INSERT INTO testimonials (customer_name, role_or_company, city, service_name, rating, review_text, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`
      )
      .run(
        input.customerName,
        input.roleOrCompany || 'Verified Customer',
        input.city,
        input.serviceName,
        Math.min(5, Math.max(1, Math.round(input.rating))),
        input.reviewText
      );
    const reviewId = Number(res.lastInsertRowid);

    db.prepare(
      `INSERT INTO admin_notifications (type, title, message, reference_id, is_read)
       VALUES ('review', ?, ?, ?, 0)`
    ).run(
      'New Customer Review Pending Approval',
      `${input.customerName} (${input.city}) rated ${input.serviceName} ${input.rating}/5.`,
      reviewId
    );

    const row = db.prepare('SELECT * FROM testimonials WHERE id = ?').get(reviewId) as Record<string, unknown>;
    return mapTestimonialRow(row);
  });

  return tx();
}

export function getDashboardStats(): DashboardStats {
  const totalInquiries = (db.prepare('SELECT COUNT(*) as c FROM inquiries').get() as { c: number }).c;
  const unreadInquiries = (db.prepare('SELECT COUNT(*) as c FROM inquiries WHERE is_read = 0').get() as { c: number }).c;
  const totalBookings = (db.prepare('SELECT COUNT(*) as c FROM bookings').get() as { c: number }).c;
  const pendingBookings = (
    db.prepare("SELECT COUNT(*) as c FROM bookings WHERE status = 'pending'").get() as { c: number }
  ).c;
  const confirmedBookings = (
    db.prepare("SELECT COUNT(*) as c FROM bookings WHERE status = 'confirmed'").get() as { c: number }
  ).c;
  const completedBookings = (
    db.prepare("SELECT COUNT(*) as c FROM bookings WHERE status = 'completed'").get() as { c: number }
  ).c;
  const cancelledBookings = (
    db.prepare("SELECT COUNT(*) as c FROM bookings WHERE status = 'cancelled'").get() as { c: number }
  ).c;
  const totalCustomers = (db.prepare('SELECT COUNT(*) as c FROM customers').get() as { c: number }).c;
  const unreadNotifications = (
    db.prepare('SELECT COUNT(*) as c FROM admin_notifications WHERE is_read = 0').get() as { c: number }
  ).c;

  const monthlyRows = db
    .prepare(
      `SELECT
         strftime('%Y-%m', created_at) as month,
         COUNT(*) as total,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
       FROM bookings
       GROUP BY strftime('%Y-%m', created_at)
       ORDER BY month ASC
       LIMIT 12`
    )
    .all() as { month: string; total: number; completed: number; pending: number }[];

  const recentRows = db
    .prepare('SELECT * FROM bookings ORDER BY created_at DESC, id DESC LIMIT 8')
    .all() as Record<string, unknown>[];

  return {
    totalInquiries,
    unreadInquiries,
    totalBookings,
    pendingBookings,
    confirmedBookings,
    completedBookings,
    cancelledBookings,
    totalCustomers,
    unreadNotifications,
    monthlyOverview: monthlyRows,
    recentRequests: recentRows.map(mapBookingRow),
  };
}

export function getReportsData(): ReportsPayload {
  const daily = db
    .prepare(
      `SELECT
         substr(created_at, 1, 10) as date,
         COUNT(*) as count,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
       FROM bookings
       GROUP BY substr(created_at, 1, 10)
       ORDER BY date DESC
       LIMIT 30`
    )
    .all() as { date: string; count: number; completed: number }[];

  const weekly = db
    .prepare(
      `SELECT
         strftime('%Y-W%W', created_at) as week,
         COUNT(*) as count,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
       FROM bookings
       GROUP BY strftime('%Y-W%W', created_at)
       ORDER BY week DESC
       LIMIT 16`
    )
    .all() as { week: string; count: number; completed: number }[];

  const monthly = db
    .prepare(
      `SELECT
         strftime('%Y-%m', created_at) as month,
         COUNT(*) as count,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
         SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
       FROM bookings
       GROUP BY strftime('%Y-%m', created_at)
       ORDER BY month DESC
       LIMIT 12`
    )
    .all() as { month: string; count: number; completed: number; cancelled: number }[];

  const serviceBreakdown = db
    .prepare(
      `SELECT
         service_name as serviceName,
         COUNT(*) as total,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
       FROM bookings
       GROUP BY service_name
       ORDER BY total DESC`
    )
    .all() as { serviceName: string; total: number; completed: number; pending: number }[];

  const totalInq = (db.prepare('SELECT COUNT(*) as c FROM inquiries').get() as { c: number }).c;
  const unreadInq = (db.prepare('SELECT COUNT(*) as c FROM inquiries WHERE is_read = 0').get() as { c: number }).c;
  const repliedInq = (
    db.prepare("SELECT COUNT(*) as c FROM inquiries WHERE admin_reply != ''").get() as { c: number }
  ).c;
  const byCity = db
    .prepare('SELECT city, COUNT(*) as count FROM inquiries GROUP BY city ORDER BY count DESC')
    .all() as { city: string; count: number }[];

  return {
    daily,
    weekly,
    monthly,
    serviceBreakdown,
    inquirySummary: {
      total: totalInq,
      unread: unreadInq,
      replied: repliedInq,
      byCity,
    },
  };
}

export function getAllAdminServices(): ServiceItem[] {
  return (
    db.prepare('SELECT * FROM services ORDER BY sort_order ASC, id ASC').all() as Record<string, unknown>[]
  ).map(mapServiceRow);
}

export function getAllAdminProjects(): ProjectItem[] {
  return (
    db.prepare('SELECT * FROM projects ORDER BY completion_date DESC, id DESC').all() as Record<string, unknown>[]
  ).map(mapProjectRow);
}

export function getAllAdminPlans(): MaintenancePlan[] {
  return (
    db.prepare('SELECT * FROM maintenance_plans ORDER BY sort_order ASC, id ASC').all() as Record<string, unknown>[]
  ).map(mapPlanRow);
}

export function getAllAdminFaqs(): FaqItem[] {
  return (
    db.prepare('SELECT * FROM faqs ORDER BY sort_order ASC, id ASC').all() as Record<string, unknown>[]
  ).map(mapFaqRow);
}

export function getAllAdminTestimonials(): Testimonial[] {
  return (
    db.prepare('SELECT * FROM testimonials ORDER BY created_at DESC, id DESC').all() as Record<string, unknown>[]
  ).map(mapTestimonialRow);
}

export function getAllAdminBookings(): BookingRecord[] {
  return (
    db.prepare('SELECT * FROM bookings ORDER BY created_at DESC, id DESC').all() as Record<string, unknown>[]
  ).map(mapBookingRow);
}

export function getAllAdminCustomers(): CustomerRecord[] {
  const rows = db
    .prepare(
      `SELECT c.*,
              COUNT(b.id) as booking_count,
              MAX(b.created_at) as last_booking_date
       FROM customers c
       LEFT JOIN bookings b ON b.customer_id = c.id
       GROUP BY c.id
       ORDER BY c.updated_at DESC, c.id DESC`
    )
    .all() as Record<string, unknown>[];

  return rows.map((row) => ({
    id: Number(row.id),
    fullName: String(row.full_name),
    phone: String(row.phone),
    email: String(row.email),
    city: String(row.city),
    address: String(row.address),
    notes: String(row.notes),
    bookingCount: Number(row.booking_count || 0),
    lastBookingDate: row.last_booking_date ? String(row.last_booking_date) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));
}

export function getCustomerBookings(customerId: number): BookingRecord[] {
  return (
    db.prepare('SELECT * FROM bookings WHERE customer_id = ? ORDER BY created_at DESC, id DESC').all(customerId) as Record<
      string,
      unknown
    >[]
  ).map(mapBookingRow);
}

export function getAllAdminInquiries(): ContactInquiry[] {
  return (
    db.prepare('SELECT * FROM inquiries ORDER BY created_at DESC, id DESC').all() as Record<string, unknown>[]
  ).map(mapInquiryRow);
}

export function getAdminNotifications(): AdminNotification[] {
  const rows = db
    .prepare('SELECT * FROM admin_notifications ORDER BY created_at DESC, id DESC LIMIT 30')
    .all() as Record<string, unknown>[];
  return rows.map((r) => ({
    id: Number(r.id),
    type: String(r.type) as AdminNotification['type'],
    title: String(r.title),
    message: String(r.message),
    referenceId: Number(r.reference_id),
    isRead: Boolean(r.is_read),
    createdAt: String(r.created_at),
  }));
}

export function getAdminUserById(id: number): AdminUser | null {
  const row = db
    .prepare('SELECT id, username, email, full_name, role, updated_at FROM admin_users WHERE id = ?')
    .get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: Number(row.id),
    username: String(row.username),
    email: String(row.email),
    fullName: String(row.full_name),
    role: String(row.role),
    updatedAt: String(row.updated_at),
  };
}

export function getAllAdminBlogPosts(): BlogPost[] {
  return (
    db.prepare('SELECT * FROM blog_posts ORDER BY published_at DESC, id DESC').all() as Record<string, unknown>[]
  ).map(mapBlogRow);
}

export function getAllAdminGalleryItems(): GalleryItem[] {
  return (
    db.prepare('SELECT * FROM gallery_items ORDER BY sort_order ASC, id DESC').all() as Record<string, unknown>[]
  ).map(mapGalleryRow);
}

export function getAllAdminProducts(): ProductItem[] {
  return (
    db.prepare('SELECT * FROM products ORDER BY sort_order ASC, id ASC').all() as Record<string, unknown>[]
  ).map(mapProductRow);
}

export function exportFullJsonBackup() {
  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    data: {
      site_settings: db.prepare('SELECT * FROM site_settings').all(),
      services: db.prepare('SELECT * FROM services').all(),
      products: db.prepare('SELECT * FROM products').all(),
      projects: db.prepare('SELECT * FROM projects').all(),
      maintenance_plans: db.prepare('SELECT * FROM maintenance_plans').all(),
      faqs: db.prepare('SELECT * FROM faqs').all(),
      testimonials: db.prepare('SELECT * FROM testimonials').all(),
      customers: db.prepare('SELECT * FROM customers').all(),
      bookings: db.prepare('SELECT * FROM bookings').all(),
      inquiries: db.prepare('SELECT * FROM inquiries').all(),
      admin_notifications: db.prepare('SELECT * FROM admin_notifications').all(),
      blog_posts: db.prepare('SELECT * FROM blog_posts').all(),
      gallery_items: db.prepare('SELECT * FROM gallery_items').all(),
    },
  };
}

export function restoreFromJsonBackup(payload: unknown): { restoredCounts: Record<string, number> } {
  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new Error('Invalid backup format: missing data object.');
  }
  const data = (payload as { data: Record<string, unknown[]> }).data;
  const requiredTables = [
    'site_settings',
    'services',
    'projects',
    'maintenance_plans',
    'faqs',
    'testimonials',
    'customers',
    'bookings',
    'inquiries',
  ];
  for (const tbl of requiredTables) {
    if (!Array.isArray(data[tbl])) {
      throw new Error(`Invalid backup format: missing or invalid table "${tbl}".`);
    }
  }

  const tx = db.transaction(() => {
    db.exec(`
      DELETE FROM admin_notifications;
      DELETE FROM bookings;
      DELETE FROM customers;
      DELETE FROM inquiries;
      DELETE FROM testimonials;
      DELETE FROM faqs;
      DELETE FROM maintenance_plans;
      DELETE FROM projects;
      DELETE FROM services;
      DELETE FROM site_settings;
    `);

    for (const row of data.site_settings as { key: string; value: string }[]) {
      db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?)').run(row.key, row.value);
    }
    for (const row of data.services as Record<string, unknown>[]) {
      db.prepare(
        `INSERT INTO services (id, slug, title, short_description, full_description, features_json, price_range, response_window, image_url, is_active, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        row.id,
        row.slug,
        row.title,
        row.short_description,
        row.full_description,
        row.features_json,
        row.price_range,
        row.response_window,
        row.image_url,
        row.is_active,
        row.sort_order,
        row.created_at,
        row.updated_at
      );
    }
    for (const row of data.projects as Record<string, unknown>[]) {
      db.prepare(
        `INSERT INTO projects (id, title, category, client_name, location, completion_date, summary, metrics, image_url, is_published, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        row.id,
        row.title,
        row.category,
        row.client_name,
        row.location,
        row.completion_date,
        row.summary,
        row.metrics,
        row.image_url,
        row.is_published,
        row.created_at,
        row.updated_at
      );
    }
    for (const row of data.maintenance_plans as Record<string, unknown>[]) {
      db.prepare(
        `INSERT INTO maintenance_plans (id, name, target_audience, billing_cycle, price_pkr, description, features_json, is_published, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        row.id,
        row.name,
        row.target_audience,
        row.billing_cycle,
        row.price_pkr,
        row.description,
        row.features_json,
        row.is_published,
        row.sort_order,
        row.created_at,
        row.updated_at
      );
    }
    for (const row of data.faqs as Record<string, unknown>[]) {
      db.prepare(
        `INSERT INTO faqs (id, question, answer, category, sort_order, is_published)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(row.id, row.question, row.answer, row.category, row.sort_order, row.is_published);
    }
    for (const row of data.testimonials as Record<string, unknown>[]) {
      db.prepare(
        `INSERT INTO testimonials (id, customer_name, role_or_company, city, service_name, rating, review_text, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        row.id,
        row.customer_name,
        row.role_or_company,
        row.city,
        row.service_name,
        row.rating,
        row.review_text,
        row.status,
        row.created_at
      );
    }
    for (const row of data.customers as Record<string, unknown>[]) {
      db.prepare(
        `INSERT INTO customers (id, full_name, phone, email, city, address, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(row.id, row.full_name, row.phone, row.email, row.city, row.address, row.notes, row.created_at, row.updated_at);
    }
    for (const row of data.bookings as Record<string, unknown>[]) {
      db.prepare(
        `INSERT INTO bookings (id, booking_code, customer_id, customer_name, phone, service_id, service_name, city, address, preferred_date, message, status, internal_notes, is_read, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        row.id,
        row.booking_code,
        row.customer_id,
        row.customer_name,
        row.phone,
        row.service_id,
        row.service_name,
        row.city,
        row.address,
        row.preferred_date,
        row.message,
        row.status,
        row.internal_notes,
        row.is_read,
        row.created_at,
        row.updated_at
      );
    }
    for (const row of data.inquiries as Record<string, unknown>[]) {
      db.prepare(
        `INSERT INTO inquiries (id, customer_name, phone, email, city, subject, message, is_read, admin_reply, replied_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        row.id,
        row.customer_name,
        row.phone,
        row.email,
        row.city,
        row.subject,
        row.message,
        row.is_read,
        row.admin_reply,
        row.replied_at,
        row.created_at
      );
    }
    if (Array.isArray(data.admin_notifications)) {
      for (const row of data.admin_notifications as Record<string, unknown>[]) {
        db.prepare(
          `INSERT INTO admin_notifications (id, type, title, message, reference_id, is_read, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(row.id, row.type, row.title, row.message, row.reference_id, row.is_read, row.created_at);
      }
    }
    if (Array.isArray(data.blog_posts)) {
      db.prepare('DELETE FROM blog_posts').run();
      for (const row of data.blog_posts as Record<string, unknown>[]) {
        db.prepare(
          `INSERT INTO blog_posts (id, slug, title, category, excerpt, content, author, read_time, image_url, is_published, published_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          row.id,
          row.slug,
          row.title,
          row.category,
          row.excerpt,
          row.content,
          row.author,
          row.read_time,
          row.image_url,
          row.is_published,
          row.published_at,
          row.created_at,
          row.updated_at
        );
      }
    }
    if (Array.isArray(data.gallery_items)) {
      db.prepare('DELETE FROM gallery_items').run();
      for (const row of data.gallery_items as Record<string, unknown>[]) {
        db.prepare(
          `INSERT INTO gallery_items (id, title, category, location, caption, image_url, is_published, sort_order, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          row.id,
          row.title,
          row.category,
          row.location,
          row.caption,
          row.image_url,
          row.is_published,
          row.sort_order,
          row.created_at
        );
      }
    }
    if (Array.isArray(data.products)) {
      db.prepare('DELETE FROM products').run();
      for (const row of data.products as Record<string, unknown>[]) {
        db.prepare(
          `INSERT INTO products (id, name, category, brand, capacity_or_spec, price_pkr, stock_status, summary, specs_json, image_url, is_published, sort_order, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          row.id,
          row.name,
          row.category,
          row.brand,
          row.capacity_or_spec,
          row.price_pkr,
          row.stock_status,
          row.summary,
          row.specs_json,
          row.image_url,
          row.is_published,
          row.sort_order,
          row.created_at
        );
      }
    }

    return {
      services: data.services.length,
      projects: data.projects.length,
      maintenance_plans: data.maintenance_plans.length,
      faqs: data.faqs.length,
      testimonials: data.testimonials.length,
      customers: data.customers.length,
      bookings: data.bookings.length,
      inquiries: data.inquiries.length,
    };
  });

  return { restoredCounts: tx() };
}
