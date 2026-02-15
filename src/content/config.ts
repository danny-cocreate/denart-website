import { defineCollection, z } from 'astro:content';

const servicesCollection = defineCollection({
	type: 'content',
	schema: z.object({
		title: z.string(),
		description: z.string(),
		image: z.string().optional(),
		price: z.string().optional(),
		duration: z.string().optional(),
	}),
});

const eventsCollection = defineCollection({
	type: 'content',
	schema: z.object({
		title: z.string(),
		date: z.date(),
		location: z.string(),
		description: z.string(),
		image: z.string().optional(),
	}),
});

const pagesCollection = defineCollection({
	type: 'content',
	schema: z.object({
		title: z.string(),
		description: z.string().optional(),
	}),
});

const galleryCollection = defineCollection({
	type: 'content',
	schema: z.object({
		title: z.string(),
		image: z.string(),
		category: z.string().optional(),
		description: z.string().optional(),
	}),
});

export const collections = {
	services: servicesCollection,
	events: eventsCollection,
	pages: pagesCollection,
	gallery: galleryCollection,
};
