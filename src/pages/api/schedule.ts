import type { APIRoute } from 'astro';
import { Resend } from 'resend';

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const searchParams = new URL(request.url).searchParams;

    const getField = (field: string) =>
      formData.get(field)?.toString().trim() || searchParams.get(field)?.trim() || '';

    const name = getField('name');
    const email = getField('email');
    const phone = getField('phone');
    const service = getField('service');
    const sessionType = getField('sessionType');
    const date1 = getField('date1');
    const date2 = getField('date2');
    const design = getField('design');
    const promoCode = getField('promoCode');

    if (!name || !email || !sessionType || !date1) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Name, email, session type, and preferred date are required.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const resend = new Resend(import.meta.env.RESEND_API_KEY);
    const contactEmail = import.meta.env.CONTACT_EMAIL || 'denartny@gmail.com';

    const subject = `New Session Request: ${sessionType}`;
    let emailBody = `New schedule request from ${name}\n\n`;
    emailBody += `Email: ${email}\n`;
    if (phone) emailBody += `Phone: ${phone}\n`;
    if (service) emailBody += `Service Page: ${service}\n`;
    emailBody += `Session Type: ${sessionType}\n`;
    emailBody += `Preferred Date 1: ${date1}\n`;
    if (date2) emailBody += `Preferred Date 2: ${date2}\n`;
    if (design) emailBody += `\nDesign Ideas:\n${design}\n`;
    if (promoCode) emailBody += `\nPromo Code: ${promoCode}\n`;

    const { error: sendError } = await resend.emails.send({
      from: 'DenArt <onboarding@resend.dev>',
      to: contactEmail,
      subject,
      text: emailBody,
    });

    if (sendError) {
      console.error('Resend error:', sendError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to send request. Please try again.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const confirmationText = `Hi ${name},\n\nThank you for scheduling with DenArt! I received your session request and will follow up within 24-48 hours.\n\nHere is a copy of your request:\n${emailBody}\n\nBest,\nDenArt`;
    const { error: confirmError } = await resend.emails.send({
      from: 'DenArt <onboarding@resend.dev>',
      to: email,
      reply_to: contactEmail,
      subject: 'We received your session request',
      text: confirmationText,
    });

    if (confirmError) {
      console.error('Confirmation email error:', confirmError);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Thank you! We'll be in touch soon." }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Schedule API error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'An error occurred. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
