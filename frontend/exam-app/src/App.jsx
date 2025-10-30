import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import RegisterPage from './pages/users/RegisterPage';
import LoginPage from './pages/users/LoginPage';
import HomePage from './pages/home/HomePage';
import Navbar from './components/Navbar';
import "./App.css"
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function App() { 
  return (
    <div className=''> 
    <Router>
      <Navbar/>
      <Routes>
        <Route path="/" element={<HomePage/>} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </Router>
    </div>
  );
}

export default App;
