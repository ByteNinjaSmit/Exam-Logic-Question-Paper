// server.js
const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const cors = require('cors');
const connectToDatabase = require('./lib/db');
const { Server } = require('socket.io');
const http = require("http");
const {
    loadQuestionPaper,
    checkAndStartExam,
    handleSocketConnection
} = require('./controllers/examController');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CORS_SERVER,
        methods: ["GET", "POST", "DELETE", "PATCH", "HEAD", "PUT"],
        credentials: true,
    },
});

const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CORS_SERVER, credentials: true }));
app.use(express.json());

// Pass the io instance and controller functions to handleSocketConnection
handleSocketConnection(io, loadQuestionPaper, checkAndStartExam);

connectToDatabase()
    .then(() => {
        console.log("Connected to MongoDB successfully");
        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error("Error connecting to MongoDB:", error);
        process.exit(1);
    });

// Define routes
app.get('/', (req, res) => {
    res.send('Welcome to the API');
});

app.post('/start-exam', async (req, res) => {
    const { title, paperKey } = req.body;

    try {
        // Load the question paper and check if it's valid
        const questionPaper = await loadQuestionPaper(title, paperKey);
        if (!questionPaper) {
            return res.status(404).send(`Question paper "${title}" not found.`);
        }

        // Check and start the exam
        checkAndStartExam(io, paperKey);
        res.send(`Exam with title "${title}" scheduled.`);
    } catch (error) {
        console.error("Error starting exam:", error);
        res.status(500).send("An error occurred while starting the exam.");
    }
});
