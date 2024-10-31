// src/components/Question.tsx
import React from 'react';

interface Option {
    optionText: string;
    isCorrect: boolean;
}

interface QuestionProps {
    questionText: string;
    options: Option[];
    onSelect: (answer: string) => void;
}

const Question: React.FC<QuestionProps> = ({ questionText, options, onSelect }) => {
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

export default Question;
