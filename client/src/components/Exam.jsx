import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:5000'); // Ensure this matches your backend URL

// Question Component
const Question = ({ questionText, options, onSelect }) => {
    return (
        <div className="question-container">
            <h2 className="question-text">{questionText}</h2>
            <div className="options">
                {options.map((option, index) => (
                    <button
                        key={index}
                        className="option-button"
                        onClick={() => onSelect(option.optionText)}
                    >
                        {option.optionText}
                    </button>
                ))}
            </div>
        </div>
    );
};

// Answer Component
const Answer = ({ isCorrect }) => {
    return (
        <div className={`answer-result ${isCorrect ? 'correct' : 'incorrect'}`}>
            {isCorrect ? (
                <p className="text-green-500">Correct Answer!</p>
            ) : (
                <p className="text-red-500">Incorrect Answer. Try Again!</p>
            )}
        </div>
    );
};

// Exam Component
const Exam = () => {
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [questionIndex, setQuestionIndex] = useState(0);
    const [remainingTime, setRemainingTime] = useState(0);
    const [isAnswerCorrect, setIsAnswerCorrect] = useState(null); // null = no answer yet
    const [isExamEnded, setIsExamEnded] = useState(false); // Track if the exam has ended
    const [paperKey, setPaperKey] = useState('QZP-2024-101'); // Example paper key, can be set dynamically
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const makePostFunction = async () => {
            setIsLoading(true);
            try {
                const response = await fetch('http://localhost:5000/start-exam', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        title: 'Sample Question Paper',
                        paperKey,
                    }),
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                console.log('Response data:', data);
            } catch (error) {
                console.error('Error occurred while making POST request:', error);
            } finally {
                setIsLoading(false);
            }
        };

        makePostFunction();
    }, [paperKey]);

    useEffect(() => {
        socket.emit("loadExam", { title: "Sample Question Paper", paperKey });// Join the socket room based on paper key

        socket.on('question', (data) => {
            if (!isExamEnded) { // Prevent updating question data if exam has ended
                setCurrentQuestion(data.question);
                setQuestionIndex(data.questionIndex);
                setRemainingTime(data.remainingTime);
                setIsAnswerCorrect(null); // Reset answer state on new question
            }
        });

        socket.on('examEnd', () => {
            setIsExamEnded(true); // Set exam end state
            setCurrentQuestion(null);
            setQuestionIndex(null);
            setRemainingTime(null); // Clear the current question
        });

        return () => {
            socket.off('question');
            socket.off('examEnd');
        };
    }, [isExamEnded, paperKey]);

    const handleSelectAnswer = (answer) => {
        if (currentQuestion) {
            const isCorrect = currentQuestion.options.some(option => option.optionText === answer && option.isCorrect);
            setIsAnswerCorrect(isCorrect);

            // Emit the answer to the server
            socket.emit('answer', { questionIndex, answer });
        }
    };

    useEffect(() => {
        if (!isExamEnded && remainingTime > 0) {
            const countdown = setInterval(() => {
                setRemainingTime((prevTime) => {
                    if (prevTime <= 1) {
                        clearInterval(countdown); // Stop countdown when time is up
                        // Handle time-out actions here if needed
                        return 0;
                    }
                    return prevTime - 1;
                });
            }, 1000);

            return () => clearInterval(countdown); // Clean up interval on unmount or if exam ends
        }
    }, [isExamEnded, remainingTime]);

    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(0) ;
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    };

    return (
        <div className="exam-container">
            {isLoading ? (
                <p>Loading exam...</p>
            ) : isExamEnded ? (
                <p>Exam End</p>
            ) : currentQuestion ? (
                <>
                    <Question
                        questionText={currentQuestion.questionText}
                        options={currentQuestion.options}
                        onSelect={handleSelectAnswer}
                    />
                    {isAnswerCorrect !== null && (
                        <Answer isCorrect={isAnswerCorrect} />
                    )}
                    <p>Remaining Time: {formatTime(remainingTime)}</p>
                </>
            ) : (
                <p>Loading...</p>
            )}
        </div>
    );
};

export default Exam;
