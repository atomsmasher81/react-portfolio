import React from 'react';
import WaveComponent from './wave';

const HeroBackground = () => {
    return (
        <div style={{
            position: 'fixed',
            height: '100vh', // Adjust the height as needed
            overflow: 'hidden',
            top:0
        }}>
            <WaveComponent />
        </div>
    );
};

export default HeroBackground;
