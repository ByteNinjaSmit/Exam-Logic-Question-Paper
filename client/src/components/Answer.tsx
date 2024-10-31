// src/components/Answer.tsx
import React from 'react';

interface AnswerProps {
    isCorrect: boolean;
}

const Answer: React.FC<AnswerProps> = ({ isCorrect }) => {
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

export default Answer;
