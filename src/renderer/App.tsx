import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import icon from '../../assets/icon.svg';
import './App.css';

const ipcRender = window.electron.ipcRenderer;

ipcRender.on('write', (data) => {
  console.log('write:', data);
});
ipcRender.on('received', (data) => {
  console.log('received:', data);
});

const Hello = () => {
  return (
    <div>
      <div className="Hello">
        <img width="200" alt="icon" src={icon} />
      </div>
      <h1>electron-react-boilerplate</h1>
      <div className="Hello">
        <button
          type="button"
          onClick={() => window.electron.ipcRenderer.sendMessage('start', {})}
        >
          <span role="img" aria-label="books">
            📚
          </span>
          Read our docs
        </button>
        <button type="button">
          <span role="img" aria-label="books">
            🙏
          </span>
          Donate
        </button>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Hello />} />
      </Routes>
    </Router>
  );
}
