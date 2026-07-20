import { Navigate, Route, Routes } from "react-router-dom";
import { RootLayout } from "./components/layout/RootLayout";
import { RoomCreateRoute } from "./routes/RoomCreateRoute";
import { RoomRoute } from "./routes/RoomRoute";

export function App() {
  return (
    <RootLayout>
      <Routes>
        <Route index element={<RoomCreateRoute />} />
        <Route path="rooms/:roomId" element={<RoomRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </RootLayout>
  );
}
