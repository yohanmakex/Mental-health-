const nodemailer = require('nodemailer');

// Create a transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
    host: 'smtp.example.com', // Replace with your SMTP server
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: 'user@example.com', // generated ethereal user
        pass: 'userpassword', // generated ethereal password
    },
});

// ... rest of your server.js code ...