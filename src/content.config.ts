import { defineCollection, z } from 'astro:content';

const services = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    tagline: z.string().optional(),
    description: z.string().optional(),
    heroImage: z.string().optional(),
    heroImages: z.array(z.string()).optional(),
    category: z.string().optional(),
    order: z.number().optional(),
    hideIntro: z.boolean().optional(),
    introTitle: z.string().optional(),
    introText: z.string().optional(),
    packages: z.array(z.object({
      name: z.string(),
      price: z.string(),
      includes: z.array(z.string()).optional(),
    })).optional(),
    galleryImages: z.array(z.string()).optional(),
    testimonial: z.string().optional(),
    testimonialAuthor: z.string().optional(),
    faqs: z.array(z.object({
      question: z.string(),
      answer: z.string(),
    })).optional(),
  }),
});

const classes = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    tagline: z.string().optional(),
    description: z.string().optional(),
    heroImage: z.string().optional(),
    category: z.string().optional(),
    price: z.string().optional(),
    earlyBird: z.string().optional(),
    duration: z.string().optional(),
    order: z.number().optional(),
    showPrivateNote: z.boolean().optional(),
    privateNote: z.string().optional(),
    schedule: z.array(z.string()).optional(),
    ticketLink: z.string().optional(),
    galleryImages: z.array(z.string()).optional(),
    galleryVideo: z.string().optional(),
    location: z.object({
      name: z.string(),
      address: z.string(),
      city: z.string(),
      directions: z.string().optional(),
    }).optional(),
    includes: z.array(z.string()).optional(),
  }),
});

const testimonials = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    category: z.string(),
    order: z.number().optional(),
  }),
});

// Manifestation content hub — pillar + topic clusters (AEO).
const manifestation = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    // The single target question this page answers.
    question: z.string().optional(),
    description: z.string(),
    // Cluster grouping per the hub plan.
    cluster: z.enum(['visualization', 'problem', 'method', 'frameworks', 'threshold']),
    tier: z.number().optional(),
    order: z.number().optional(),
    // Liftable, answer-first opening (2–4 sentences). Optional on stubs.
    answerFirst: z.string().optional(),
    // ISO date string, e.g. "2026-07-01".
    lastUpdated: z.string().optional(),
    // Explicit sibling slugs; if omitted, siblings are derived from the cluster.
    siblings: z.array(z.string()).optional(),
    faqs: z.array(z.object({
      question: z.string(),
      answer: z.string(),
    })).optional(),
    // false = stub/coming-soon (listed but not linked as a live page).
    published: z.boolean().default(false),
  }),
});

export const collections = {
  services,
  classes,
  testimonials,
  manifestation,
};
