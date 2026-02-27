import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { Admin } from './pages/Admin';
import { Message } from './pages/Message';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/message/:id" element={<Message />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
