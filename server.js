const express = require('express');
const { Client, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const bodyParser = require('body-parser');
const multer = require('multer');  // Для обработки загрузки файлов
const app = express();
const path = require('path');

// Инициализация WhatsApp клиента
const client = new Client();
let qrCodeData = null;
let clientReady = false;

client.on('qr', qr => {
    qrcode.toDataURL(qr, (err, url) => {
        qrCodeData = url;
    });
});

client.on('ready', () => {
    console.log('Client is ready!');
    clientReady = true;
});

// Middleware для парсинга JSON данных
app.use(bodyParser.json());

// Эндпоинт для получения QR-кода
app.get('/get-qr', (req, res) => {
    res.json({ qr: qrCodeData });
});

// Эндпоинт для проверки, готов ли клиент
app.get('/check-ready', (req, res) => {
    res.json({ ready: clientReady });
});

// Эндпоинт для отправки списка клиентов
app.get('/clients', (req, res) => {
    fs.readFile('clients.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading clients.json:', err);
            return res.status(500).send('Ошибка чтения списка клиентов');
        }

        const clients = JSON.parse(data);
        res.json(clients);
    });
});

// Middleware для загрузки файлов
const upload = multer({ dest: 'uploads/' });

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Эндпоинт для отправки сообщений с возможностью прикрепления файла
app.post('/send', upload.single('file'), (req, res) => {
    const { message } = req.body;
    const clients = JSON.parse(req.body.clients);
    const file = req.file;

    clients.forEach(phone => {
        const formattedNumber = `${phone}@c.us`;  // Форматируем номер для WhatsApp

        if (file) {
            // Читаем файл и создаем объект MessageMedia вручную
            const mediaPath = path.join(__dirname, file.path);
            const fileData = fs.readFileSync(mediaPath);
            const base64Data = fileData.toString('base64');
            const mimeType = file.mimetype;  // Получаем MIME-тип
            const filename = file.originalname;  // Имя файла

            const media = new MessageMedia(mimeType, base64Data, filename);  // Создаем объект MessageMedia

            client.sendMessage(formattedNumber, media, { caption: message })  // Отправляем медиа с текстом
                .then(response => console.log(`Message with media sent to ${phone}: ${response}`))
                .catch(err => console.error(`Failed to send message with media to ${phone}: ${err}`));
        } else {
            client.sendMessage(formattedNumber, message)  // Если нет файла, отправляем только текст
                .then(response => console.log(`Message sent to ${phone}: ${response}`))
                .catch(err => console.error(`Failed to send message to ${phone}: ${err}`));
        }
    });

    res.json({ status: 'ok' });

    // Удаляем загруженный файл после отправки
    if (file) {
        fs.unlink(file.path, (err) => {
            if (err) console.error('Failed to delete file:', err);
        });
    }
});

// Статический хостинг HTML страницы
app.use(express.static('public'));

// Запуск сервера
const port = process.env.PORT || 3000;
client.initialize();

app.listen(port, () => {
    console.log(`Server started on http://localhost:${port}`);
});
