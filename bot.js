const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

// Инициализация клиента
const client = new Client();

// Генерация QR-кода для авторизации
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

// Запуск клиента
client.on('ready', () => {
    console.log('Client is ready!');

    // Загрузка списка клиентов из файла JSON
    fs.readFile('clients.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading clients.json:', err);
            return;
        }

        const clients = JSON.parse(data);

        // Отправка сообщений каждому клиенту
        clients.forEach(clientData => {
            const { name, phone } = clientData;
            const number = `${phone}@c.us`; // Формат номера телефона для WhatsApp
            const message = `Доброго дня, ${name}! Вс вітає магазин Syrnyk.`;

            client.sendMessage(number, message)
                .then(response => console.log(`Message sent to ${name}: ${response}`))
                .catch(err => console.error(`Failed to send message to ${name}: ${err}`));
        });
    });
});

client.initialize();
