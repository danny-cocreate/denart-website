import type { APIRoute } from 'astro';
import { Resend } from 'resend';

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    
    const name = formData.get('name')?.toString() || '';
    const email = formData.get('email')?.toString() || '';
    const phone = formData.get('phone')?.toString() || '';
    const service = formData.get('service')?.toString() || '';
    const date = formData.get('date')?.toString() || '';
    const details = formData.get('details')?.toString() || '';
    const message = formData.get('message')?.toString() || '';

    if (!name || !email) {
      return new Response(
        JSON.stringify({ success: false, error: 'Name and email are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const resend = new Resend(import.meta.env.RESEND_API_KEY);

    // Build email content
    const subject = service ? `New Quote Request: ${service}` : 'New Contact Form Submission';
    
    let emailBody = `New inquiry from ${name}\n\n`;
    emailBody += `Email: ${email}\n`;
    if (phone) emailBody += `Phone: ${phone}\n`;
    if (service) emailBody += `Service: ${service}\n`;
    if (date) emailBody += `Preferred Date: ${date}\n`;
    if (details) emailBody += `\nProject Details:\n${details}\n`;
    if (message) emailBody += `\nMessage:\n${message}\n`;

    const contactEmail = import.meta.env.CONTACT_EMAIL || 'denartny@gmail.com';

    // Send email to DenArt (in test mode, Resend only allows sending to account owner)
    const { error: sendError } = await resend.emails.send({
      from: 'DenArt <onboarding@resend.dev>',
      to: contactEmail,
      subject: subject,
      text: emailBody,
    });

    if (sendError) {
      console.error('Resend error:', sendError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to send email. Please try again.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Send confirmation email to submitter
    const confirmationText = `Hi ${name},\n\nThank you for reaching out to DenArt! I've received your message and will get back to you as soon as possible.\n\nHere's a copy of your submission:\n${emailBody}\n\nBest regards,\nDenArt`;

    const { error: confirmError } = await resend.emails.send({
      from: 'DenArt <onboarding@resend.dev>',
      to: email,
      reply_to: contactEmail,
      subject: 'Thank you for contacting DenArt',
      text: confirmationText,
    });

    // Log confirmation error but don't fail the request
    if (confirmError) {
      console.error('Confirmation email error:', confirmError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: service ? 'Quote request sent successfully!' : 'Message sent successfully!' 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('API error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'An error occurred. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
