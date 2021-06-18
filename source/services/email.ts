import sgMail from '@sendgrid/mail';
import logging from '../config/logging';

const NAMESPACE = 'Email';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

async function sendEmail(to: string, from: string, subject: string, text: string) {
    return new Promise((resolve, reject) => {
        const msg = {
            to,
            from,
            subject,
            text
        };
        sgMail
            .send(msg)
            .then((response) => {
                logging.info(NAMESPACE, 'Email sent');
                resolve(response);
            })
            .catch((error) => {
                logging.info(NAMESPACE, 'Error occured while sending email', error);
                reject(error);
            });
    });
}

export { sendEmail };
