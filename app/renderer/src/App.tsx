/**
 * Main React application component
 * @mem ref: arch-fwk
 * Initial minimal UI for Axis Pro
 */

import React from 'react';

const App: React.FC = () => {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#121212',
      color: '#F2F2F2',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, Inter, sans-serif',
    }}>
      <h1>Axis Pro</h1>
    </div>
  );
};

export default App;

