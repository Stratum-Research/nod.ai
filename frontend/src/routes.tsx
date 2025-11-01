import { createHashRouter } from "react-router";
import SettingsPage from "./pages/settings/Settings";
import ChatPage from "./pages/chat/Chat";

export const routes = createHashRouter([
  {
    path: "/",
    element: <ChatPage />,
  },
  {
    path: "/settings",
    element: <SettingsPage />,
  },
  {
    path: "/chat",
    element: <ChatPage />,
  },
]);
