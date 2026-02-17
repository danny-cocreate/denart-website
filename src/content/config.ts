import { defineCollection, z } from 'astro:content';

const servicesCollection = defineCollection({
	type: 'content',
	schema: z.object({
		title: z.string(),
		tagline: z.string().optional(),
		description: z.string(),
		heroImage: z.string().optional(),
		category: z.enum(['private', 'events']).optional(),
		order: z.number().optional(),
		packages: z.array(z.object({
			name: z.string(),
			price: z.string(),
			includes: z.array(z.string()),
		})).optional(),
	}),
});

const classesCollection = defineCollection({
	type: 'content',
	schema: z.object({
		title: z.string(),
		tagline: z.string().optional(),
		description: z.string(),
		heroImage: z.string().optional(),
		category: z.enum(['couples', 'singles', 'professionals']).optional(),
		price: z.string().optional(),
		ticketLink: z.string().optional(),
		showPrivateNote: z.boolean().optional(),
		privateNote: z.string().optional(),
		earlyBird: z.string().optional(),
		duration: z.string().optional(),
		order: z.number().optional(),
		schedule: z.array(z.string()).optional(),
		includes: z.array(z.string()).optional(),
		galleryImages: z.array(z.string()).optional(),
		galleryVideo: z.string().optional(),
		location: z.object({
			name: z.string(),
			address: z.string(),
			city: z.string(),
			directions: z.string().optional(),
		}).optional(),
		giftCertificate: z.object({
			available: z.boolean(),
			expiry: z.string().optional(),
			url: z.string().optional(),
		}).optional(),
	}),
});

const eventsCollection = defineCollection({
	type: 'content',
	schema: z.object({
		title: z.string(),
		date: z.string().optional(),
		images: z.array(z.object({
			src: z.string(),
			alt: z.string().optional(),
		})).optional(),
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
		category: z.string().optional(),
		description: z.string().optional(),
		images: z.array(z.object({
			src: z.string(),
			alt: z.string().optional(),
		})).optional(),
	}),
});

export const collections = {
	services: servicesCollection,
	classes: classesCollection,
	events: eventsCollection,
	pages: pagesCollection,
	gallery: galleryCollection,
};
