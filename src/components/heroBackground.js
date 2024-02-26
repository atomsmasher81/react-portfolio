import React from 'react';
import WaveComponent from './wave';

const HeroBackground = () => {
    return (
        <div style={{
            position: 'relative',
            height: '100vh', // Adjust the height as needed
            overflow: 'hidden',
        }}>
            <WaveComponent />
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 1,
                textAlign: 'center',
                color: 'white',
            }}>
                <h1>Your Hero Title</h1>
                <p>Your Hero Description</p>
            </div>
        </div>
    );
};

export default HeroBackground;
