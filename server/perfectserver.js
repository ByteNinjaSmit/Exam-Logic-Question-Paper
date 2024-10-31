const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const cors = require('cors');
const connectToDatabase = require('./lib/db');
const { Server } = require('socket.io');
const QuestionPaper = require('./lib/model/exam-model');
const http = require("http");

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

// Apply CORS middleware with specified options
app.use(cors({ origin: process.env.CORS_SERVER, credentials: true }));
app.use(express.json());

let examStartTime;
let examEndTime;
let currentQuestionIndex = 0;
let questionPaper = null;
let examInterval; // Reference to interval for ending based on endTime

// Load the question paper from the database
async function loadQuestionPaper() {
    try {
        questionPaper = await QuestionPaper.findOne({ title: "Sample Question Paper" });
        if (questionPaper) {
            console.log("Loaded question paper:", questionPaper.title);
            examStartTime = new Date(questionPaper.startTime).getTime();
            examEndTime = new Date(questionPaper.endTime).getTime();
            currentQuestionIndex = questionPaper.currentQuestionIndex || 0; // Load last index if present
        }
    } catch (error) {
        console.error("Failed to load question paper:", error);
    }
}

// Calculate elapsed time and set the correct question index
function getElapsedQuestionIndex() {
    const elapsedTime = (Date.now() - examStartTime) / 1000; // in seconds
    let cumulativeTime = 0;

    for (let i = 0; i < questionPaper.questions.length; i++) {
        cumulativeTime += questionPaper.questions[i].timeLimit;
        if (elapsedTime < cumulativeTime) {
            return i;
        }
    }
    return questionPaper.questions.length - 1; // End of questions
}
// Function to start the exam if current time is within startTime and endTime
function checkAndStartExam() {
    const now = Date.now();
    if (now >= examStartTime && now <= examEndTime) {
        console.log("Exam starting...");
        startExam();
    } else {
        console.log("Waiting for the scheduled start time...");
        const timeUntilStart = examStartTime - now;
        setTimeout(startExam, timeUntilStart); // Start when startTime is reached
    }
}

function startExam() {
    if (!questionPaper || questionPaper.questions.length === 0) {
        console.error("No questions available in the question paper.");
        return;
    }

    if (Date.now() >= examStartTime) {
        broadcastCurrentQuestion();
    } else {
        const delayUntilStart = examStartTime - Date.now();
        setTimeout(broadcastCurrentQuestion, delayUntilStart);
    }
}


async function broadcastCurrentQuestion() {
    const currentTime = Date.now();

    if (currentTime >= examEndTime) {
        endExam();
        return;
    }

    currentQuestionIndex = getElapsedQuestionIndex();
    const currentQuestion = questionPaper.questions[currentQuestionIndex];
    const cumulativeTime = questionPaper.questions
        .slice(0, currentQuestionIndex)
        .reduce((total, q) => total + q.timeLimit, 0);
    const timeSpentOnCurrentQuestion = (currentTime - examStartTime) / 1000 - cumulativeTime;
    const remainingTime = (currentQuestion.timeLimit - timeSpentOnCurrentQuestion) * 1000;

    console.log(Broadcasting Question ${currentQuestionIndex + 1}:, currentQuestion.questionText);

    io.emit("question", {
        question: currentQuestion,
        questionIndex: currentQuestionIndex + 1,
        remainingTime: remainingTime / 1000,
    });

    // Update currentQuestionIndex in the database
    await QuestionPaper.updateOne(
        { title: "Sample Question Paper" },
        { currentQuestionIndex }
    );

    setTimeout(() => {
        currentQuestionIndex++;
        if (currentTime < examEndTime) {
            broadcastCurrentQuestion();
        } else {
            endExam();
        }
    }, remainingTime);
}

// End the exam and broadcast to all clients
function endExam() {
    io.emit("examEnd", { message: "Exam has ended" });
    console.log("Exam has ended");

    // Clear the interval for checking endTime if it’s still running
    if (examInterval) clearInterval(examInterval);
}

// Calculate the current question index for late joiners
function getCurrentQuestionIndex(elapsedTime) {
    let totalElapsed = 0;
    for (let i = 0; i < questionPaper.questions.length; i++) {
        totalElapsed += questionPaper.questions[i].timeLimit * 1000;
        if (elapsedTime < totalElapsed) return i;
    }
    return questionPaper.questions.length - 1;
}

// Socket.IO connection logic
io.on("connection", (socket) => {
    console.log("New client connected");

    // Handle late joiners by sending the current question
    if (examStartTime) {
        const timeElapsed = Date.now() - examStartTime;
        currentQuestionIndex = getCurrentQuestionIndex(timeElapsed);
        socket.emit("question", {
            question: questionPaper.questions[currentQuestionIndex],
            questionIndex: currentQuestionIndex + 1,
        });
    }

    // Handle student answers
    socket.on("answer", ({ questionIndex, answer }) => {
        const question = questionPaper.questions[questionIndex];
        const isCorrect = question.options.find(opt => opt.optionText === answer)?.isCorrect || false;
        socket.emit("answerResult", { isCorrect });
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected");
    });
});

// Connect to MongoDB, load the question paper, and start the server
connectToDatabase()
    .then(() => {
        console.log("Connected to MongoDB successfully");
        return loadQuestionPaper();
    })
    .then(() => {
        server.listen(PORT, () => {
            console.log(Server running on port ${PORT});
            checkAndStartExam(); // Start the exam based on start time
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

app.get('/start-exam', (req, res) => {
    if (!examStartTime) {
        checkAndStartExam();
        res.send("Exam scheduling initiated.");
    } else {
        res.send("Exam is already scheduled or in progress.");
    }
});