import { useState } from 'react';

/**
 * Main application component.
 * Will be expanded with routing and layout in future milestones.
 */
function App() {
  const [currentView] = useState<'login' | 'viewer' | 'complete'>('login');

  return (
    <div className="app">
      <header className="app-header">
        <h1>FGATIR Rater Study</h1>
        <p>MRI Image Quality Assessment Tool</p>
      </header>
      <main className="app-main">
        {currentView === 'login' && (
          <section className="placeholder-view">
            <h2>Login</h2>
            <p>Rater authentication will be implemented here.</p>
          </section>
        )}
        {currentView === 'viewer' && (
          <section className="placeholder-view">
            <h2>Viewer</h2>
            <p>DICOM viewer with rating interface will be implemented here.</p>
          </section>
        )}
        {currentView === 'complete' && (
          <section className="placeholder-view">
            <h2>Complete</h2>
            <p>Study completion screen will be implemented here.</p>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
