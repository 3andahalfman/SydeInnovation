/**
 * Quote email notifications via nodemailer.
 * When SMTP is not configured, emails are logged and skipped so the server can run locally.
 */

const nodemailer = require('nodemailer');

function getTransporter() {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
        return null;
    }

    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass }
    });
}

function formatQuoteSummary(quote) {
    const pricing = quote.pricing || {};
    const customer = quote.customer || {};
    return [
        `Quote ID: ${quote.id}`,
        `Product: ${quote.productName || quote.productId}`,
        `Quantity: ${quote.quantity || 1}`,
        `Customer: ${customer.name || 'N/A'} <${customer.email || 'N/A'}>`,
        `Company: ${customer.company || 'N/A'}`,
        `Phone: ${customer.phone || 'N/A'}`,
        `Total: ${pricing.totalPrice != null ? pricing.totalPrice : 'N/A'}`,
        `Status: ${quote.status}`,
        `Created: ${quote.createdAt}`
    ].join('\n');
}

/**
 * Send customer confirmation + admin notification for a new quote.
 * @param {Object} quote
 * @returns {Promise<void>}
 */
async function sendQuoteEmails(quote) {
    const transporter = getTransporter();
    const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@sydeflow.local';
    const adminTo = process.env.QUOTE_ADMIN_EMAIL || process.env.SMTP_USER;
    const customerEmail = quote?.customer?.email;
    const summary = formatQuoteSummary(quote);

    if (!transporter) {
        console.warn('SMTP not configured — skipping quote emails.');
        console.warn(summary);
        return;
    }

    const jobs = [];

    if (customerEmail) {
        jobs.push(
            transporter.sendMail({
                from,
                to: customerEmail,
                subject: `Quote request received — ${quote.productName || 'SydeFlow'}`,
                text:
                    `Thanks for your quote request.\n\n` +
                    `We received your request and will follow up shortly.\n\n` +
                    `${summary}\n`
            })
        );
    }

    if (adminTo) {
        jobs.push(
            transporter.sendMail({
                from,
                to: adminTo,
                subject: `New quote request — ${quote.productName || quote.id}`,
                text: `A new quote request was submitted.\n\n${summary}\n`
            })
        );
    }

    await Promise.all(jobs);
}

module.exports = { sendQuoteEmails };
