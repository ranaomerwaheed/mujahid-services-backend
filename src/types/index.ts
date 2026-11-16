export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface WhyChooseUsItem {
  id: string;
  title: string;
  metric: string;
  description: string;
}

export interface SiteSettings {
  companyName: string;
  tagline: string;
  heroTitle: string;
  heroSubtitle: string;
  heroPrimaryCta: string;
  heroBannerImage: string;
  aboutBannerImage: string;
  servicesBannerImage: string;
  projectsBannerImage: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  workingHours: string;
  serviceAreas: string[];
  aboutTitle: string;
  aboutDescription: string;
  aboutMission: string;
  yearsExperience: string;
  projectsCompletedLabel: string;
  responseTimeLabel: string;
  whyChooseUsTitle: string;
  whyChooseUsSubtitle: string;
  whyChooseUsItems: WhyChooseUsItem[];
}

export interface ServiceItem {
  id: number;
  slug: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  features: string[];
  priceRange: string;
  responseWindow: string;
  imageUrl: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectItem {
  id: number;
  title: string;
  category: string;
  clientName: string;
  location: string;
  completionDate: string;
  summary: string;
  metrics: string;
  imageUrl: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenancePlan {
  id: number;
  name: string;
  targetAudience: string;
  billingCycle: 'Monthly' | 'Quarterly' | 'Annual';
  pricePkr: number;
  description: string;
  features: string[];
  isPublished: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface FaqItem {
  id: number;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
  isPublished: boolean;
}

export interface Testimonial {
  id: number;
  customerName: string;
  roleOrCompany: string;
  city: string;
  serviceName: string;
  rating: number;
  reviewText: string;
  status: ReviewStatus;
  createdAt: string;
}

export interface CustomerRecord {
  id: number;
  fullName: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  notes: string;
  bookingCount?: number;
  lastBookingDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BookingRecord {
  id: number;
  bookingCode: string;
  customerId: number;
  customerName: string;
  phone: string;
  serviceId: number | null;
  serviceName: string;
  city: string;
  address: string;
  preferredDate: string;
  message: string;
  status: BookingStatus;
  internalNotes: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContactInquiry {
  id: number;
  customerName: string;
  phone: string;
  email: string;
  city: string;
  subject: string;
  message: string;
  isRead: boolean;
  adminReply: string;
  repliedAt: string | null;
  createdAt: string;
}

export interface AdminNotification {
  id: number;
  type: 'booking' | 'inquiry' | 'review';
  title: string;
  message: string;
  referenceId: number;
  isRead: boolean;
  createdAt: string;
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalInquiries: number;
  unreadInquiries: number;
  totalBookings: number;
  pendingBookings: number;
  confirmedBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalCustomers: number;
  unreadNotifications: number;
  monthlyOverview: {
    month: string;
    total: number;
    completed: number;
    pending: number;
  }[];
  recentRequests: BookingRecord[];
}

export interface ReportsPayload {
  daily: { date: string; count: number; completed: number }[];
  weekly: { week: string; count: number; completed: number }[];
  monthly: { month: string; count: number; completed: number; cancelled: number }[];
  serviceBreakdown: { serviceName: string; total: number; completed: number; pending: number }[];
  inquirySummary: {
    total: number;
    unread: number;
    replied: number;
    byCity: { city: string; count: number }[];
  };
}

export interface BlogPost {
  id: number;
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  content: string;
  author: string;
  readTime: string;
  imageUrl: string;
  isPublished: boolean;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface GalleryItem {
  id: number;
  title: string;
  category: string;
  location: string;
  caption: string;
  imageUrl: string;
  isPublished: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface ProductItem {
  id: number;
  name: string;
  category: string;
  brand: string;
  capacityOrSpec: string;
  pricePkr: string;
  stockStatus: 'In Stock' | 'On Order' | 'Workshop Stock';
  summary: string;
  specs: string[];
  imageUrl: string;
  isPublished: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface PublicBootstrapData {
  settings: SiteSettings;
  services: ServiceItem[];
  products: ProductItem[];
  projects: ProjectItem[];
  plans: MaintenancePlan[];
  faqs: FaqItem[];
  testimonials: Testimonial[];
  blogPosts: BlogPost[];
  galleryItems: GalleryItem[];
}
