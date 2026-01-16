import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { WheyProteinPage } from "./pages/landing/WheyProteinPage";
import { AboutPage } from "./pages/AboutPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 主页 */}
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />

        {/* 静态落地页 */}
        <Route path="/landing/whey-protein" element={<WheyProteinPage />} />

        {/* 旧 URL 重定向 */}
        <Route
          path="/product/intro/SxfWheyProteinIsolate"
          element={<Navigate to="/landing/whey-protein" replace />}
        />

        {/* 404 回退到首页 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
