const express = require('express');
require('dotenv').config();
const { Client, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const bodyParser = require('body-parser');
const multer = require('multer');  // Для обработки загрузки файлов
const app = express();
const path = require('path');

// Инициализация WhatsApp клиента
const client = new Client({
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});
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
    const clientsJson = process.env.CLIENTS_JSON;
    
    if (!clientsJson) {
        console.error('CLIENTS_JSON environment variable is not set');
        return res.status(500).send('Ошибка: переменная окружения CLIENTS_JSON не установлена');
    }

    try {
        const clients = JSON.parse(clientsJson);
        res.json(clients);
    } catch (err) {
        console.error('Error parsing CLIENTS_JSON:', err);
        res.status(500).send('Ошибка обработки данных клиентов');
    }
});

// Middleware для загрузки файлов
const upload = multer({ dest: 'uploads/' });

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Функция для отправки сообщений с задержкой
const sendMessagesWithDelay = async (clients, message, file) => {
    const delay = 2000; // Задержка в миллисекундах (2 секунды)
    
    for (const phone of clients) {
        const formattedNumber = `${phone}@c.us`;  // Форматируем номер для WhatsApp
        
        try {
            if (file) {
                // Читаем файл и создаем объект MessageMedia вручную
                const mediaPath = path.join(__dirname, file.path);
                const fileData = fs.readFileSync(mediaPath);
                const base64Data = fileData.toString('base64');
                const mimeType = file.mimetype;  // Получаем MIME-тип
                const filename = file.originalname;  // Имя файла

                const media = new MessageMedia(mimeType, base64Data, filename);  // Создаем объект MessageMedia

                await client.sendMessage(formattedNumber, media, { caption: message });  // Отправляем медиа с текстом
            } else {
                await client.sendMessage(formattedNumber, message);  // Если нет файла, отправляем только текст
            }
            console.log(`Message sent to ${phone}`);
        } catch (err) {
            console.error(`Failed to send message to ${phone}: ${err}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay)); // Задержка
    }

    // Удаляем загруженный файл после отправки
    if (file) {
        fs.unlink(file.path, (err) => {
            if (err) console.error('Failed to delete file:', err);
        });
    }
};

// Эндпоинт для отправки сообщений с возможностью прикрепления файла
app.post('/send', upload.single('file'), async (req, res) => {
    const { message } = req.body;
    const clients = JSON.parse(req.body.clients);
    const file = req.file;

    await sendMessagesWithDelay(clients, message, file);

    res.json({ status: 'ok' });
});

// Статический хостинг HTML страницы
app.use(express.static('public'));

// Запуск сервера
client.initialize();

const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`Server started on http://localhost:${port}`);
});
