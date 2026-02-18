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
    packages: z.array(z.object({
      name: z.string(),
      price: z.string(),
      includes: z.array(z.string()).optional(),
    })).optional(),
    galleryImages: z.array(z.string()).optional(),
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

export const collections = {
  services,
  classes,
  testimonials,
};
